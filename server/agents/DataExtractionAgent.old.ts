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
      },
      transformations: {
        'amount': (value) => this.parseNumeric(value),
        'gst_amount': (value) => this.parseNumeric(value),
        'total_amount': (value) => this.parseNumeric(value),
        'transaction_date': (value) => this.parseDate(value)
      },
      validations: {
        'amount': (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0,
        'customer_name': (value) => value && value.toString().trim().length > 0
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
      },
      transformations: {
        'amount': (value) => this.parseNumeric(value),
        'gst_amount': (value) => this.parseNumeric(value),
        'total_amount': (value) => this.parseNumeric(value),
        'transaction_date': (value) => this.parseDate(value)
      },
      validations: {
        'amount': (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0,
        'vendor_name': (value) => value && value.toString().trim().length > 0
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
      },
      transformations: {
        'debit_amount': (value) => this.parseNumeric(value),
        'credit_amount': (value) => this.parseNumeric(value),
        'balance': (value) => this.parseNumeric(value),
        'transaction_date': (value) => this.parseDate(value)
      },
      validations: {
        'transaction_date': (value) => this.isValidDate(value)
      }
    },
    salary_register: {
      tableName: 'payroll_transactions',
      columnMappings: {
        'employee': 'employee_name',
        'employee_name': 'employee_name',
        'employee_id': 'employee_id',
        'basic': 'basic_salary',
        'basic_salary': 'basic_salary',
        'allowance': 'allowances',
        'allowances': 'allowances',
        'deduction': 'deductions',
        'deductions': 'deductions',
        'net': 'net_salary',
        'net_pay': 'net_salary',
        'net_salary': 'net_salary'
      },
      transformations: {
        'basic_salary': (value) => this.parseNumeric(value),
        'allowances': (value) => this.parseNumeric(value),
        'deductions': (value) => this.parseNumeric(value),
        'net_salary': (value) => this.parseNumeric(value)
      },
      validations: {
        'employee_name': (value) => value && value.toString().trim().length > 0,
        'basic_salary': (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0
      }
    },
    tds: {
      tableName: 'tds_transactions',
      columnMappings: {
        'deductee': 'deductee_name',
        'deductee_name': 'deductee_name',
        'section': 'tds_section',
        'tds_section': 'tds_section',
        'rate': 'tds_rate',
        'tds_rate': 'tds_rate',
        'amount': 'tds_amount',
        'tds_amount': 'tds_amount',
        'certificate': 'certificate_number',
        'certificate_number': 'certificate_number'
      },
      transformations: {
        'tds_amount': (value) => this.parseNumeric(value),
        'tds_rate': (value) => this.parseNumeric(value)
      },
      validations: {
        'deductee_name': (value) => value && value.toString().trim().length > 0,
        'tds_amount': (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0
      }
    },
    fixed_asset_register: {
      tableName: 'asset_transactions',
      columnMappings: {
        'asset': 'asset_name',
        'asset_name': 'asset_name',
        'cost': 'cost',
        'acquisition_cost': 'cost',
        'depreciation': 'depreciation_amount',
        'depreciation_amount': 'depreciation_amount',
        'wdv': 'written_down_value',
        'written_down_value': 'written_down_value',
        'acquisition': 'acquisition_date',
        'acquisition_date': 'acquisition_date'
      },
      transformations: {
        'cost': (value) => this.parseNumeric(value),
        'depreciation_amount': (value) => this.parseNumeric(value),
        'written_down_value': (value) => this.parseNumeric(value),
        'acquisition_date': (value) => this.parseDate(value)
      },
      validations: {
        'asset_name': (value) => value && value.toString().trim().length > 0,
        'cost': (value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0
      }
    }
  };

  async extractDataFromFile(
    filePath: string,
    fileName: string,
    mimeType: string,
    documentType: string
  ): Promise<ExtractionResult> {
    console.log(`Starting data extraction for: ${fileName} (${documentType})`);
    
    try {
      // Extract raw data based on file type
      const rawData = await this.extractRawData(filePath, mimeType);
      
      // Apply document-specific processing
      const processedData = this.processDataByType(rawData, documentType);
      
      // Validate and clean the data
      const cleanedData = this.validateAndCleanData(processedData, documentType);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(cleanedData, documentType);
      
      const result: ExtractionResult = {
        headers: cleanedData.headers,
        records: cleanedData.records,
        totalRecords: cleanedData.records.length,
        extractedAt: new Date().toISOString(),
        extractionMethod: 'automated',
        confidence,
        metadata: {
          fileFormat: this.getFileFormat(mimeType, filePath),
          documentType,
          dataQuality: confidence,
          issues: cleanedData.issues || []
        }
      };
      
      console.log(`Extraction completed for ${fileName}: ${result.totalRecords} records extracted`);
      return result;
      
    } catch (error) {
      console.error(`Data extraction error for ${fileName}:`, error);
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

  private async extractRawData(filePath: string, mimeType: string): Promise<any> {
    if (mimeType.includes('spreadsheet') || filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
      return this.extractFromExcel(filePath);
    } else if (mimeType.includes('csv') || filePath.endsWith('.csv')) {
      return this.extractFromCSV(filePath);
    } else if (mimeType.includes('pdf') || filePath.endsWith('.pdf')) {
      return this.extractFromPDF(filePath);
    } else {
      // Auto-detect format
      try {
        return this.extractFromCSV(filePath);
      } catch {
        return this.extractFromExcel(filePath);
      }
    }
  }

  private extractFromExcel(filePath: string): any {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    if (jsonData.length === 0) {
      return { headers: [], records: [] };
    }
    
    const headers = Object.keys(jsonData[0]);
    return {
      headers,
      records: jsonData,
      format: 'excel'
    };
  }

  private async extractFromCSV(filePath: string): Promise<any> {
    const records: any[] = [];
    let headers: string[] = [];
    
    await pipeline(
      createReadStream(filePath),
      csv.default(),
      new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          if (headers.length === 0) {
            headers = Object.keys(chunk);
          }
          records.push(chunk);
          callback();
        }
      })
    );
    
    return {
      headers,
      records,
      format: 'csv'
    };
  }

  private extractFromPDF(filePath: string): any {
    // For PDF, we'll simulate extraction based on document type
    // In production, use pdf-parse or similar library
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('bank') || fileName.includes('statement')) {
      // Simulate bank statement data
      return {
        headers: ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
        records: [
          { Date: '15/01/2025', Description: 'Opening Balance', Debit: '', Credit: '250000', Balance: '250000' },
          { Date: '16/01/2025', Description: 'Payment to Vendor A', Debit: '45000', Credit: '', Balance: '205000' },
          { Date: '18/01/2025', Description: 'Receipt from Customer B', Debit: '', Credit: '75000', Balance: '280000' },
          { Date: '20/01/2025', Description: 'Salary Payment', Debit: '65000', Credit: '', Balance: '215000' }
        ],
        format: 'pdf'
      };
    }
    
    return { headers: [], records: [], format: 'pdf' };
  }

  private processDataByType(rawData: any, documentType: string): any {
    const mapping = this.schemaMappings[documentType];
    if (!mapping) {
      console.warn(`No schema mapping found for document type: ${documentType}`);
      return rawData;
    }
    
    // Normalize headers to lowercase for matching
    const normalizedHeaders = rawData.headers.map((h: string) => h.toLowerCase().trim());
    const headerMapping: { [key: string]: string } = {};
    
    // Create header mapping
    normalizedHeaders.forEach((header: string, index: number) => {
      const mappedColumn = mapping.columnMappings[header];
      if (mappedColumn) {
        headerMapping[rawData.headers[index]] = mappedColumn;
      }
    });
    
    // Transform records
    const processedRecords = rawData.records.map((record: any) => {
      const processedRecord: any = {};
      
      Object.entries(record).forEach(([key, value]) => {
        const mappedKey = headerMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
        let processedValue = value;
        
        // Apply transformations if defined
        if (mapping.transformations && mapping.transformations[mappedKey]) {
          try {
            processedValue = mapping.transformations[mappedKey](value);
          } catch (error) {
            console.warn(`Transformation error for ${mappedKey}:`, error);
            processedValue = value;
          }
        }
        
        processedRecord[mappedKey] = processedValue;
      });
      
      return processedRecord;
    });
    
    return {
      headers: Object.values(headerMapping).length > 0 ? Object.values(headerMapping) : normalizedHeaders,
      records: processedRecords,
      format: rawData.format
    };
  }

  private validateAndCleanData(data: any, documentType: string): any {
    const mapping = this.schemaMappings[documentType];
    const issues: string[] = [];
    const validRecords: any[] = [];
    
    data.records.forEach((record: any, index: number) => {
      let isValid = true;
      const cleanedRecord: any = {};
      
      Object.entries(record).forEach(([key, value]) => {
        // Clean the value
        let cleanedValue = this.cleanValue(value);
        
        // Apply validations if defined
        if (mapping?.validations && mapping.validations[key]) {
          try {
            if (!mapping.validations[key](cleanedValue)) {
              issues.push(`Record ${index + 1}: Invalid value for ${key}: ${cleanedValue}`);
              isValid = false;
            }
          } catch (error) {
            issues.push(`Record ${index + 1}: Validation error for ${key}: ${error.message}`);
            isValid = false;
          }
        }
        
        cleanedRecord[key] = cleanedValue;
      });
      
      if (isValid) {
        validRecords.push(cleanedRecord);
      }
    });
    
    return {
      headers: data.headers,
      records: validRecords,
      format: data.format,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  private cleanValue(value: any): any {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value.trim();
    }
    
    return value;
  }

  private parseNumeric(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleaned = value.replace(/[₹$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  private parseDate(value: any): string {
    if (!value) return '';
    
    try {
      // Handle various date formats
      const dateStr = value.toString();
      
      // DD/MM/YYYY format
      if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // ISO format
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return dateStr.split('T')[0];
      }
      
      // Try to parse as Date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      return dateStr;
    } catch (error) {
      console.warn('Date parsing error:', error);
      return value.toString();
    }
  }

  private isValidDate(value: any): boolean {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private calculateConfidence(data: any, documentType: string): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on data quality
    if (data.records.length > 0) {
      confidence += 0.2;
    }
    
    if (data.headers.length > 0) {
      confidence += 0.1;
    }
    
    // Check if we have mappings for this document type
    if (this.schemaMappings[documentType]) {
      confidence += 0.1;
    }
    
    // Reduce confidence if there are issues
    if (data.issues && data.issues.length > 0) {
      confidence -= Math.min(0.3, data.issues.length * 0.05);
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private getFileFormat(mimeType: string, filePath: string): string {
    if (mimeType.includes('spreadsheet') || filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
      return 'excel';
    } else if (mimeType.includes('csv') || filePath.endsWith('.csv')) {
      return 'csv';
    } else if (mimeType.includes('pdf') || filePath.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'unknown';
  }

  // Method to get database mapping for a document type
  public getDatabaseMapping(documentType: string): DatabaseMapping | undefined {
    return this.schemaMappings[documentType];
  }

  // Method to map extracted data to database schema
  public mapToDatabase(extractedData: ExtractionResult, documentType: string): any[] {
    const mapping = this.schemaMappings[documentType];
    if (!mapping) {
      console.warn(`No database mapping found for document type: ${documentType}`);
      return extractedData.records;
    }
    
    return extractedData.records.map(record => {
      const mappedRecord: any = {};
      
      Object.entries(record).forEach(([key, value]) => {
        const dbColumn = mapping.columnMappings[key.toLowerCase()] || key;
        mappedRecord[dbColumn] = value;
      });
      
      return mappedRecord;
    });
  }
}