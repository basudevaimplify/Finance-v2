import pandas as pd
import sys
import os

try:
    # Read Excel file
    excelFilePath = 'attached_assets/bank_statement_q1_2025_1753618813807.xlsx'
    csvFilePath = 'bank_statement_processed.csv'
    
    print(f"Reading Excel file: {excelFilePath}")
    df = pd.read_excel(excelFilePath)
    
    print(f"DataFrame shape: {df.shape}")
    print(f"DataFrame columns: {list(df.columns)}")
    
    # Special handling for bank statements with this structure
    # Check if this is a bank statement with account details in first column
    if df.shape[1] >= 4 and 'Account Holder' in str(df.columns[0]):
        print("Detected bank statement format with account details header")
        
        # Skip the first few rows that contain account details
        # Find the actual data starting row by looking for 'Date' or similar
        data_start_row = 0
        for i, row in df.iterrows():
            if any(str(cell).lower().strip() in ['date', 'transaction date', 'value date'] for cell in row):
                data_start_row = i
                break
        
        print(f"Data starts at row: {data_start_row}")
        
        # Extract the actual data starting from the header row
        if data_start_row > 0:
            # Use the row with 'Date' as headers
            headers = df.iloc[data_start_row].tolist()
            # Get data from next row onwards
            data_df = df.iloc[data_start_row + 1:].copy()
            data_df.columns = headers
        else:
            # Fallback: use current structure
            data_df = df.copy()
        
        # Clean the column names
        data_df.columns = [str(col).strip() if pd.notna(col) else f'Column_{i}' for i, col in enumerate(data_df.columns)]
        
        # Remove completely empty rows and columns
        data_df = data_df.dropna(how='all', axis=0)  # Remove rows that are all NaN
        data_df = data_df.dropna(how='all', axis=1)  # Remove columns that are all NaN
        
        print(f"Processed bank statement - shape: {data_df.shape}")
        print(f"Headers: {list(data_df.columns)}")
        print("Sample data:")
        print(data_df.head())
        
        # Convert to CSV
        data_df.to_csv(csvFilePath, index=False, encoding='utf-8')
        
    else:
        print("Standard Excel format detected")
        # Standard processing for regular Excel files
        df = df.dropna(how='all', axis=0)  # Remove rows that are all NaN
        df = df.dropna(how='all', axis=1)  # Remove columns that are all NaN
        df.to_csv(csvFilePath, index=False, encoding='utf-8')
    
    # Verify the CSV was created
    if os.path.exists(csvFilePath):
        print(f"CSV file created successfully: {csvFilePath}")
        # Read first few lines to verify
        with open(csvFilePath, 'r') as f:
            lines = f.readlines()[:8]
            print("First 8 lines of CSV:")
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