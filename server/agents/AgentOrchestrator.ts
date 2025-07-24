import { ClassifierAgent, ClassificationResult } from './ClassifierAgent';
import { DataExtractionAgent, AgentExtractionResult } from './DataExtractionAgent';
import { storage } from '../storage';

export interface ProcessingResult {
  documentId: string;
  classification: ClassificationResult;
  extraction: AgentExtractionResult;
  databaseRecords: any[];
  processingStatus: 'success' | 'partial' | 'failed';
  processingTime: number;
  errors?: string[];
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
      // Step 1: Classify the document
      console.log('Step 1: Document Classification');
      const classification = await this.classifierAgent.classifyDocument(filePath, fileName, mimeType);
      
      // Update document with classification
      await storage.updateDocument(documentId, {
        documentType: classification.documentType as any,
        status: 'classified',
        metadata: {
          contentAnalysis: classification,
          classificationMethod: 'agent_pipeline'
        }
      });
      
      // Step 2: Extract data from the document
      console.log('Step 2: Data Extraction');
      const extraction = await this.dataExtractionAgent.extractData(
        filePath,
        classification.documentType,
        mimeType
      );
      
      // Step 3: Prepare database records
      console.log('Step 3: Database Mapping');
      const databaseRecords = extraction.records || [];
      
      // Step 4: Update document with extracted data
      await storage.updateDocument(documentId, {
        status: 'extracted',
        extractedData: {
          ...extraction,
          databaseMapping: databaseRecords
        }
      });
      
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
        errors: errors.length > 0 ? errors : undefined
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
    extraction?: ExtractionResult;
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
            extraction: {} as ExtractionResult,
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
}