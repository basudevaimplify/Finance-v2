#!/usr/bin/env python3
"""
Create test Excel files for sales and purchase registers
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
import random

def create_sales_register():
    """Create a realistic sales register Excel file"""
    
    # Create test-files directory if it doesn't exist
    os.makedirs('test-files', exist_ok=True)
    
    # Sample customer data
    customers = [
        "Acme Corporation", "TechNova Inc.", "Global Solutions Ltd.",
        "Pinnacle Enterprises", "Quantum Industries", "Apex Consulting",
        "Stellar Systems", "Horizon Partners", "Elite Services",
        "Prime Ventures", "Dynamic Solutions", "Fusion Technologies"
    ]
    
    # Sample product/service data
    products = [
        "Web Development", "Mobile App Development", "Cloud Migration",
        "IT Consulting", "Software License", "Maintenance Contract",
        "Training Services", "Data Analysis", "Security Audit",
        "Network Setup", "Hardware Supply", "Support Services"
    ]
    
    # Generate random dates
    start_date = datetime(2025, 1, 1)
    dates = [start_date + timedelta(days=i*3) for i in range(25)]
    
    # Generate invoice numbers
    invoice_numbers = [f"INV-{2025}-{i+101:03d}" for i in range(25)]
    
    # Generate random data
    data = []
    for i in range(25):
        customer = random.choice(customers)
        product = random.choice(products)
        quantity = random.randint(1, 10)
        rate = random.choice([1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000])
        amount = quantity * rate
        tax_rate = 0.18  # 18% GST
        tax = round(amount * tax_rate, 2)
        total = amount + tax
        
        data.append({
            "Date": dates[i].strftime("%d-%m-%Y"),
            "Customer": customer,
            "Invoice#": invoice_numbers[i],
            "Description": product,
            "Quantity": quantity,
            "Rate": rate,
            "Amount": amount,
            "Tax (18%)": tax,
            "Total": total
        })
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Calculate totals
    total_amount = df["Amount"].sum()
    total_tax = df["Tax (18%)"].sum()
    total_invoice = df["Total"].sum()
    
    # Add summary row
    summary = pd.DataFrame([{
        "Date": "TOTAL",
        "Customer": "",
        "Invoice#": "",
        "Description": "",
        "Quantity": df["Quantity"].sum(),
        "Rate": "",
        "Amount": total_amount,
        "Tax (18%)": total_tax,
        "Total": total_invoice
    }])
    
    # Combine data and summary
    df_final = pd.concat([df, summary])
    
    # Save to Excel
    excel_path = 'test-files/test-sales-register.xlsx'
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        df_final.to_excel(writer, sheet_name='Sales Register', index=False)
    
    print(f"✅ Created {excel_path}")
    return excel_path

def create_purchase_register():
    """Create a realistic purchase register Excel file"""
    
    # Create test-files directory if it doesn't exist
    os.makedirs('test-files', exist_ok=True)
    
    # Sample vendor data
    vendors = [
        "Office Supplies Co.", "Tech Hardware Ltd.", "Software Solutions Inc.",
        "Global Services", "Premium Consultants", "Quality Equipment",
        "Best Vendors", "Reliable Suppliers", "Professional Services",
        "Expert Contractors", "Utility Providers", "Business Essentials"
    ]
    
    # Sample expense categories
    categories = [
        "Office Supplies", "IT Equipment", "Software Licenses",
        "Professional Services", "Utilities", "Rent",
        "Travel Expenses", "Marketing", "Training",
        "Maintenance", "Insurance", "Miscellaneous"
    ]
    
    # Generate random dates
    start_date = datetime(2025, 1, 1)
    dates = [start_date + timedelta(days=i*3) for i in range(25)]
    
    # Generate PO numbers
    po_numbers = [f"PO-{2025}-{i+101:03d}" for i in range(25)]
    
    # Generate random data
    data = []
    for i in range(25):
        vendor = random.choice(vendors)
        category = random.choice(categories)
        amount = random.randint(500, 10000)
        tax_rate = 0.18  # 18% GST
        tax = round(amount * tax_rate, 2)
        total = amount + tax
        
        data.append({
            "Date": dates[i].strftime("%d-%m-%Y"),
            "Vendor": vendor,
            "PO#": po_numbers[i],
            "Description": f"{category} - {random.choice(['Monthly', 'One-time', 'Annual'])}",
            "Category": category,
            "Amount": amount,
            "Tax (18%)": tax,
            "Total": total
        })
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Calculate totals
    total_amount = df["Amount"].sum()
    total_tax = df["Tax (18%)"].sum()
    total_invoice = df["Total"].sum()
    
    # Add summary row
    summary = pd.DataFrame([{
        "Date": "TOTAL",
        "Vendor": "",
        "PO#": "",
        "Description": "",
        "Category": "",
        "Amount": total_amount,
        "Tax (18%)": total_tax,
        "Total": total_invoice
    }])
    
    # Combine data and summary
    df_final = pd.concat([df, summary])
    
    # Save to Excel
    excel_path = 'test-files/test-purchase-register.xlsx'
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        df_final.to_excel(writer, sheet_name='Purchase Register', index=False)
    
    print(f"✅ Created {excel_path}")
    return excel_path

if __name__ == "__main__":
    try:
        create_sales_register()
        create_purchase_register()
    except ImportError as e:
        print(f"❌ Missing required library: {e}")
        print("Please install required libraries: pip install pandas openpyxl")
    except Exception as e:
        print(f"❌ Error creating Excel files: {e}")
