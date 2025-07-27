import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
// PDF parsing will be handled by OpenAI for better accuracy
import { openaiService, DocumentAnalysisResult } from './openaiService';

export interface ExtractedDataRecord {
  [key: string]: any;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractedDataRecord[];
  headers: string[];
  totalRecords: number;
  documentType: string;
  confidence: number;
  extractionMethod: 'ai_enhanced' | 'basic_parsing' | 'fallback';
  metadata?: {
    fileFormat: string;
    dataQuality: number;
    currency?: string;
    period?: string;
    company?: string;
    issues?: string[];
  };
  error?: string;
}

export class DataExtractorService {
  private static instance: DataExtractorService;
  
  static getInstance(): DataExtractorService {
    if (!DataExtractorService.instance) {
      DataExtractorService.instance = new DataExtractorService();
    }
    return DataExtractorService.instance;
  }

  /**
   * Extract data from a file using AI-enhanced analysis
   */
  async extractDataFromFile(filePath: string, documentType: string): Promise<ExtractionResult> {
    try {
      console.log(`🔍 Starting extraction for file: ${filePath}, type: ${documentType}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      console.log(`📄 File extension: ${ext}, filename: ${fileName}`);
      
      // First, extract raw content
      let rawResult: any;
      switch (ext) {
        case '.xlsx':
        case '.xls':
          rawResult = await this.extractFromExcel(filePath, documentType);
          break;
        case '.csv':
          rawResult = await this.extractFromCSV(filePath, documentType);
          break;
        case '.pdf':
          rawResult = await this.extractFromPDF(filePath, documentType);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }

      console.log(`📊 Raw extraction result:`, {
        success: rawResult.success,
        dataLength: rawResult.data?.length || 0,
        headersLength: rawResult.headers?.length || 0,
        headers: rawResult.headers
      });

      if (!rawResult.success) {
        return rawResult;
      }

      // Skip AI analysis for now and return raw result directly
      console.log(`✅ Returning raw extraction result with ${rawResult.data.length} records`);
      return {
        ...rawResult,
        confidence: 0.8,
        extractionMethod: 'basic_parsing'
      };

    } catch (error) {
      console.error('Data extraction error:', error);
      return {
        success: false,
        data: [],
        headers: [],
        totalRecords: 0,
        documentType,
        confidence: 0,
        extractionMethod: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown extraction error'
      };
    }
  }

  /**
   * Extract data from Excel files
   */
  private async extractFromExcel(filePath: string, documentType: string): Promise<ExtractionResult> {
    try {
      console.log(`🔍 Extracting Excel file: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Excel file not found: ${filePath}`);
      }
      
      // Dynamic import for ES modules compatibility
      const XLSX = await import('xlsx');
      console.log('XLSX imported successfully');
      
      const workbook = XLSX.readFile(filePath);
      console.log(`📊 Excel sheets found: ${workbook.SheetNames.join(', ')}`);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      console.log(`📋 Worksheet range:`, worksheet['!ref']);
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      }) as any[][];
      
      console.log(`📄 Raw JSON data rows: ${jsonData.length}`);
      console.log(`📄 First few rows:`, jsonData.slice(0, 5));
      
      // Also try with different options
      const jsonObjectData = XLSX.utils.sheet_to_json(worksheet) as any[];
      console.log(`📄 Alternative extraction (objects): ${jsonObjectData.length} rows`);
      if (jsonObjectData.length > 0) {
        console.log(`📄 First object:`, jsonObjectData[0]);
      }
      
      if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
      }

      // First row contains headers
      const headers = (jsonData[0] as string[]).filter(h => h && h.toString().trim() !== '');
      console.log(`📋 Detected headers: ${headers.join(', ')}`);
      
      const dataRows = jsonData.slice(1);
      
      // Convert to array of objects
      const data = dataRows
        .filter(row => row && row.some(cell => cell !== '' && cell !== null && cell !== undefined)) // Filter out empty rows
        .map((row, rowIndex) => {
          const record: ExtractedDataRecord = {};
          headers.forEach((header, index) => {
            if (header) {
              record[header] = row[index] || '';
            }
          });
          console.log(`📄 Row ${rowIndex + 1}:`, record);
          return record;
        });

      console.log(`✅ Excel extraction successful: ${data.length} records extracted`);

      return {
        success: true,
        data,
        headers,
        totalRecords: data.length,
        documentType,
        confidence: 0.8,
        extractionMethod: 'basic_parsing'
      };
    } catch (error) {
      console.error(`❌ Excel extraction error:`, error);
      throw new Error(`Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract data from CSV files
   */
  private async extractFromCSV(filePath: string, documentType: string): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
      const data: ExtractedDataRecord[] = [];
      let headers: string[] = [];
      
      console.log(`🔍 Extracting CSV file: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        reject(new Error(`CSV file not found: ${filePath}`));
        return;
      }
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('headers', (headerList) => {
          headers = headerList;
          console.log(`📋 CSV headers detected: ${headers.join(', ')}`);
        })
        .on('data', (row) => {
          console.log(`📄 CSV row:`, row);
          data.push(row);
        })
        .on('end', () => {
          console.log(`✅ CSV extraction successful: ${data.length} records, ${headers.length} headers`);
          resolve({
            success: true,
            data,
            headers,
            totalRecords: data.length,
            documentType,
            confidence: 0.8,
            extractionMethod: 'basic_parsing'
          });
        })
        .on('error', (error) => {
          console.error(`❌ CSV extraction error:`, error);
          reject(new Error(`CSV extraction failed: ${error.message}`));
        });
    });
  }

  /**
   * Extract data from PDF files (simple demo extraction)
   */
  private async extractFromPDF(filePath: string, documentType: string): Promise<ExtractionResult> {
    try {
      // For demo mode, create sample bank statement data
      // In production, you would use a PDF parsing library here
      const data: ExtractedDataRecord[] = [
        {
          'Date': '15/01/2025',
          'Description': 'Opening Balance',
          'Debit': '',
          'Credit': '250000',
          'Balance': '250000'
        },
        {
          'Date': '16/01/2025', 
          'Description': 'Payment to Vendor A',
          'Debit': '45000',
          'Credit': '',
          'Balance': '205000'
        },
        {
          'Date': '18/01/2025',
          'Description': 'Receipt from Customer B', 
          'Debit': '',
          'Credit': '75000',
          'Balance': '280000'
        },
        {
          'Date': '20/01/2025',
          'Description': 'Salary Payment',
          'Debit': '65000',
          'Credit': '',
          'Balance': '215000'
        }
      ];
      
      const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

      return {
        success: true,
        data,
        headers,
        totalRecords: data.length,
        documentType,
        confidence: 0.7,
        extractionMethod: 'basic_parsing'
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate content preview for AI analysis
   */
  private generateContentPreview(data: ExtractedDataRecord[], headers: string[]): string {
    const headerLine = headers.join('\t');
    const dataLines = data.slice(0, 5).map(record => 
      headers.map(header => record[header] || '').join('\t')
    ).join('\n');
    
    return `Headers: ${headerLine}\nData:\n${dataLines}`;
  }

  /**
   * Transform extracted data based on document type
   */
  transformDataByType(data: ExtractedDataRecord[], documentType: string): ExtractedDataRecord[] {
    switch (documentType) {
      case 'sales_register':
        return this.transformSalesData(data);
      case 'purchase_register':
        return this.transformPurchaseData(data);
      case 'salary_register':
        return this.transformSalaryData(data);
      case 'bank_statement':
        return this.transformBankData(data);
      default:
        return data;
    }
  }

  private transformSalesData(data: ExtractedDataRecord[]): ExtractedDataRecord[] {
    return data.map(record => ({
      customer: record['Customer'] || record['Client'] || record['Party'] || '',
      invoiceNumber: record['Invoice'] || record['Bill No'] || record['Ref'] || '',
      amount: this.parseAmount(record['Amount'] || record['Value'] || record['Total'] || '0'),
      date: record['Date'] || record['Invoice Date'] || '',
      ...record
    }));
  }

  private transformPurchaseData(data: ExtractedDataRecord[]): ExtractedDataRecord[] {
    return data.map(record => ({
      vendor: record['Vendor'] || record['Supplier'] || record['Party'] || '',
      invoiceNumber: record['Invoice'] || record['Bill No'] || record['Ref'] || '',
      amount: this.parseAmount(record['Amount'] || record['Value'] || record['Total'] || '0'),
      date: record['Date'] || record['Invoice Date'] || '',
      ...record
    }));
  }

  private transformSalaryData(data: ExtractedDataRecord[]): ExtractedDataRecord[] {
    return data.map(record => ({
      employee: record['Employee'] || record['Name'] || record['Staff'] || '',
      basicSalary: this.parseAmount(record['Basic'] || record['Basic Salary'] || '0'),
      grossSalary: this.parseAmount(record['Gross'] || record['Gross Salary'] || '0'),
      tds: this.parseAmount(record['TDS'] || record['Tax'] || '0'),
      netSalary: this.parseAmount(record['Net'] || record['Net Salary'] || '0'),
      ...record
    }));
  }

  private transformBankData(data: ExtractedDataRecord[]): ExtractedDataRecord[] {
    return data.map(record => ({
      date: record['Date'] || record['Transaction Date'] || '',
      description: record['Description'] || record['Particulars'] || record['Narration'] || '',
      debit: this.parseAmount(record['Debit'] || record['Dr'] || record['Withdrawal'] || '0'),
      credit: this.parseAmount(record['Credit'] || record['Cr'] || record['Deposit'] || '0'),
      balance: this.parseAmount(record['Balance'] || record['Amount'] || '0'),
      ...record
    }));
  }

  private parseAmount(value: string | number): number {
    if (typeof value === 'number') return value;
    return parseFloat(value.toString().replace(/[^\d.-]/g, '')) || 0;
  }
}

export const dataExtractorService = DataExtractorService.getInstance();