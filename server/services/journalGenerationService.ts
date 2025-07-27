import { storage } from "../storage";
import { openaiService } from "./openaiService";
import { nanoid } from "nanoid";

export interface JournalEntry {
  id: string;
  entryDate: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  reference: string;
  documentType: string;
  sourceDocument: string;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
}

export interface JournalGenerationResult {
  success: boolean;
  totalEntries: number;
  documentsProcessed: number;
  entries: JournalEntry[];
  errors: string[];
}

class JournalGenerationService {
  async generateJournalEntries(userId: string, tenantId: string): Promise<JournalGenerationResult> {
    try {
      // Fetch all completed documents for the tenant
      const documents = await storage.getDocumentsByTenant(tenantId);
      const completedDocuments = documents.filter(doc => 
        (doc.status === 'completed' || doc.status === 'extracted') && 
        doc.extractedData && 
        ['bank_statement', 'sales_register', 'purchase_register', 'vendor_invoice'].includes(doc.documentType || '')
      );

      if (completedDocuments.length === 0) {
        return {
          success: false,
          totalEntries: 0,
          documentsProcessed: 0,
          entries: [],
          errors: ['No processed documents found for journal entry generation']
        };
      }

      const allJournalEntries: JournalEntry[] = [];
      const errors: string[] = [];
      let documentsProcessed = 0;

      for (const document of completedDocuments) {
        try {
          // Check if journal entries already exist for this document
          const existingEntries = await storage.getJournalEntries(document.id);
          if (existingEntries && existingEntries.length > 0) {
            console.log(`Skipping document ${document.id} - journal entries already exist`);
            continue;
          }

          const journalEntries = await this.generateEntriesForDocument(document, userId, tenantId);
          allJournalEntries.push(...journalEntries);
          documentsProcessed++;
          
        } catch (error) {
          console.error(`Error processing document ${document.id}:`, error);
          errors.push(`Failed to process ${document.originalName}: ${error.message}`);
        }
      }

      return {
        success: true,
        totalEntries: allJournalEntries.length,
        documentsProcessed,
        entries: allJournalEntries,
        errors
      };

    } catch (error) {
      console.error('Error in journal generation service:', error);
      return {
        success: false,
        totalEntries: 0,
        documentsProcessed: 0,
        entries: [],
        errors: [error.message]
      };
    }
  }

  private async generateEntriesForDocument(document: any, userId: string, tenantId: string): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    const extractedData = document.extractedData;
    
    if (!extractedData || !extractedData.records || extractedData.records.length === 0) {
      throw new Error('No extracted data found in document');
    }

    // Use OpenAI to generate intelligent journal entries
    const aiPrompt = this.buildJournalGenerationPrompt(document, extractedData);
    const aiResponse = await openaiService.generateStructuredResponse(aiPrompt, {
      type: "object",
      properties: {
        journalEntries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entryDate: { type: "string" },
              description: { type: "string" },
              debitAccount: { type: "string" },
              creditAccount: { type: "string" },
              amount: { type: "number" },
              reference: { type: "string" }
            },
            required: ["entryDate", "description", "debitAccount", "creditAccount", "amount"]
          }
        }
      },
      required: ["journalEntries"]
    });

    // Process AI-generated entries
    for (const aiEntry of aiResponse.journalEntries) {
      const journalEntry: JournalEntry = {
        id: nanoid(),
        entryDate: aiEntry.entryDate,
        description: aiEntry.description,
        debitAccount: aiEntry.debitAccount,
        creditAccount: aiEntry.creditAccount,
        amount: aiEntry.amount,
        reference: aiEntry.reference || '',
        documentType: document.documentType || 'unknown',
        sourceDocument: document.originalName,
        tenantId,
        createdBy: userId,
        createdAt: new Date()
      };

      // Save to database - map to correct schema fields
      const journalId = `JE-${nanoid()}`;
      await storage.createJournalEntry({
        journalId: journalId,
        date: new Date(journalEntry.entryDate),
        accountCode: journalEntry.debitAccount.replace(/\s+/g, '_').toUpperCase(),
        accountName: journalEntry.debitAccount,
        debitAmount: journalEntry.amount.toString(),
        creditAmount: "0",
        narration: journalEntry.description,
        entity: 'Default',
        documentId: document.id,
        tenantId,
        createdBy: userId
      });

      // Create corresponding credit entry
      await storage.createJournalEntry({
        journalId: `${journalId}-CR`,
        date: new Date(journalEntry.entryDate),
        accountCode: journalEntry.creditAccount.replace(/\s+/g, '_').toUpperCase(),
        accountName: journalEntry.creditAccount,
        debitAmount: "0",
        creditAmount: journalEntry.amount.toString(),
        narration: journalEntry.description,
        entity: 'Default',
        documentId: document.id,
        tenantId,
        createdBy: userId
      });

      entries.push(journalEntry);
    }

    return entries;
  }

  private buildJournalGenerationPrompt(document: any, extractedData: any): string {
    // Limit data to first 3 records to avoid token limits
    const limitedRecords = extractedData.records.slice(0, 3);
    
    return `Generate journal entries for ${document.documentType}:

Data: ${JSON.stringify(limitedRecords, null, 2)}

Rules:
- Bank Statement: Debit/Credit Bank Account
- Sales Register: Debit Accounts Receivable, Credit Sales Revenue  
- Purchase Register: Debit Purchases, Credit Accounts Payable

Return JSON format:
{
  "journalEntries": [
    {
      "entryDate": "2025-01-15",
      "description": "Brief description",
      "debitAccount": "Account Name",
      "creditAccount": "Account Name", 
      "amount": 1000.00,
      "reference": "REF001"
    }
  ]
}

Generate maximum 5 entries. Use 2025-01-15 as default date.`;
  }

  async generateCSVReport(userId: string, tenantId: string): Promise<string> {
    try {
      // Get all journal entries for the user
      const journalEntries = await storage.getJournalEntries(userId);
      
      if (!journalEntries || journalEntries.length === 0) {
        throw new Error('No journal entries found. Please generate journal entries first.');
      }

      // Create CSV header
      const csvHeader = 'Date,Description,Debit Account,Credit Account,Amount,Source Document,Reference\n';
      
      // Create CSV rows
      const csvRows = journalEntries.map(entry => {
        const date = new Date(entry.entryDate || entry.createdAt).toISOString().split('T')[0];
        const description = `"${(entry.description || '').replace(/"/g, '""')}"`;
        const debitAccount = `"${(entry.debitAccount || '').replace(/"/g, '""')}"`;
        const creditAccount = `"${(entry.creditAccount || '').replace(/"/g, '""')}"`;
        const amount = entry.amount || 0;
        const sourceDocument = `"${(entry.sourceDocument || 'System Generated').replace(/"/g, '""')}"`;
        const reference = `"${(entry.reference || '').replace(/"/g, '""')}"`;
        
        return `${date},${description},${debitAccount},${creditAccount},${amount},${sourceDocument},${reference}`;
      }).join('\n');

      return csvHeader + csvRows;
      
    } catch (error) {
      console.error('Error generating CSV report:', error);
      throw new Error(`Failed to generate CSV report: ${error.message}`);
    }
  }
}

export const journalGenerationService = new JournalGenerationService();