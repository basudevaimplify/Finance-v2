#!/usr/bin/env python3
"""
Create test PDF bank statement for testing
"""

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from datetime import datetime, timedelta
import os

def create_bank_statement_pdf():
    """Create a realistic bank statement PDF"""
    
    # Create test-files directory if it doesn't exist
    os.makedirs('test-files', exist_ok=True)
    
    # Create PDF document
    doc = SimpleDocTemplate(
        'test-files/test-bank-statement.pdf',
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18
    )
    
    # Get styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30,
        alignment=1  # Center alignment
    )
    
    # Build document content
    story = []
    
    # Bank header
    story.append(Paragraph("DEMO BANK", title_style))
    story.append(Paragraph("Account Statement", styles['Heading2']))
    story.append(Spacer(1, 12))
    
    # Account information
    account_info = [
        ["Account Holder:", "Demo Company Ltd"],
        ["Account Number:", "1234567890"],
        ["Statement Period:", "January 1, 2025 - January 31, 2025"],
        ["Opening Balance:", "$50,000.00"],
        ["Closing Balance:", "$95,650.00"]
    ]
    
    account_table = Table(account_info, colWidths=[2*inch, 3*inch])
    account_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    story.append(account_table)
    story.append(Spacer(1, 20))
    
    # Transaction header
    story.append(Paragraph("Transaction Details", styles['Heading3']))
    story.append(Spacer(1, 12))
    
    # Transaction data
    transactions = [
        ["Date", "Description", "Reference", "Debit", "Credit", "Balance"],
        ["01/01/2025", "Opening Balance", "OB001", "", "", "50,000.00"],
        ["01/02/2025", "Office Rent Payment", "CHQ001", "15,000.00", "", "35,000.00"],
        ["01/03/2025", "Client Payment Received", "DEP001", "", "25,000.00", "60,000.00"],
        ["01/04/2025", "Utility Bills", "CHQ002", "2,500.00", "", "57,500.00"],
        ["01/05/2025", "Software License", "CHQ003", "5,000.00", "", "52,500.00"],
        ["01/06/2025", "Consulting Revenue", "DEP002", "", "30,000.00", "82,500.00"],
        ["01/07/2025", "Office Supplies", "CHQ004", "1,200.00", "", "81,300.00"],
        ["01/08/2025", "Bank Charges", "AUTO001", "150.00", "", "81,150.00"],
        ["01/09/2025", "Client Payment", "DEP003", "", "18,000.00", "99,150.00"],
        ["01/10/2025", "Marketing Expenses", "CHQ005", "3,500.00", "", "95,650.00"],
        ["01/15/2025", "Equipment Purchase", "CHQ006", "12,000.00", "", "83,650.00"],
        ["01/18/2025", "Service Revenue", "DEP004", "", "22,500.00", "106,150.00"],
        ["01/22/2025", "Insurance Premium", "CHQ007", "4,800.00", "", "101,350.00"],
        ["01/25/2025", "Freelancer Payment", "CHQ008", "8,500.00", "", "92,850.00"],
        ["01/28/2025", "Monthly Retainer", "DEP005", "", "15,000.00", "107,850.00"]
    ]
    
    # Create transaction table
    transaction_table = Table(transactions, colWidths=[0.8*inch, 2.2*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch])
    transaction_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),  # Right align amounts
        ('ALIGN', (0, 1), (2, -1), 'LEFT'),    # Left align text columns
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    
    story.append(transaction_table)
    story.append(Spacer(1, 20))
    
    # Summary
    summary_data = [
        ["Total Debits:", "$52,650.00"],
        ["Total Credits:", "$110,500.00"],
        ["Net Change:", "$57,850.00"],
        ["Closing Balance:", "$107,850.00"]
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    story.append(summary_table)
    
    # Build PDF
    doc.build(story)
    print("✅ Created test-bank-statement.pdf")

if __name__ == "__main__":
    try:
        create_bank_statement_pdf()
    except ImportError as e:
        print(f"❌ Missing required library: {e}")
        print("Please install reportlab: pip install reportlab")
    except Exception as e:
        print(f"❌ Error creating PDF: {e}")
