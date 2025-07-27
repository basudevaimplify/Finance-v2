// Test Excel extraction directly
const { exec } = require('child_process');
const fs = require('fs');

const excelFilePath = 'attached_assets/bank_statement_q1_2025_1753618813807.xlsx';
const csvFilePath = 'test_output.csv';

// Create a Python script to convert Excel to CSV
const pythonScript = `
import pandas as pd
import sys
import os

try:
    # Read Excel file
    print(f"Reading Excel file: ${excelFilePath}")
    df = pd.read_excel('${excelFilePath}')
    
    print(f"DataFrame shape: {df.shape}")
    print(f"DataFrame columns: {list(df.columns)}")
    print("First few rows:")
    print(df.head())
    
    # Clean column names - remove any null/nan columns
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df = df.dropna(how='all', axis=1)  # Remove columns that are all NaN
    df = df.dropna(how='all', axis=0)  # Remove rows that are all NaN
    
    print(f"After cleaning - shape: {df.shape}")
    print(f"After cleaning - columns: {list(df.columns)}")
    
    # Convert to CSV with explicit parameters
    df.to_csv('${csvFilePath}', index=False, encoding='utf-8')
    
    # Verify the CSV was created
    if os.path.exists('${csvFilePath}'):
        print(f"CSV file created successfully: ${csvFilePath}")
        # Read first few lines to verify
        with open('${csvFilePath}', 'r') as f:
            lines = f.readlines()[:5]
            print("First 5 lines of CSV:")
            for i, line in enumerate(lines):
                print(f"Line {i+1}: {line.strip()}")
        print("SUCCESS")
    else:
        print("ERROR: CSV file was not created")
        sys.exit(1)
        
except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
`;

// Write Python script to temporary file
const scriptPath = 'test_convert.py';
fs.writeFileSync(scriptPath, pythonScript);

// Execute Python script
exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
  console.log('Python output:');
  console.log(stdout);
  
  if (stderr) {
    console.log('Python errors:');
    console.log(stderr);
  }
  
  if (error) {
    console.error(`Execution error: ${error}`);
  }
  
  // Check if CSV was created
  if (fs.existsSync(csvFilePath)) {
    console.log('\nCSV file created successfully!');
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    console.log('CSV content:');
    console.log(csvContent.split('\n').slice(0, 10).join('\n'));
  } else {
    console.log('CSV file was not created');
  }
  
  // Clean up
  try {
    fs.unlinkSync(scriptPath);
    if (fs.existsSync(csvFilePath)) {
      fs.unlinkSync(csvFilePath);
    }
  } catch (cleanupError) {
    console.warn(`Cleanup failed: ${cleanupError}`);
  }
});