import { db } from '../db';
import { bankStatementData, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { InsertBankStatementData } from '@shared/schema';

export interface BankStatementRecord {
  Date: string;
  Description?: string;
  Reference?: string;
  'Debit Amount'?: string | null;
  'Credit Amount'?: string | null;
  Balance?: string;
  confidence?: number;
  source?: string;
  row_index?: number;
}

export interface ProcessedBankStatementData {
  validRecords: InsertBankStatementData[];
  skippedRecords: number;
  totalRecords: number;
  errors: string[];
}

export class BankStatementDataService {
  
  /**
   * Process and validate extracted bank statement data
   */
  static async processExtractedData(
    extractedRecords: any[],
    documentId: string,
    tenantId: string
  ): Promise<ProcessedBankStatementData> {
    const validRecords: InsertBankStatementData[] = [];
    const errors: string[] = [];
    let skippedRecords = 0;

    console.log(`🔍 Processing ${extractedRecords.length} extracted records for document ${documentId}`);

    for (let i = 0; i < extractedRecords.length; i++) {
      const record = extractedRecords[i];
      
      try {
        // Skip summary/total rows
        if (this.isSummaryRow(record)) {
          console.log(`⏭️ Skipping summary row ${i}: ${JSON.stringify(record)}`);
          skippedRecords++;
          continue;
        }

        // Extract and validate data
        const processedRecord = this.validateAndTransformRecord(record, documentId, tenantId, i);
        
        if (processedRecord) {
          validRecords.push(processedRecord);
          console.log(`✅ Valid record ${i}: ${processedRecord.description} - Debit: ${processedRecord.debitAmount}, Credit: ${processedRecord.creditAmount}`);
        } else {
          console.log(`❌ Invalid record ${i}: Missing required fields`);
          skippedRecords++;
        }
      } catch (error) {
        console.error(`❌ Error processing record ${i}:`, error);
        errors.push(`Record ${i}: ${error.message}`);
        skippedRecords++;
      }
    }

    return {
      validRecords,
      skippedRecords,
      totalRecords: extractedRecords.length,
      errors
    };
  }

  /**
   * Check if a record is a summary/total row that should be skipped
   */
  private static isSummaryRow(record: any): boolean {
    const dateField = record.Date || record.date || '';
    const descField = record.Description || record.description || '';
    
    const summaryKeywords = ['total', 'net', 'closing', 'balance', 'opening'];
    const textToCheck = `${dateField} ${descField}`.toLowerCase();
    
    return summaryKeywords.some(keyword => textToCheck.includes(keyword));
  }

  /**
   * Validate and transform a single record
   */
  private static validateAndTransformRecord(
    record: any,
    documentId: string,
    tenantId: string,
    rowIndex: number
  ): InsertBankStatementData | null {
    // Extract fields from various possible formats
    const date = record.Date || record.date || record.transaction_date;
    const description = record.Description || record.description || '';
    const reference = record.Reference || record.reference || '';
    const debitAmount = record['Debit Amount'] || record.debit_amount || record.debitAmount || record.Debit || record.debit;
    const creditAmount = record['Credit Amount'] || record.credit_amount || record.creditAmount || record.Credit || record.credit;
    const balance = record.Balance || record.balance;
    const confidence = record.confidence || 0.85;
    const source = record.source || 'automated_extraction';
    
    console.log(`🔍 Processing record ${rowIndex}:`, {
      date, description, reference, debitAmount, creditAmount, balance
    });

    // Validate required fields
    if (!date) {
      console.log(`❌ Record ${rowIndex}: Missing date field`);
      return null;
    }

    if (!description && !reference) {
      console.log(`❌ Record ${rowIndex}: Missing both description and reference`);
      return null;
    }

    // Must have either debit or credit amount
    const hasDebit = debitAmount && debitAmount !== '' && debitAmount !== null;
    const hasCred = creditAmount && creditAmount !== '' && creditAmount !== null;
    
    if (!hasDebit && !hasCred) {
      console.log(`❌ Record ${rowIndex}: Missing both debit and credit amounts`);
      return null;
    }

    // Parse and validate date
    const parsedDate = this.parseDate(date);
    if (!parsedDate) {
      console.log(`❌ Record ${rowIndex}: Invalid date format: ${date}`);
      return null;
    }

    // Parse amounts
    const parsedDebitAmount = hasDebit ? this.parseAmount(debitAmount) : null;
    const parsedCreditAmount = hasCred ? this.parseAmount(creditAmount) : null;
    const parsedBalance = balance ? this.parseAmount(balance) : null;

    return {
      documentId,
      tenantId,
      transactionDate: parsedDate,
      description: description || reference || 'Transaction',
      reference: reference || null,
      debitAmount: parsedDebitAmount,
      creditAmount: parsedCreditAmount,
      balance: parsedBalance,
      confidence: Number(confidence),
      source,
      rowIndex
    };
  }

  /**
   * Parse date string to Date object
   */
  private static parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Handle various date formats
    const formats = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // DD/MM/YYYY or DD-MM-YYYY
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // YYYY/MM/DD or YYYY-MM-DD
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/   // DD/MM/YY or DD-MM-YY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let day, month, year;
        
        if (format === formats[0]) { // DD/MM/YYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // JS months are 0-indexed
          year = parseInt(match[3]);
        } else if (format === formats[1]) { // YYYY/MM/DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else { // DD/MM/YY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]) + 2000; // Assume 20xx
        }

        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Fallback to native Date parsing
    const fallbackDate = new Date(dateStr);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }

  /**
   * Parse amount string to number
   */
  private static parseAmount(amountStr: string | number): string | null {
    if (typeof amountStr === 'number') {
      return amountStr.toString();
    }
    
    if (!amountStr || amountStr === '') return null;
    
    // Remove currency symbols, commas, and extra spaces
    const cleaned = amountStr.toString()
      .replace(/[₹$£€,\s]/g, '')
      .replace(/[^\d.-]/g, '');
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }

  /**
   * Store processed records in database
   */
  static async storeRecords(
    processedData: ProcessedBankStatementData,
    documentId: string
  ): Promise<{ success: boolean; recordsStored: number; error?: string }> {
    if (processedData.validRecords.length === 0) {
      return {
        success: false,
        recordsStored: 0,
        error: 'No valid records to store'
      };
    }

    try {
      console.log(`💾 Storing ${processedData.validRecords.length} records for document ${documentId}`);
      
      // Insert records in batch
      const insertedRecords = await db.insert(bankStatementData)
        .values(processedData.validRecords)
        .returning({ id: bankStatementData.id });

      console.log(`✅ Successfully stored ${insertedRecords.length} bank statement records`);
      
      return {
        success: true,
        recordsStored: insertedRecords.length
      };
    } catch (error) {
      console.error('❌ Failed to store bank statement records:', error);
      return {
        success: false,
        recordsStored: 0,
        error: error.message
      };
    }
  }

  /**
   * Get bank statement data for a document
   */
  static async getRecordsByDocumentId(documentId: string) {
    return await db.select()
      .from(bankStatementData)
      .where(eq(bankStatementData.documentId, documentId))
      .orderBy(bankStatementData.transactionDate, bankStatementData.rowIndex);
  }

  /**
   * Get paginated bank statement data with document info
   */
  static async getPaginatedRecords(
    tenantId: string,
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit;
    
    const records = await db.select({
      id: bankStatementData.id,
      transactionDate: bankStatementData.transactionDate,
      description: bankStatementData.description,
      reference: bankStatementData.reference,
      debitAmount: bankStatementData.debitAmount,
      creditAmount: bankStatementData.creditAmount,
      balance: bankStatementData.balance,
      confidence: bankStatementData.confidence,
      source: bankStatementData.source,
      rowIndex: bankStatementData.rowIndex,
      createdAt: bankStatementData.createdAt,
      documentId: bankStatementData.documentId,
      fileName: documents.fileName,
      originalName: documents.originalName
    })
    .from(bankStatementData)
    .leftJoin(documents, eq(bankStatementData.documentId, documents.id))
    .where(eq(bankStatementData.tenantId, tenantId))
    .orderBy(bankStatementData.transactionDate, bankStatementData.rowIndex)
    .limit(limit)
    .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: bankStatementData.id })
      .from(bankStatementData)
      .where(eq(bankStatementData.tenantId, tenantId));
    
    const total = totalResult.length;

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
