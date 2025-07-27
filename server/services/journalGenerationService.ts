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
          const existingEntries = await storage.getJournalEntries(document.id, tenantId);
          if (existingEntries && existingEntries.length > 0) {
            console.log(`Skipping document ${document.id} - journal entries already exist`);
            continue;
          }

          const journalEntries = await this.generateEntriesForDocument(document, userId, tenantId);
          allJournalEntries.push(...journalEntries);
          documentsProcessed++;
          
        } catch (error) {
          console.error(`Error processing document ${document.id}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to process ${document.originalName}: ${errorMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        totalEntries: 0,
        documentsProcessed: 0,
        entries: [],
        errors: [errorMessage]
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

      // Generate unique journal ID
      const journalId = `JE-${nanoid()}`;
      
      console.log('Creating journal entry with data:', {
        journalId,
        entryDate: aiEntry.entryDate,
        debitAccount: aiEntry.debitAccount,
        creditAccount: aiEntry.creditAccount,
        amount: aiEntry.amount,
        description: aiEntry.description
      });

      // Create debit entry
      const debitJournalId = `${journalId}-DR`;
      const debitEntry = {
        journalId: debitJournalId,
        date: new Date(aiEntry.entryDate),
        accountCode: aiEntry.debitAccount.replace(/\s+/g, '_').toUpperCase(),
        accountName: aiEntry.debitAccount,
        debitAmount: aiEntry.amount.toString(),
        creditAmount: "0.00",
        narration: aiEntry.description,
        entity: 'Default Company',
        documentId: document.id,
        tenantId,
        createdBy: userId
      };
      
      console.log('Debit entry object:', debitEntry);
      await storage.createJournalEntry(debitEntry);

      // Create corresponding credit entry  
      const creditJournalId = `${journalId}-CR`;
      const creditEntry = {
        journalId: creditJournalId,
        date: new Date(aiEntry.entryDate),
        accountCode: aiEntry.creditAccount.replace(/\s+/g, '_').toUpperCase(),
        accountName: aiEntry.creditAccount,
        debitAmount: "0.00",
        creditAmount: aiEntry.amount.toString(),
        narration: aiEntry.description,
        entity: 'Default Company',
        documentId: document.id,
        tenantId,
        createdBy: userId
      };
      
      console.log('Credit entry object:', creditEntry);
      await storage.createJournalEntry(creditEntry);

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

      // Get all journal entries for the tenant
      const journalEntries = await storage.getJournalEntries(undefined, tenantId);
      
      if (!journalEntries || journalEntries.length === 0) {
        throw new Error('No journal entries found. Please generate journal entries first.');
      }

      // Create CSV header
      const csvHeader = 'Date,Description,Debit Account,Credit Account,Amount,Source Document,Reference\n';
      
      // Create CSV rows
      const csvRows = journalEntries.map(entry => {
        const date = new Date(entry.date || entry.createdAt || new Date()).toISOString().split('T')[0];
        const description = `"${(entry.narration || '').replace(/"/g, '""')}"`;
        const debitAccount = entry.debitAmount && entry.debitAmount !== '0.00' ? `"${entry.accountName}"` : `""`;
        const creditAccount = entry.creditAmount && entry.creditAmount !== '0.00' ? `"${entry.accountName}"` : `""`;
        const amount = entry.debitAmount && entry.debitAmount !== '0.00' ? entry.debitAmount : entry.creditAmount || '0.00';
        const sourceDocument = `"System Generated"`;
        const reference = `"${entry.journalId || ''}"`;
        
        return `${date},${description},${debitAccount},${creditAccount},${amount},${sourceDocument},${reference}`;
      }).join('\n');

      return csvHeader + csvRows;
      
    } catch (error) {
      console.error('Error generating CSV report:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate CSV report: ${errorMessage}`);
    }
  }
}

export const journalGenerationService = new JournalGenerationService();