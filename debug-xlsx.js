// Debug XLSX import issue
console.log('Testing XLSX import...');

try {
  // Test CommonJS import
  const XLSX = require('xlsx');
  console.log('CommonJS import successful:', typeof XLSX.readFile);
  
  // Test the actual file
  const workbook = XLSX.readFile('attached_assets/bank_statement_q1_2025_1753618813807.xlsx');
  console.log('File read successful. Sheets:', workbook.SheetNames);
  
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('First row:', data[0]);
  console.log('Data rows:', data.length);
  
} catch (error) {
  console.error('Error:', error.message);
}