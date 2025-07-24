import { DataExtractorService, ExtractionResult } from '../services/dataExtractor';

export interface AgentExtractionResult {
  headers: string[];
  records: any[];
  totalRecords: number;
  extractedAt: string;
  extractionMethod: 'automated' | 'manual' | 'ai_assisted';
  confidence: number;
  metadata?: {
    fileFormat: string;
    documentType: string;
    dataQuality: number;
    issues?: string[];
  };
}

export interface DatabaseMapping {
  tableName: string;
  columnMappings: { [fileColumn: string]: string };
  transformations?: { [column: string]: (value: any) => any };
  validations?: { [column: string]: (value: any) => boolean };
}

export class DataExtractionAgent {
  private dataExtractor = DataExtractorService.getInstance();
  
  private schemaMappings: { [documentType: string]: DatabaseMapping } = {
    sales_register: {
      tableName: 'sales_transactions',
      columnMappings: {
        'customer': 'customer_name',
        'customer_name': 'customer_name',
        'invoice': 'invoice_number',
        'invoice_number': 'invoice_number',
        'invoice_date': 'transaction_date',
        'date': 'transaction_date',
        'amount': 'amount',
        'total_amount': 'amount',
        'gst': 'gst_amount',
        'gst_amount': 'gst_amount',
        'total': 'total_amount'
      }
    },
    purchase_register: {
      tableName: 'purchase_transactions',
      columnMappings: {
        'vendor': 'vendor_name',
        'vendor_name': 'vendor_name',
        'supplier': 'vendor_name',
        'invoice': 'invoice_number',
        'invoice_number': 'invoice_number',
        'invoice_date': 'transaction_date',
        'date': 'transaction_date',
        'amount': 'amount',
        'total_amount': 'amount',
        'gst': 'gst_amount',
        'gst_amount': 'gst_amount',
        'total': 'total_amount'
      }
    },
    bank_statement: {
      tableName: 'bank_transactions',
      columnMappings: {
        'date': 'transaction_date',
        'transaction_date': 'transaction_date',
        'description': 'description',
        'narration': 'description',
        'debit': 'debit_amount',
        'debit_amount': 'debit_amount',
        'credit': 'credit_amount',
        'credit_amount': 'credit_amount',
        'balance': 'balance'
      }
    }
  };

  async extractData(filePath: string, documentType: string, mimeType: string): Promise<AgentExtractionResult> {
    try {
      // Use the new AI-enhanced data extractor
      const extractionResult = await this.dataExtractor.extractDataFromFile(filePath, documentType);
      
      if (!extractionResult.success) {
        return {
          headers: [],
          records: [],
          totalRecords: 0,
          extractedAt: new Date().toISOString(),
          extractionMethod: 'automated',
          confidence: 0,
          metadata: {
            fileFormat: this.getFileFormat(mimeType, filePath),
            documentType,
            dataQuality: 0,
            issues: [extractionResult.error || 'Extraction failed']
          }
        };
      }

      // Transform data using schema mappings if available
      const mapping = this.schemaMappings[extractionResult.documentType] || this.schemaMappings[documentType];
      let finalRecords = extractionResult.data;
      
      if (mapping) {
        finalRecords = this.transformRecords(extractionResult.data, mapping);
        finalRecords = this.validateRecords(finalRecords, mapping);
      }

      return {
        headers: extractionResult.headers,
        records: finalRecords,
        totalRecords: finalRecords.length,
        extractedAt: new Date().toISOString(),
        extractionMethod: extractionResult.extractionMethod === 'ai_enhanced' ? 'ai_assisted' : 'automated',
        confidence: extractionResult.confidence,
        metadata: {
          fileFormat: extractionResult.metadata?.fileFormat || this.getFileFormat(mimeType, filePath),
          documentType: extractionResult.documentType,
          dataQuality: extractionResult.metadata?.dataQuality || 0.8,
          issues: extractionResult.metadata?.issues || []
        }
      };
    } catch (error) {
      console.error('Data extraction failed:', error);
      return {
        headers: [],
        records: [],
        totalRecords: 0,
        extractedAt: new Date().toISOString(),
        extractionMethod: 'automated',
        confidence: 0,
        metadata: {
          fileFormat: this.getFileFormat(mimeType, filePath),
          documentType,
          dataQuality: 0,
          issues: [`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      };
    }
  }

  private transformRecords(records: any[], mapping: DatabaseMapping): any[] {
    return records.map(record => {
      const transformed: any = {};
      
      // Apply column mappings
      for (const [sourceColumn, targetColumn] of Object.entries(mapping.columnMappings)) {
        const value = record[sourceColumn] || record[sourceColumn.toLowerCase()] || record[sourceColumn.toUpperCase()];
        if (value !== undefined) {
          transformed[targetColumn] = value;
        }
      }
      
      // Apply transformations
      if (mapping.transformations) {
        for (const [column, transformer] of Object.entries(mapping.transformations)) {
          if (transformed[column] !== undefined) {
            try {
              transformed[column] = transformer(transformed[column]);
            } catch (error) {
              console.warn(`Transformation failed for column ${column}:`, error);
            }
          }
        }
      }
      
      return transformed;
    });
  }

  private validateRecords(records: any[], mapping: DatabaseMapping): any[] {
    if (!mapping.validations) return records;
    
    return records.filter(record => {
      for (const [column, validator] of Object.entries(mapping.validations)) {
        if (record[column] !== undefined && !validator(record[column])) {
          return false;
        }
      }
      return true;
    });
  }

  private parseNumeric(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleaned = value.replace(/[₹,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private parseDate(value: any): string {
    if (!value) return '';
    
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        // Try parsing Indian date formats
        const parts = value.toString().split(/[-\/]/);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY or DD-MM-YYYY
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // Month is 0-indexed
          const year = parseInt(parts[2]);
          const parsedDate = new Date(year, month, day);
          return parsedDate.toISOString().split('T')[0];
        }
        return value.toString();
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      return value.toString();
    }
  }

  private isValidDate(value: any): boolean {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private getFileFormat(mimeType: string, filePath: string): string {
    if (mimeType.includes('spreadsheet') || filePath.endsWith('.xlsx')) return 'excel';
    if (mimeType.includes('csv') || filePath.endsWith('.csv')) return 'csv';
    if (mimeType.includes('pdf') || filePath.endsWith('.pdf')) return 'pdf';
    return 'unknown';
  }
}