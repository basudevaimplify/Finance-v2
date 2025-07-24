/**
 * AI Service Integration
 * Handles communication with FastAPI AI microservice
 */

import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { Readable } from 'stream';

// FastAPI service configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = 30000; // 30 seconds

// Type definitions matching FastAPI response models
interface ClassificationResult {
  document_type: string;
  confidence: number;
  reasoning: string;
  key_indicators: string[];
  content_summary: string;
  potential_misclassification: boolean;
}

interface ExtractedRecord {
  row_index: number;
  data: Record<string, any>;
  confidence: number;
}

interface ExtractionResult {
  records: ExtractedRecord[];
  total_records: number;
  extraction_confidence: number;
  schema_detected: Record<string, string>;
  processing_notes: string[];
}

interface DocumentProcessingResponse {
  classification: ClassificationResult;
  extraction: ExtractionResult;
  processing_time_ms: number;
  ai_enhanced: boolean;
}

interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  openai_available: boolean;
}

class AIServiceIntegration {
  private baseURL: string;
  private timeout: number;
  private isAvailable: boolean = false;

  constructor() {
    this.baseURL = AI_SERVICE_URL;
    this.timeout = AI_SERVICE_TIMEOUT;
    this.checkServiceHealth();
  }

  /**
   * Check if AI service is available
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const response: AxiosResponse<HealthCheckResponse> = await axios.get(
        `${this.baseURL}/health`,
        { timeout: 5000 }
      );
      
      this.isAvailable = response.status === 200 && response.data.status === 'healthy';
      
      if (this.isAvailable) {
        console.log('✅ AI Service is available:', response.data.service);
        console.log('🤖 OpenAI available:', response.data.openai_available);
      }
      
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      console.log('⚠️  AI Service not available, using fallback processing');
      return false;
    }
  }

  /**
   * Classify document using AI service
   */
  async classifyDocument(filePath: string, originalName: string, mimeType: string): Promise<ClassificationResult | null> {
    if (!this.isAvailable) {
      await this.checkServiceHealth();
      if (!this.isAvailable) {
        return null;
      }
    }

    try {
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      formData.append('file', fileStream, {
        filename: originalName,
        contentType: mimeType
      });

      const response: AxiosResponse<ClassificationResult> = await axios.post(
        `${this.baseURL}/classify/document`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.timeout
        }
      );

      console.log('🎯 AI Classification result:', {
        type: response.data.document_type,
        confidence: response.data.confidence,
        reasoning: response.data.reasoning
      });

      return response.data;
    } catch (error) {
      console.error('❌ AI Classification failed:', error.message);
      return null;
    }
  }

  /**
   * Extract document data using AI service
   */
  async extractDocumentData(filePath: string, originalName: string, mimeType: string): Promise<DocumentProcessingResponse | null> {
    if (!this.isAvailable) {
      await this.checkServiceHealth();
      if (!this.isAvailable) {
        return null;
      }
    }

    try {
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      formData.append('file', fileStream, {
        filename: originalName,
        contentType: mimeType
      });

      const response: AxiosResponse<DocumentProcessingResponse> = await axios.post(
        `${this.baseURL}/extract/document`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: this.timeout
        }
      );

      console.log('📊 AI Extraction result:', {
        type: response.data.classification.document_type,
        classification_confidence: response.data.classification.confidence,
        records_extracted: response.data.extraction.total_records,
        extraction_confidence: response.data.extraction.extraction_confidence,
        processing_time: response.data.processing_time_ms,
        ai_enhanced: response.data.ai_enhanced
      });

      return response.data;
    } catch (error) {
      console.error('❌ AI Extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Convert AI service response to legacy format for compatibility
   */
  convertToLegacyFormat(aiResponse: DocumentProcessingResponse): {
    classificationType: string;
    classificationConfidence: number;
    extractedRecords: number;
    extractionConfidence: number;
    extractedData: any[];
  } {
    const extractedData = aiResponse.extraction.records.map(record => ({
      id: `ai-record-${record.row_index}`,
      ...record.data,
      confidence: record.confidence,
      source: 'ai_enhanced'
    }));

    return {
      classificationType: aiResponse.classification.document_type,
      classificationConfidence: aiResponse.classification.confidence,
      extractedRecords: aiResponse.extraction.total_records,
      extractionConfidence: aiResponse.extraction.extraction_confidence,
      extractedData
    };
  }

  /**
   * Enhanced document processing with AI fallback
   */
  async processDocument(
    filePath: string, 
    originalName: string, 
    mimeType: string,
    fallbackProcessor?: (filePath: string) => Promise<any>
  ): Promise<{
    classificationType: string;
    classificationConfidence: number;
    extractedRecords: number;
    extractionConfidence: number;
    extractedData: any[];
    aiEnhanced: boolean;
  }> {
    // Try AI service first
    const aiResult = await this.extractDocumentData(filePath, originalName, mimeType);
    
    if (aiResult) {
      const legacyFormat = this.convertToLegacyFormat(aiResult);
      return {
        ...legacyFormat,
        aiEnhanced: true
      };
    }

    // Fallback to existing processor
    if (fallbackProcessor) {
      console.log('🔄 Using fallback processor...');
      try {
        const fallbackResult = await fallbackProcessor(filePath);
        return {
          classificationType: fallbackResult.classificationType || 'other',
          classificationConfidence: fallbackResult.classificationConfidence || 0.5,
          extractedRecords: fallbackResult.extractedRecords || 0,
          extractionConfidence: fallbackResult.extractionConfidence || 0.5,
          extractedData: fallbackResult.extractedData || [],
          aiEnhanced: false
        };
      } catch (error) {
        console.error('❌ Fallback processor failed:', error);
        return {
          classificationType: 'other',
          classificationConfidence: 0.2,
          extractedRecords: 0,
          extractionConfidence: 0.0,
          extractedData: [],
          aiEnhanced: false
        };
      }
    }

    // Default response if everything fails
    return {
      classificationType: 'other',
      classificationConfidence: 0.2,
      extractedRecords: 0,
      extractionConfidence: 0.0,
      extractedData: [],
      aiEnhanced: false
    };
  }

  /**
   * Get service status
   */
  getStatus(): {
    available: boolean;
    url: string;
    lastChecked: string;
  } {
    return {
      available: this.isAvailable,
      url: this.baseURL,
      lastChecked: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const aiServiceIntegration = new AIServiceIntegration();

// Export types for use in other modules
export type {
  ClassificationResult,
  ExtractedRecord,
  ExtractionResult,
  DocumentProcessingResponse,
  HealthCheckResponse
};
