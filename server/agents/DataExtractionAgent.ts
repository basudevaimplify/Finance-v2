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
      console.log(`🔍 DataExtractionAgent: Processing ${documentType} file: ${filePath}`);
      
      // Use the new AI-enhanced data extractor
      const extractionResult = await this.dataExtractor.extractDataFromFile(filePath, documentType);
      
      console.log(`📊 Raw extraction result:`, {
        success: extractionResult.success,
        dataLength: extractionResult.data?.length || 0,
        headersLength: extractionResult.headers?.length || 0,
        firstRecord: extractionResult.data?.[0] || 'none'
      });
      
      if (!extractionResult.success) {
        console.log('❌ Extraction failed:', extractionResult.error);
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

      // For rich CSV data, preserve all original columns without restrictive mapping
      let finalRecords = extractionResult.data;
      
      console.log(`🔧 Processing ${finalRecords.length} records with ${extractionResult.headers.length} columns`);
      console.log(`📋 Original headers:`, extractionResult.headers);
      console.log(`📝 Sample record before processing:`, finalRecords[0] || 'none');
      
      // Only apply minimal mapping for backward compatibility, but preserve all data
      const mapping = this.schemaMappings[extractionResult.documentType] || this.schemaMappings[documentType];
      
      if (mapping && extractionResult.headers.length <= 5) {
        // Only apply restrictive mapping for simple files (5 columns or less)
        console.log(`📝 Applying restrictive mapping to simple file with ${extractionResult.headers.length} columns`);
        finalRecords = this.transformRecords(extractionResult.data, mapping);
        finalRecords = this.validateRecords(finalRecords, mapping);
      } else {
        // For rich CSV files with many columns, preserve all data and add standard mappings
        console.log(`📝 Preserving all data for rich file with ${extractionResult.headers.length} columns`);
        if (mapping) {
          finalRecords = this.addStandardMappings(extractionResult.data, mapping);
        }
      }
      
      console.log(`📝 Final processing result:`, {
        recordCount: finalRecords.length,
        columnCount: Object.keys(finalRecords[0] || {}).length,
        sampleRecord: finalRecords[0] || 'none'
      });

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
    console.log(`🔄 Transforming ${records.length} records using mapping:`, mapping.columnMappings);
    
    return records.map((record, index) => {
      console.log(`📝 Original record ${index + 1}:`, record);
      
      // PRESERVE ALL ORIGINAL COLUMNS - don't lose any data
      const transformed: any = { ...record };
      
      // Apply column mappings with case-insensitive matching (ADD mapped columns, don't replace)
      for (const [sourceColumn, targetColumn] of Object.entries(mapping.columnMappings)) {
        // Try exact match first, then case variations
        let value = record[sourceColumn];
        
        if (value === undefined) {
          // Try case-insensitive matching
          const recordKeys = Object.keys(record);
          const matchingKey = recordKeys.find(key => key.toLowerCase() === sourceColumn.toLowerCase());
          if (matchingKey) {
            value = record[matchingKey];
          }
        }
        
        if (value !== undefined && value !== null && value !== '') {
          // Add mapped column (keep original too)
          transformed[targetColumn] = value;
          console.log(`✅ Mapped ${sourceColumn} → ${targetColumn}: ${value}`);
        } else {
          console.log(`❌ No value found for ${sourceColumn} (maps to ${targetColumn})`);
        }
      }
      
      // Apply transformations
      if (mapping.transformations) {
        for (const [column, transformer] of Object.entries(mapping.transformations)) {
          if (transformed[column] !== undefined) {
            try {
              const originalValue = transformed[column];
              transformed[column] = transformer(transformed[column]);
              console.log(`🔧 Transformed ${column}: ${originalValue} → ${transformed[column]}`);
            } catch (error) {
              console.warn(`❌ Transformation failed for column ${column}:`, error);
            }
          }
        }
      }
      
      console.log(`✅ Transformed record ${index + 1} (preserving ${Object.keys(record).length} original + ${Object.keys(mapping.columnMappings).length} mapped columns):`, transformed);
      return transformed;
    });
  }

  private addStandardMappings(records: any[], mapping: DatabaseMapping): any[] {
    console.log(`🔄 Adding standard mappings to ${records.length} records while preserving all data`);
    
    return records.map((record, index) => {
      // Start with all original data preserved
      const enhanced: any = { ...record };
      
      // Add standard mappings for common fields (but keep originals)
      for (const [sourceColumn, targetColumn] of Object.entries(mapping.columnMappings)) {
        // Try exact match first, then case-insensitive matching
        let value = record[sourceColumn];
        
        if (value === undefined) {
          const recordKeys = Object.keys(record);
          const matchingKey = recordKeys.find(key => key.toLowerCase() === sourceColumn.toLowerCase());
          if (matchingKey) {
            value = record[matchingKey];
          }
        }
        
        if (value !== undefined && value !== null && value !== '') {
          enhanced[targetColumn] = value;
          console.log(`✅ Added mapping ${sourceColumn} → ${targetColumn}: ${value}`);
        }
      }
      
      console.log(`✅ Enhanced record ${index + 1}: ${Object.keys(record).length} original + ${Object.keys(mapping.columnMappings).length} mapped = ${Object.keys(enhanced).length} total columns`);
      return enhanced;
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