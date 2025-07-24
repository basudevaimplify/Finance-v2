import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export interface ClassificationResult {
  documentType: string;
  confidence: number;
  reasoning: string;
  keyIndicators: string[];
  contentSummary: string;
  potentialMisclassification: boolean;
}

export class ClassifierAgent {
  private documentPatterns = {
    sales_register: {
      keywords: ['sales', 'customer', 'invoice', 'revenue', 'gst number', 'billing', 'receipt'],
      headers: ['customer', 'invoice', 'amount', 'gst', 'total', 'date', 'bill', 'receipt'],
      patterns: [/customer/i, /invoice/i, /sales/i, /revenue/i, /bill/i]
    },
    purchase_register: {
      keywords: ['purchase', 'vendor', 'supplier', 'expense', 'payment', 'bill', 'procurement'],
      headers: ['vendor', 'supplier', 'purchase', 'expense', 'payment', 'amount', 'gst'],
      patterns: [/vendor/i, /supplier/i, /purchase/i, /expense/i, /procurement/i]
    },
    bank_statement: {
      keywords: ['bank', 'account', 'balance', 'debit', 'credit', 'transaction', 'statement'],
      headers: ['date', 'description', 'debit', 'credit', 'balance', 'transaction'],
      patterns: [/debit/i, /credit/i, /balance/i, /account/i, /bank/i]
    },
    salary_register: {
      keywords: ['salary', 'employee', 'payroll', 'wages', 'allowance', 'deduction', 'net pay'],
      headers: ['employee', 'salary', 'basic', 'allowance', 'deduction', 'net', 'gross'],
      patterns: [/employee/i, /salary/i, /payroll/i, /wages/i, /net.pay/i]
    },
    tds: {
      keywords: ['tds', 'tax deducted', 'source', 'deductee', 'section', 'certificate'],
      headers: ['tds', 'deductee', 'section', 'rate', 'amount', 'certificate'],
      patterns: [/tds/i, /tax.deducted/i, /deductee/i, /section/i]
    },
    gst: {
      keywords: ['gst', 'goods and services tax', 'igst', 'cgst', 'sgst', 'hsn', 'gstr'],
      headers: ['gst', 'igst', 'cgst', 'sgst', 'hsn', 'tax', 'return'],
      patterns: [/gst/i, /igst/i, /cgst/i, /sgst/i, /hsn/i, /gstr/i]
    },
    fixed_asset_register: {
      keywords: ['asset', 'depreciation', 'wdv', 'written down value', 'acquisition', 'disposal'],
      headers: ['asset', 'depreciation', 'wdv', 'cost', 'acquisition', 'disposal'],
      patterns: [/asset/i, /depreciation/i, /wdv/i, /written.down/i]
    },
    vendor_invoice: {
      keywords: ['invoice', 'bill', 'vendor', 'supplier', 'amount', 'due date', 'payment'],
      headers: ['invoice', 'bill', 'vendor', 'amount', 'due', 'payment', 'total'],
      patterns: [/invoice/i, /bill/i, /due.date/i, /payment.terms/i]
    }
  };

  async classifyDocument(filePath: string, fileName: string, mimeType: string): Promise<ClassificationResult> {
    console.log(`Starting classification for: ${fileName}`);
    
    try {
      // Extract content based on file type
      const content = await this.extractContent(filePath, mimeType);
      
      // Perform multi-layered analysis
      const filenameAnalysis = this.analyzeFilename(fileName);
      const contentAnalysis = this.analyzeContent(content);
      const structuralAnalysis = this.analyzeStructure(content);
      
      // Combine analysis results
      const finalResult = this.combineAnalysis(filenameAnalysis, contentAnalysis, structuralAnalysis);
      
      console.log(`Classification result for ${fileName}:`, finalResult);
      return finalResult;
      
    } catch (error) {
      console.error(`Classification error for ${fileName}:`, error);
      return {
        documentType: this.getDocumentTypeFromFilename(fileName),
        confidence: 0.2,
        reasoning: `Classification failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}. Using filename fallback.`,
        keyIndicators: ['filename_fallback', 'error_recovery'],
        contentSummary: 'Classification uncertain due to processing error',
        potentialMisclassification: true
      };
    }
  }

  private async extractContent(filePath: string, mimeType: string): Promise<any> {
    if (mimeType.includes('spreadsheet') || filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
      return this.extractFromExcel(filePath);
    } else if (mimeType.includes('csv') || filePath.endsWith('.csv')) {
      return this.extractFromCSV(filePath);
    } else if (mimeType.includes('pdf') || filePath.endsWith('.pdf')) {
      return this.extractFromPDF(filePath);
    } else {
      // Try CSV first, then Excel
      try {
        return this.extractFromCSV(filePath);
      } catch {
        return this.extractFromExcel(filePath);
      }
    }
  }

  private extractFromExcel(filePath: string): any {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      return {
        headers: data[0] || [],
        rows: data.slice(1) || [],
        totalRows: data.length - 1,
        format: 'excel'
      };
    } catch (error) {
      console.error('Excel extraction error:', error);
      return { headers: [], rows: [], totalRows: 0, format: 'excel', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async extractFromCSV(filePath: string): Promise<any> {
    try {
      const results: any[] = [];
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
            results.push(chunk);
            callback();
          }
        })
      );
      
      return {
        headers,
        rows: results,
        totalRows: results.length,
        format: 'csv'
      };
    } catch (error) {
      console.error('CSV extraction error:', error);
      return { headers: [], rows: [], totalRows: 0, format: 'csv', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private extractFromPDF(filePath: string): any {
    // For PDF extraction, we'll simulate based on filename patterns
    // In production, you'd use pdf-parse or similar library
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('bank') || fileName.includes('statement')) {
      return {
        headers: ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
        rows: [],
        totalRows: 0,
        format: 'pdf',
        simulatedContent: 'bank_statement'
      };
    }
    
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      format: 'pdf',
      simulatedContent: 'unknown'
    };
  }

  private analyzeFilename(fileName: string): Partial<ClassificationResult> {
    const lowerName = fileName.toLowerCase();
    
    for (const [docType, config] of Object.entries(this.documentPatterns)) {
      const matches = config.keywords.filter(keyword => lowerName.includes(keyword.toLowerCase()));
      if (matches.length > 0) {
        return {
          documentType: docType,
          confidence: Math.min(0.8, 0.3 + (matches.length * 0.1)),
          reasoning: `Filename analysis detected ${matches.length} relevant keywords: ${matches.join(', ')}`,
          keyIndicators: ['filename_match', ...matches]
        };
      }
    }
    
    return {
      documentType: 'other',
      confidence: 0.1,
      reasoning: 'No clear document type indicators found in filename',
      keyIndicators: ['filename_unclear']
    };
  }

  private analyzeContent(content: any): Partial<ClassificationResult> {
    if (!content.headers || content.headers.length === 0) {
      return {
        confidence: 0.1,
        reasoning: 'No content headers available for analysis',
        keyIndicators: ['no_headers']
      };
    }
    
    const headerText = content.headers.join(' ').toLowerCase();
    let bestMatch = { type: 'other', score: 0, matches: [] };
    
    for (const [docType, config] of Object.entries(this.documentPatterns)) {
      const headerMatches = config.headers.filter(header => 
        headerText.includes(header.toLowerCase())
      );
      
      const patternMatches = config.patterns.filter(pattern => 
        pattern.test(headerText)
      );
      
      const totalMatches = headerMatches.length + patternMatches.length;
      const score = totalMatches / (config.headers.length + config.patterns.length);
      
      if (score > bestMatch.score) {
        bestMatch = {
          type: docType,
          score,
          matches: [...headerMatches, ...patternMatches.map(p => p.source)]
        };
      }
    }
    
    if (bestMatch.score > 0.3) {
      return {
        documentType: bestMatch.type,
        confidence: Math.min(0.9, bestMatch.score),
        reasoning: `Content analysis found ${bestMatch.matches.length} matching indicators`,
        keyIndicators: ['content_match', ...bestMatch.matches]
      };
    }
    
    return {
      documentType: 'other',
      confidence: 0.2,
      reasoning: 'Content analysis did not find strong type indicators',
      keyIndicators: ['content_unclear']
    };
  }

  private analyzeStructure(content: any): Partial<ClassificationResult> {
    if (!content.rows || content.totalRows === 0) {
      return {
        confidence: 0.1,
        reasoning: 'No data rows available for structural analysis',
        keyIndicators: ['no_data']
      };
    }
    
    const indicators = [];
    let confidence = 0.3;
    
    // Check for financial patterns
    if (content.headers.some((h: any) => h.toLowerCase().includes('amount'))) {
      indicators.push('financial_data');
      confidence += 0.1;
    }
    
    if (content.headers.some((h: any) => h.toLowerCase().includes('date'))) {
      indicators.push('temporal_data');
      confidence += 0.1;
    }
    
    if (content.headers.some((h: any) => ['debit', 'credit'].includes(h.toLowerCase()))) {
      indicators.push('accounting_structure');
      confidence += 0.2;
    }
    
    return {
      confidence: Math.min(0.8, confidence),
      reasoning: `Structural analysis identified ${indicators.length} relevant patterns`,
      keyIndicators: ['structure_analysis', ...indicators]
    };
  }

  private combineAnalysis(
    filename: Partial<ClassificationResult>,
    content: Partial<ClassificationResult>,
    structure: Partial<ClassificationResult>
  ): ClassificationResult {
    
    // Weight the different analysis methods
    const analyses = [
      { result: filename, weight: 0.3 },
      { result: content, weight: 0.5 },
      { result: structure, weight: 0.2 }
    ].filter(a => a.result.documentType && a.result.documentType !== 'other');
    
    if (analyses.length === 0) {
      return {
        documentType: filename.documentType || 'other',
        confidence: 0.2,
        reasoning: 'All analysis methods failed to identify document type clearly',
        keyIndicators: ['analysis_unclear'],
        contentSummary: 'Document type uncertain',
        potentialMisclassification: true
      };
    }
    
    // Find consensus or highest weighted result
    const typeScores: { [key: string]: number } = {};
    const allIndicators: string[] = [];
    const reasonings: string[] = [];
    
    analyses.forEach(({ result, weight }) => {
      if (result.documentType) {
        typeScores[result.documentType] = (typeScores[result.documentType] || 0) + 
          (result.confidence || 0) * weight;
      }
      if (result.keyIndicators) {
        allIndicators.push(...result.keyIndicators);
      }
      if (result.reasoning) {
        reasonings.push(result.reasoning);
      }
    });
    
    const bestType = Object.entries(typeScores).reduce((a, b) => 
      typeScores[a[0]] > typeScores[b[0]] ? a : b
    );
    
    const finalConfidence = Math.min(0.95, bestType[1]);
    const isPotentialMisclassification = finalConfidence < 0.6;
    
    return {
      documentType: bestType[0],
      confidence: finalConfidence,
      reasoning: reasonings.join('; '),
      keyIndicators: Array.from(new Set(allIndicators)),
      contentSummary: `Classified as ${bestType[0]} with ${Math.round(finalConfidence * 100)}% confidence`,
      potentialMisclassification: isPotentialMisclassification
    };
  }

  private getDocumentTypeFromFilename(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('sales')) return 'sales_register';
    if (lowerName.includes('purchase')) return 'purchase_register';
    if (lowerName.includes('bank') || lowerName.includes('statement')) return 'bank_statement';
    if (lowerName.includes('salary') || lowerName.includes('payroll')) return 'salary_register';
    if (lowerName.includes('tds')) return 'tds';
    if (lowerName.includes('gst')) return 'gst';
    if (lowerName.includes('asset')) return 'fixed_asset_register';
    if (lowerName.includes('invoice')) return 'vendor_invoice';
    
    return 'other';
  }
}