import { ClassifierAgent, ClassificationResult } from './ClassifierAgent';
import { DataExtractionAgent, AgentExtractionResult } from './DataExtractionAgent';
import { storage } from '../storage';
import { aiServiceIntegration } from '../services/aiServiceIntegration';
import { BankStatementDataService } from '../services/bankStatementDataService';

export interface ProcessingResult {
  documentId: string;
  classification: ClassificationResult;
  extraction: AgentExtractionResult;
  databaseRecords: any[];
  processingStatus: 'success' | 'partial' | 'failed';
  processingTime: number;
  errors?: string[];
  journalEntriesGenerated?: number;
  aiEnhanced?: boolean;
  rawTextContent?: string;
  bankStatementStorage?: {
    recordsStored: number;
    skippedRecords: number;
    totalRecords: number;
    errors: string[];
  };
}

export class AgentOrchestrator {
  private classifierAgent: ClassifierAgent;
  private dataExtractionAgent: DataExtractionAgent;

  constructor() {
    this.classifierAgent = new ClassifierAgent();
    this.dataExtractionAgent = new DataExtractionAgent();
  }

  async processDocument(
    documentId: string,
    filePath: string,
    fileName: string,
    mimeType: string,
    userId: string,
    tenantId: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`Starting agent processing for document: ${documentId}`);

    try {
      // Debug: Check AI service integration status
      console.log('🔍 Checking AI service integration status...');
      const aiStatus = aiServiceIntegration.getStatus();
      console.log('AI Service Status:', aiStatus);

      // Try AI service first, fallback to existing agents
      console.log('🤖 Attempting AI-enhanced processing...');
      const aiResult = await aiServiceIntegration.processDocument(
        filePath,
        fileName,
        mimeType,
        async (path) => {
          // Fallback function using existing agents
          console.log('🔄 Using fallback agent processing...');
          const classification = await this.classifierAgent.classifyDocument(path, fileName, mimeType);
          const extraction = await this.dataExtractionAgent.extractData(path, classification.documentType, mimeType);

          return {
            classificationType: classification.documentType,
            classificationConfidence: classification.confidence,
            extractedRecords: extraction.totalRecords,
            extractionConfidence: extraction.confidence,
            extractedData: extraction.records
          };
        }
      );

      console.log('📊 Processing result:', {
        aiEnhanced: aiResult.aiEnhanced,
        classificationType: aiResult.classificationType,
        classificationConfidence: aiResult.classificationConfidence,
        extractedRecords: aiResult.extractedRecords,
        extractionConfidence: aiResult.extractionConfidence
      });

      // Convert AI result to legacy format for compatibility
      const classification: ClassificationResult = {
        documentType: aiResult.classificationType,
        confidence: aiResult.classificationConfidence,
        reasoning: aiResult.aiEnhanced ? 'AI-enhanced classification' : 'Pattern-based classification',
        keyIndicators: [],
        contentSummary: `Processed with ${aiResult.aiEnhanced ? 'AI enhancement' : 'fallback processing'}`
      };

      const extraction: AgentExtractionResult = {
        headers: aiResult.extractedData.length > 0 ? Object.keys(aiResult.extractedData[0]) : [],
        records: aiResult.extractedData,
        totalRecords: aiResult.extractedRecords,
        extractedAt: new Date().toISOString(),
        extractionMethod: aiResult.aiEnhanced ? 'ai_assisted' : 'automated',
        confidence: aiResult.extractionConfidence,
        metadata: {
          fileFormat: mimeType,
          documentType: aiResult.classificationType,
          dataQuality: aiResult.extractionConfidence,
          issues: []
        }
      };

      // Update document with classification
      await storage.updateDocument(documentId, {
        documentType: classification.documentType as any,
        status: 'classified',
        metadata: {
          contentAnalysis: classification,
          classificationMethod: aiResult.aiEnhanced ? 'ai_enhanced' : 'agent_pipeline',
          aiEnhanced: aiResult.aiEnhanced
        }
      });

      // Step 3: Prepare database records
      console.log('Step 3: Database Mapping');
      const databaseRecords = extraction.records || [];

      // Step 4: Update document with extracted data
      await storage.updateDocument(documentId, {
        status: 'extracted',
        extractedData: {
          ...extraction,
          databaseMapping: databaseRecords,
          aiEnhanced: aiResult.aiEnhanced
        }
      });

      // Step 4.5: Store bank statement data in dedicated table
      let bankStatementStorage = undefined;
      if (classification.documentType === 'bank_statement' && extraction.records && extraction.records.length > 0) {
        console.log('Step 4.5: Bank Statement Data Storage');
        console.log(`📊 Processing ${extraction.records.length} bank statement records for storage`);

        try {
          // Process and validate extracted data
          const processedData = await BankStatementDataService.processExtractedData(
            extraction.records,
            documentId,
            tenantId
          );

          console.log(`✅ Processed data: ${processedData.validRecords.length} valid, ${processedData.skippedRecords} skipped`);

          // Store valid records in database
          if (processedData.validRecords.length > 0) {
            const storageResult = await BankStatementDataService.storeRecords(processedData, documentId);

            if (storageResult.success) {
              console.log(`💾 Successfully stored ${storageResult.recordsStored} bank statement records`);

              // Update document status to indicate successful storage
              await storage.updateDocument(documentId, {
                status: 'completed',
                metadata: {
                  ...extraction,
                  bankStatementDataStored: true,
                  recordsStored: storageResult.recordsStored,
                  aiEnhanced: aiResult.aiEnhanced
                }
              });
            } else {
              console.error(`❌ Failed to store bank statement records: ${storageResult.error}`);
            }

            bankStatementStorage = {
              recordsStored: storageResult.recordsStored,
              skippedRecords: processedData.skippedRecords,
              totalRecords: processedData.totalRecords,
              errors: [...processedData.errors, ...(storageResult.error ? [storageResult.error] : [])]
            };
          } else {
            console.log('⚠️ No valid bank statement records to store');
            bankStatementStorage = {
              recordsStored: 0,
              skippedRecords: processedData.skippedRecords,
              totalRecords: processedData.totalRecords,
              errors: processedData.errors
            };
          }
        } catch (error) {
          console.error('❌ Bank statement data storage failed:', error);
          bankStatementStorage = {
            recordsStored: 0,
            skippedRecords: 0,
            totalRecords: extraction.records.length,
            errors: [`Storage failed: ${error.message}`]
          };
        }
      }

      // Step 5: Generate journal entries for financial documents
      console.log('Step 5: Journal Entry Generation');
      const journalEntries = await this.generateJournalEntries(
        classification.documentType,
        extraction.records,
        documentId,
        userId,
        tenantId
      );

      console.log(`Generated ${journalEntries.length} journal entries for document ${documentId}`);
      
      // Step 5: Create audit trail
      await storage.createAuditTrail({
        action: 'agent_processing_completed',
        entityType: 'document',
        entityId: documentId,
        userId,
        tenantId,
        details: {
          classification: {
            type: classification.documentType,
            confidence: classification.confidence
          },
          extraction: {
            totalRecords: extraction.totalRecords,
            confidence: extraction.confidence
          },
          processingTime: Date.now() - startTime
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      console.log(`Agent processing completed for ${documentId} in ${processingTime}ms`);
      
      return {
        documentId,
        classification,
        extraction,
        databaseRecords,
        processingStatus: 'success',
        processingTime,
        errors: errors.length > 0 ? errors : undefined,
        journalEntriesGenerated: journalEntries.length,
        aiEnhanced: aiResult.aiEnhanced,
        rawTextContent: aiResult.rawTextContent,
        bankStatementStorage
      };
      
    } catch (error) {
      console.error(`Agent processing failed for ${documentId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update document status to failed
      await storage.updateDocument(documentId, {
        status: 'failed',
        validationErrors: {
          agentProcessingError: errorMessage,
          timestamp: new Date().toISOString()
        }
      });
      
      // Create audit trail for failure
      await storage.createAuditTrail({
        action: 'agent_processing_failed',
        entityType: 'document',
        entityId: documentId,
        userId,
        tenantId,
        details: {
          error: errorMessage,
          processingTime: Date.now() - startTime
        }
      });
      
      throw error;
    }
  }

  async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    console.log(`Reprocessing document: ${documentId}`);
    
    // Get document details
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    // Reset document status
    await storage.updateDocument(documentId, {
      status: 'uploaded',
      extractedData: null,
      validationErrors: null
    });
    
    // Process again
    return this.processDocument(
      documentId,
      document.filePath,
      document.originalName,
      document.mimeType,
      document.uploadedBy,
      document.tenantId
    );
  }

  async getProcessingStatus(documentId: string): Promise<{
    status: string;
    classification?: ClassificationResult;
    extraction?: AgentExtractionResult | null;
    lastProcessed?: string;
  }> {
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    return {
      status: document.status,
      classification: document.metadata?.contentAnalysis,
      extraction: document.extractedData,
      lastProcessed: document.updatedAt?.toISOString()
    };
  }

  async bulkProcessDocuments(
    documentIds: string[],
    options: {
      maxConcurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<ProcessingResult[]> {
    const { maxConcurrency = 3, onProgress } = options;
    const results: ProcessingResult[] = [];
    
    console.log(`Starting bulk processing of ${documentIds.length} documents`);
    
    // Process documents in batches to avoid overwhelming the system
    for (let i = 0; i < documentIds.length; i += maxConcurrency) {
      const batch = documentIds.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (documentId) => {
        try {
          const document = await storage.getDocument(documentId);
          if (!document) {
            throw new Error(`Document not found: ${documentId}`);
          }
          
          return await this.processDocument(
            documentId,
            document.filePath,
            document.originalName,
            document.mimeType,
            document.uploadedBy,
            document.tenantId
          );
        } catch (error) {
          console.error(`Bulk processing failed for document ${documentId}:`, error);
          return {
            documentId,
            classification: {} as ClassificationResult,
            extraction: {} as AgentExtractionResult,
            databaseRecords: [],
            processingStatus: 'failed' as const,
            processingTime: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(results.length, documentIds.length);
      }
    }
    
    console.log(`Bulk processing completed: ${results.length} documents processed`);
    return results;
  }

  async getAgentStatistics(): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    documentTypeBreakdown: { [type: string]: number };
    recentActivity: any[];
  }> {
    // This would typically query the database for statistics
    // For now, we'll return mock data that can be replaced with real queries
    
    return {
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      documentTypeBreakdown: {},
      recentActivity: []
    };
  }

  /**
   * Generate journal entries for financial documents following double-entry bookkeeping
   */
  private async generateJournalEntries(
    documentType: string,
    extractedRecords: any[],
    documentId: string,
    userId: string,
    tenantId: string
  ): Promise<any[]> {
    const journalEntries: any[] = [];

    try {
      if (documentType === 'bank_statement') {
        // Generate journal entries for bank statement transactions
        for (const record of extractedRecords) {
          const debitAmount = parseFloat(record.debitAmount || record.debit_amount || '0');
          const creditAmount = parseFloat(record.creditAmount || record.credit_amount || '0');
          const description = record.description || record.transaction_description || 'Bank Transaction';
          const transactionDate = record.date || record.transaction_date || new Date().toISOString().split('T')[0];

          if (debitAmount > 0) {
            // Money going out - Debit expense/asset, Credit bank
            const journalEntry = await storage.createJournalEntry({
              documentId,
              entryDate: transactionDate,
              description: `Bank Debit: ${description}`,
              debitAccount: 'Expenses',
              creditAccount: 'Bank Account',
              amount: debitAmount,
              reference: record.transactionId || record.reference_no || '',
              tenantId,
              createdBy: userId
            });
            journalEntries.push(journalEntry);
          }

          if (creditAmount > 0) {
            // Money coming in - Debit bank, Credit revenue/liability
            const journalEntry = await storage.createJournalEntry({
              documentId,
              entryDate: transactionDate,
              description: `Bank Credit: ${description}`,
              debitAccount: 'Bank Account',
              creditAccount: 'Revenue',
              amount: creditAmount,
              reference: record.transactionId || record.reference_no || '',
              tenantId,
              createdBy: userId
            });
            journalEntries.push(journalEntry);
          }
        }
      } else if (documentType === 'sales_register' || documentType === 'gst') {
        // Generate journal entries for sales transactions
        for (const record of extractedRecords) {
          const totalAmount = parseFloat(record.totalAmount || record.total_amount || '0');
          const customerName = record.customerName || record.customer_name || 'Customer';
          const invoiceDate = record.date || record.invoice_date || new Date().toISOString().split('T')[0];

          if (totalAmount > 0) {
            // Sales transaction - Debit Accounts Receivable, Credit Sales Revenue
            const journalEntry = await storage.createJournalEntry({
              documentId,
              entryDate: invoiceDate,
              description: `Sales Invoice: ${customerName}`,
              debitAccount: 'Accounts Receivable',
              creditAccount: 'Sales Revenue',
              amount: totalAmount,
              reference: record.invoiceNo || record.invoice_no || '',
              tenantId,
              createdBy: userId
            });
            journalEntries.push(journalEntry);
          }
        }
      } else if (documentType === 'purchase_register') {
        // Generate journal entries for purchase transactions
        for (const record of extractedRecords) {
          const totalAmount = parseFloat(record.totalAmount || record.total_amount || '0');
          const vendorName = record.vendorName || record.vendor_name || 'Vendor';
          const purchaseDate = record.date || record.purchase_date || new Date().toISOString().split('T')[0];

          if (totalAmount > 0) {
            // Purchase transaction - Debit Purchases/Inventory, Credit Accounts Payable
            const journalEntry = await storage.createJournalEntry({
              documentId,
              entryDate: purchaseDate,
              description: `Purchase Invoice: ${vendorName}`,
              debitAccount: 'Purchases',
              creditAccount: 'Accounts Payable',
              amount: totalAmount,
              reference: record.billNo || record.bill_no || '',
              tenantId,
              createdBy: userId
            });
            journalEntries.push(journalEntry);
          }
        }
      }

      console.log(`✅ Generated ${journalEntries.length} journal entries for ${documentType}`);
      return journalEntries;

    } catch (error) {
      console.error('❌ Error generating journal entries:', error);
      return [];
    }
  }
}