const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class TestDataExtractor {
  async extractFromExcel(filePath, documentType) {
    try {
      console.log(`\n=== Testing Excel extraction ===`);
      console.log(`File: ${path.basename(filePath)}`);
      console.log(`Type: ${documentType}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const workbook = XLSX.readFile(filePath);
      console.log(`Sheet names: ${workbook.SheetNames.join(', ')}`);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      });
      
      console.log(`Total rows in sheet: ${jsonData.length}`);
      
      if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
      }

      // First row contains headers
      const headers = jsonData[0].filter(h => h); // Remove empty headers
      const dataRows = jsonData.slice(1);
      
      console.log(`Headers: ${headers.join(', ')}`);
      console.log(`Data rows: ${dataRows.length}`);
      
      // Convert to array of objects
      const data = dataRows
        .filter(row => row.some(cell => cell !== '')) // Filter out empty rows
        .map(row => {
          const record = {};
          headers.forEach((header, index) => {
            if (header) {
              record[header] = row[index] || '';
            }
          });
          return record;
        });

      console.log(`Records after filtering: ${data.length}`);
      
      if (data.length > 0) {
        console.log(`Sample record:`, JSON.stringify(data[0], null, 2));
      }

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
      console.error(`Excel extraction failed:`, error.message);
      return { 
        success: false, 
        error: error.message,
        data: [],
        headers: [],
        totalRecords: 0,
        documentType,
        confidence: 0,
        extractionMethod: 'failed'
      };
    }
  }
}

async function testBothFiles() {
  const extractor = new TestDataExtractor();
  
  const salesFile = '/home/runner/workspace/uploads/Fw9WGWU0qdPMi7f_4TdUv_Gz2AkAcAvOy4z3at4ZjUu_sales_register_q1_2025.xlsx';
  const purchaseFile = '/home/runner/workspace/uploads/DtalFYR1_TYiLGEmfq7p6_C6vNCEOAKuGZzsNz9EnsH_purchase_register_q1_2025.xlsx';
  
  // Test sales file
  console.log('\n🔍 TESTING SALES REGISTER:');
  const salesResult = await extractor.extractFromExcel(salesFile, 'sales_register');
  
  // Test purchase file
  console.log('\n🔍 TESTING PURCHASE REGISTER:');
  const purchaseResult = await extractor.extractFromExcel(purchaseFile, 'purchase_register');
  
  console.log('\n📊 SUMMARY:');
  console.log(`Sales: ${salesResult.success ? salesResult.totalRecords + ' records' : 'FAILED - ' + salesResult.error}`);
  console.log(`Purchase: ${purchaseResult.success ? purchaseResult.totalRecords + ' records' : 'FAILED - ' + purchaseResult.error}`);
}

testBothFiles().catch(console.error);