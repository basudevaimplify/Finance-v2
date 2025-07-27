import OpenAI from "openai";

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export interface DocumentAnalysisResult {
  documentType: 'sales_register' | 'purchase_register' | 'bank_statement' | 'salary_register' | 'tds_certificates' | 'fixed_assets' | 'vendor_invoice' | 'unknown';
  confidence: number;
  extractedData: any[];
  headers: string[];
  totalRecords: number;
  metadata: {
    fileFormat: string;
    dataQuality: number;
    currency?: string;
    period?: string;
    company?: string;
    issues?: string[];
  };
}

export class OpenAIService {
  /**
   * Analyze document content and extract structured data using GPT-4o
   */
  async analyzeDocument(
    content: string, 
    fileName: string, 
    fileType: string
  ): Promise<DocumentAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(content, fileName, fileType);
      
      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial document analysis expert. Analyze the document content and extract structured data. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentType: this.normalizeDocumentType(result.documentType || 'unknown'),
        confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
        extractedData: Array.isArray(result.extractedData) ? result.extractedData : [],
        headers: Array.isArray(result.headers) ? result.headers : [],
        totalRecords: result.totalRecords || 0,
        metadata: {
          fileFormat: fileType,
          dataQuality: result.metadata?.dataQuality || 0.8,
          currency: result.metadata?.currency || 'INR',
          period: result.metadata?.period,
          company: result.metadata?.company,
          issues: result.metadata?.issues || []
        }
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      return {
        documentType: 'unknown',
        confidence: 0,
        extractedData: [],
        headers: [],
        totalRecords: 0,
        metadata: {
          fileFormat: fileType,
          dataQuality: 0,
          issues: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      };
    }
  }

  /**
   * Extract structured data from tabular content (Excel/CSV)
   */
  async extractTabularData(
    headers: string[], 
    rows: any[][], 
    documentType?: string
  ): Promise<any[]> {
    if (rows.length === 0) return [];

    try {
      const sampleRows = rows.slice(0, 5); // Analyze first 5 rows
      const prompt = `
Analyze this tabular data and extract structured financial records:

Headers: ${JSON.stringify(headers)}
Sample Data: ${JSON.stringify(sampleRows)}
Document Type: ${documentType || 'unknown'}

Extract and normalize the data into a consistent format. For financial documents:
- Convert amounts to numbers
- Standardize date formats
- Clean company/vendor names
- Handle GST/tax calculations
- Identify key financial fields

Return JSON with array of normalized records:
{
  "extractedRecords": [
    { "field1": "value1", "field2": 123.45, ... }
  ],
  "fieldMappings": {
    "original_field": "normalized_field"
  }
}
`;

      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.extractedRecords || [];
    } catch (error) {
      console.error('Tabular extraction error:', error);
      return rows.map(row => {
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = row[index];
        });
        return record;
      });
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(content: string, fileName: string, fileType: string): string {
    return `
Analyze this financial document and extract structured data:

Filename: ${fileName}
File Type: ${fileType}
Content Preview: ${content.substring(0, 2000)}

Please analyze and return JSON with:
{
  "documentType": "sales_register|purchase_register|bank_statement|salary_register|tds_certificates|fixed_assets|vendor_invoice|unknown",
  "confidence": 0.95,
  "extractedData": [
    // Array of extracted records with normalized field names
  ],
  "headers": ["field1", "field2", "field3"],
  "totalRecords": 10,
  "metadata": {
    "dataQuality": 0.9,
    "currency": "INR",
    "period": "Q1 2025",
    "company": "Company Name",
    "issues": ["any issues found"]
  }
}

Document Type Classification:
- sales_register: Customer invoices, sales data, revenue records
- purchase_register: Vendor invoices, purchase orders, expense records  
- bank_statement: Bank transactions, deposits, withdrawals
- salary_register: Employee payroll, salary payments
- tds_certificates: Tax deduction certificates, TDS records
- fixed_assets: Asset register, depreciation schedules
- vendor_invoice: Individual vendor bills/invoices

For Indian financial documents, look for:
- GST numbers (15 digits)
- PAN numbers (10 alphanumeric)
- Company names ending with Pvt Ltd, Ltd, etc.
- Indian currency amounts (₹, Rs, INR)
- Indian date formats
- TDS sections (194A, 194C, etc.)

Extract ALL tabular data with proper field mapping and data type conversion.
`;
  }

  /**
   * Normalize document type to match schema enum
   */
  private normalizeDocumentType(type: string): DocumentAnalysisResult['documentType'] {
    const typeMap: { [key: string]: DocumentAnalysisResult['documentType'] } = {
      'sales': 'sales_register',
      'purchase': 'purchase_register',
      'bank': 'bank_statement',
      'salary': 'salary_register',
      'payroll': 'salary_register',
      'tds': 'tds_certificates',
      'assets': 'fixed_assets',
      'invoice': 'vendor_invoice',
      'vendor': 'vendor_invoice'
    };

    const normalized = type.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }
    
    return 'unknown';
  }

  /**
   * Generate structured response using GPT-4o with schema validation
   */
  async generateStructuredResponse(prompt: string, schema: any): Promise<any> {
    try {
      console.log('Generating structured response for journal entries...');
      
      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Generate concise journal entries in valid JSON format only. Keep responses short and simple."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800
      });

      const content = response.choices[0].message.content || '{}';
      console.log('OpenAI response received, length:', content.length);
      
      return this.parseAndValidateJournalResponse(content);
      
    } catch (error) {
      console.error('Error in OpenAI API call:', error);
      return this.getFallbackJournalResponse();
    }
  }

  private parseAndValidateJournalResponse(content: string): any {
    try {
      const result = JSON.parse(content);
      
      if (!result.journalEntries || !Array.isArray(result.journalEntries)) {
        console.warn('Invalid response structure from OpenAI, using fallback');
        return this.getFallbackJournalResponse();
      }
      
      console.log(`Successfully parsed ${result.journalEntries.length} journal entries`);
      return result;
      
    } catch (parseError) {
      console.error('JSON parse failed:', parseError);
      console.log('Attempting to clean malformed JSON...');
      
      try {
        const cleanedContent = this.cleanMalformedJson(content);
        const result = JSON.parse(cleanedContent);
        
        if (!result.journalEntries || !Array.isArray(result.journalEntries)) {
          return this.getFallbackJournalResponse();
        }
        
        console.log('Successfully parsed cleaned JSON');
        return result;
        
      } catch (secondError) {
        console.error('Cleanup failed, using fallback response');
        return this.getFallbackJournalResponse();
      }
    }
  }

  private cleanMalformedJson(content: string): string {
    let cleaned = content.trim();
    
    // Remove trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Count braces and brackets to add missing closures
    let braceCount = 0;
    let bracketCount = 0;
    
    for (const char of cleaned) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    
    while (braceCount > 0) {
      cleaned += '}';
      braceCount--;
    }
    while (bracketCount > 0) {
      cleaned += ']';
      bracketCount--;
    }
    
    return cleaned;
  }

  private getFallbackJournalResponse(): any {
    return {
      journalEntries: [{
        entryDate: new Date().toISOString().split('T')[0],
        description: 'AI journal generation failed - manual review required',
        debitAccount: 'Suspense Account',
        creditAccount: 'Suspense Account', 
        amount: 0,
        reference: 'FALLBACK_ENTRY'
      }]
    };
  }
}

export const openaiService = new OpenAIService();
