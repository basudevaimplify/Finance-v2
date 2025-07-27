import { storage } from '../storage';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

interface TrialBalanceEntry {
  ledgerName: string;
  debit: number;
  credit: number;
}

interface GSTR2AEntry {
  gstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface GSTR3BEntry {
  description: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface BankReconciliationEntry {
  date: string;
  particulars: string;
  bankAmount: number;
  bookAmount: number;
  matchStatus: 'Matched' | 'Unmatched';
}

export class FinancialDocumentAnalyzer {
  
  /**
   * Generate Trial Balance from Journal Entry CSV
   * Uses uploaded Journal Entry CSV and aggregates balances by ledger accounts
   */
  async generateTrialBalance(tenantId: string, period?: string): Promise<{
    entries: TrialBalanceEntry[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    try {
      // Get journal entries from database (real data only)
      const journalEntries = await storage.getJournalEntries(undefined, tenantId);
      
      if (journalEntries.length === 0) {
        return {
          entries: [],
          totalDebits: 0,
          totalCredits: 0,
          isBalanced: true
        };
      }

      // Aggregate by account code/name
      const ledgerMap = new Map<string, { debit: number; credit: number }>();
      
      for (const entry of journalEntries) {
        const accountName = entry.accountName || entry.accountCode || 'Unknown Account';
        
        if (!ledgerMap.has(accountName)) {
          ledgerMap.set(accountName, { debit: 0, credit: 0 });
        }
        
        const ledger = ledgerMap.get(accountName)!;
        ledger.debit += parseFloat(entry.debitAmount || '') || 0;
        ledger.credit += parseFloat(entry.creditAmount || '') || 0;
      }

      // Convert to trial balance format
      const entries: TrialBalanceEntry[] = Array.from(ledgerMap.entries()).map(([ledgerName, amounts]) => ({
        ledgerName,
        debit: amounts.debit,
        credit: amounts.credit
      }));

      const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0);
      
      return {
        entries: entries.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)),
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01 // Allow for rounding
      };
    } catch (error) {
      console.error('Error generating trial balance:', error);
      throw new Error('Failed to generate trial balance from uploaded data');
    }
  }

  /**
   * Generate GSTR-2A from Purchase Register CSV
   * Extracts and formats vendor-wise invoice data as per GSTR-2A layout
   */
  async generateGSTR2A(tenantId: string, period?: string): Promise<{
    entries: GSTR2AEntry[];
    totalTaxableValue: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    grandTotal: number;
  }> {
    try {
      // Get purchase register documents
      const allDocuments = await storage.getDocuments(undefined, tenantId);
      const documents = allDocuments.filter(doc => doc.documentType === 'purchase_register');
      
      if (documents.length === 0) {
        return {
          entries: [],
          totalTaxableValue: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          grandTotal: 0
        };
      }

      const entries: GSTR2AEntry[] = [];
      let totals = {
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0
      };

      // Process each purchase register document
      for (const document of documents) {
        if (document.extractedData && Array.isArray(document.extractedData.data)) {
          const purchaseData = document.extractedData.data;
          
          for (const row of purchaseData) {
            // Extract GST data from actual columns (flexible column mapping)
            const entry: GSTR2AEntry = {
              gstin: this.extractValue(row, ['gstin', 'gst_number', 'vendor_gstin', 'supplier_gstin']) || 'N/A',
              invoiceNumber: this.extractValue(row, ['invoice_number', 'bill_no', 'voucher_no', 'invoice_no']) || 'N/A',
              invoiceDate: this.extractValue(row, ['invoice_date', 'date', 'bill_date', 'voucher_date']) || 'N/A',
              taxableValue: this.parseNumber(this.extractValue(row, ['taxable_value', 'amount', 'value', 'basic_amount'])),
              cgst: this.parseNumber(this.extractValue(row, ['cgst', 'cgst_amount', 'central_gst'])),
              sgst: this.parseNumber(this.extractValue(row, ['sgst', 'sgst_amount', 'state_gst'])),
              igst: this.parseNumber(this.extractValue(row, ['igst', 'igst_amount', 'integrated_gst'])),
              total: 0 // Will be calculated
            };
            
            entry.total = entry.taxableValue + entry.cgst + entry.sgst + entry.igst;
            
            // Add to totals
            totals.taxableValue += entry.taxableValue;
            totals.cgst += entry.cgst;
            totals.sgst += entry.sgst;
            totals.igst += entry.igst;
            totals.total += entry.total;
            
            entries.push(entry);
          }
        }
      }

      return {
        entries,
        totalTaxableValue: totals.taxableValue,
        totalCGST: totals.cgst,
        totalSGST: totals.sgst,
        totalIGST: totals.igst,
        grandTotal: totals.total
      };
    } catch (error) {
      console.error('Error generating GSTR-2A:', error);
      throw new Error('Failed to generate GSTR-2A from purchase register data');
    }
  }

  /**
   * Generate GSTR-3B from Sales Register and Purchase Register CSVs
   * Computes total outward supply, ITC claimed, and net GST payable
   */
  async generateGSTR3B(tenantId: string, period?: string): Promise<{
    outwardSupplies: GSTR3BEntry[];
    inwardSupplies: GSTR3BEntry[];
    netTaxPayable: {
      cgst: number;
      sgst: number;
      igst: number;
      total: number;
    };
  }> {
    try {
      // Get sales and purchase documents
      const allDocuments = await storage.getDocuments(undefined, tenantId);
      const salesDocs = allDocuments.filter(doc => doc.documentType === 'sales_register');
      const purchaseDocs = allDocuments.filter(doc => doc.documentType === 'purchase_register');

      const outwardSupplies: GSTR3BEntry[] = [];
      const inwardSupplies: GSTR3BEntry[] = [];
      
      let outwardTotals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      let inwardTotals = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };

      // Process Sales Register (Outward Supplies)
      for (const document of salesDocs) {
        if (document.extractedData && Array.isArray(document.extractedData.data)) {
          const salesData = document.extractedData.data;
          
          for (const row of salesData) {
            const entry: GSTR3BEntry = {
              description: this.extractValue(row, ['description', 'particulars', 'item', 'product']) || 'Sales',
              taxableValue: this.parseNumber(this.extractValue(row, ['taxable_value', 'amount', 'value', 'basic_amount'])),
              cgst: this.parseNumber(this.extractValue(row, ['cgst', 'cgst_amount', 'central_gst'])),
              sgst: this.parseNumber(this.extractValue(row, ['sgst', 'sgst_amount', 'state_gst'])),
              igst: this.parseNumber(this.extractValue(row, ['igst', 'igst_amount', 'integrated_gst'])),
              total: 0
            };
            
            entry.total = entry.taxableValue + entry.cgst + entry.sgst + entry.igst;
            
            outwardTotals.taxableValue += entry.taxableValue;
            outwardTotals.cgst += entry.cgst;
            outwardTotals.sgst += entry.sgst;
            outwardTotals.igst += entry.igst;
            outwardTotals.total += entry.total;
            
            outwardSupplies.push(entry);
          }
        }
      }

      // Process Purchase Register (Inward Supplies for ITC)
      for (const document of purchaseDocs) {
        if (document.extractedData && Array.isArray(document.extractedData.data)) {
          const purchaseData = document.extractedData.data;
          
          for (const row of purchaseData) {
            const entry: GSTR3BEntry = {
              description: this.extractValue(row, ['description', 'particulars', 'item', 'product']) || 'Purchase',
              taxableValue: this.parseNumber(this.extractValue(row, ['taxable_value', 'amount', 'value', 'basic_amount'])),
              cgst: this.parseNumber(this.extractValue(row, ['cgst', 'cgst_amount', 'central_gst'])),
              sgst: this.parseNumber(this.extractValue(row, ['sgst', 'sgst_amount', 'state_gst'])),
              igst: this.parseNumber(this.extractValue(row, ['igst', 'igst_amount', 'integrated_gst'])),
              total: 0
            };
            
            entry.total = entry.taxableValue + entry.cgst + entry.sgst + entry.igst;
            
            inwardTotals.taxableValue += entry.taxableValue;
            inwardTotals.cgst += entry.cgst;
            inwardTotals.sgst += entry.sgst;
            inwardTotals.igst += entry.igst;
            inwardTotals.total += entry.total;
            
            inwardSupplies.push(entry);
          }
        }
      }

      // Calculate net tax payable (Output Tax - Input Tax Credit)
      const netTaxPayable = {
        cgst: Math.max(0, outwardTotals.cgst - inwardTotals.cgst),
        sgst: Math.max(0, outwardTotals.sgst - inwardTotals.sgst),
        igst: Math.max(0, outwardTotals.igst - inwardTotals.igst),
        total: 0
      };
      
      netTaxPayable.total = netTaxPayable.cgst + netTaxPayable.sgst + netTaxPayable.igst;

      return {
        outwardSupplies,
        inwardSupplies,
        netTaxPayable
      };
    } catch (error) {
      console.error('Error generating GSTR-3B:', error);
      throw new Error('Failed to generate GSTR-3B from sales and purchase data');
    }
  }

  /**
   * Generate Bank Reconciliation from Bank Statement and Journal Entry CSVs
   * Matches transactions by date, amount, and description
   */
  async generateBankReconciliation(tenantId: string, period?: string): Promise<{
    entries: BankReconciliationEntry[];
    totalMatched: number;
    totalUnmatched: number;
    matchingAccuracy: number;
  }> {
    try {
      // Get bank statements and journal entries
      const allDocuments = await storage.getDocuments(undefined, tenantId);
      const bankDocs = allDocuments.filter(doc => doc.documentType === 'bank_statement');
      const journalEntries = await storage.getJournalEntries(undefined, tenantId);

      if (bankDocs.length === 0 || journalEntries.length === 0) {
        return {
          entries: [],
          totalMatched: 0,
          totalUnmatched: 0,
          matchingAccuracy: 0
        };
      }

      const entries: BankReconciliationEntry[] = [];
      const bankTransactions: any[] = [];
      
      // Extract bank statement data
      for (const document of bankDocs) {
        if (document.extractedData && Array.isArray(document.extractedData.data)) {
          bankTransactions.push(...document.extractedData.data);
        }
      }

      let totalMatched = 0;
      let totalUnmatched = 0;

      // Process each bank transaction
      for (const bankTxn of bankTransactions) {
        const bankDate = this.extractValue(bankTxn, ['date', 'transaction_date', 'value_date']);
        const bankAmount = this.parseNumber(this.extractValue(bankTxn, ['amount', 'debit', 'credit', 'value']));
        const bankParticulars = this.extractValue(bankTxn, ['particulars', 'description', 'narration', 'reference']) || 'N/A';

        // Find matching journal entry
        const matchingEntry = journalEntries.find((je: any) => {
          const jeAmount = parseFloat(je.debitAmount || je.creditAmount || '0');
          const amountMatch = Math.abs(jeAmount - Math.abs(bankAmount)) < 0.01;
          const dateMatch = this.datesMatch(bankDate, je.date);
          return amountMatch && dateMatch;
        });

        const matchStatus: 'Matched' | 'Unmatched' = matchingEntry ? 'Matched' : 'Unmatched';
        const bookAmount = matchingEntry ? (matchingEntry.debit || matchingEntry.credit || 0) : 0;

        if (matchStatus === 'Matched') {
          totalMatched++;
        } else {
          totalUnmatched++;
        }

        entries.push({
          date: bankDate || 'N/A',
          particulars: bankParticulars,
          bankAmount: Math.abs(bankAmount),
          bookAmount: Math.abs(bookAmount),
          matchStatus
        });
      }

      const matchingAccuracy = entries.length > 0 ? (totalMatched / entries.length) * 100 : 0;

      return {
        entries: entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        totalMatched,
        totalUnmatched,
        matchingAccuracy: Math.round(matchingAccuracy * 100) / 100
      };
    } catch (error) {
      console.error('Error generating bank reconciliation:', error);
      throw new Error('Failed to generate bank reconciliation from uploaded data');
    }
  }

  /**
   * Generate CSV download for any report
   */
  generateCSV(data: any[], reportType: string): string {
    if (!data || data.length === 0) {
      return `No data available for ${reportType}`;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle numbers and strings properly for CSV
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // Helper methods
  private extractValue(row: any, possibleKeys: string[]): any {
    for (const key of possibleKeys) {
      if (row.hasOwnProperty(key) && row[key] !== null && row[key] !== undefined) {
        return row[key];
      }
      
      // Try case-insensitive match
      const lowerKey = key.toLowerCase();
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase() === lowerKey) {
          return row[rowKey];
        }
      }
    }
    return null;
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleaned = value.replace(/[₹$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private datesMatch(date1: any, date2: any): boolean {
    if (!date1 || !date2) return false;
    
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      // Check if dates are within 1 day of each other (accounting for time zones)
      const timeDiff = Math.abs(d1.getTime() - d2.getTime());
      const dayDiff = timeDiff / (1000 * 3600 * 24);
      
      return dayDiff <= 1;
    } catch {
      return false;
    }
  }
}

export const financialDocumentAnalyzer = new FinancialDocumentAnalyzer();