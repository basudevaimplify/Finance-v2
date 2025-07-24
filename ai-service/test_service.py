#!/usr/bin/env python3
"""
Test script for FastAPI AI Document Processor
"""

import requests
import json
import os
from pathlib import Path

def test_health_check():
    """Test the health check endpoint"""
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code == 200:
            data = response.json()
            print("✅ Health check passed:")
            print(f"   Status: {data['status']}")
            print(f"   Service: {data['service']}")
            print(f"   OpenAI Available: {data['openai_available']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_document_classification(file_path):
    """Test document classification endpoint"""
    try:
        if not os.path.exists(file_path):
            print(f"❌ Test file not found: {file_path}")
            return False
            
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'text/csv')}
            response = requests.post("http://localhost:8000/classify/document", files=files)
            
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Classification successful for {os.path.basename(file_path)}:")
            print(f"   Document Type: {data['document_type']}")
            print(f"   Confidence: {data['confidence']:.2f}")
            print(f"   Reasoning: {data['reasoning']}")
            return True
        else:
            print(f"❌ Classification failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Classification error: {e}")
        return False

def test_document_extraction(file_path):
    """Test document extraction endpoint"""
    try:
        if not os.path.exists(file_path):
            print(f"❌ Test file not found: {file_path}")
            return False
            
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'text/csv')}
            response = requests.post("http://localhost:8000/extract/document", files=files)
            
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Extraction successful for {os.path.basename(file_path)}:")
            print(f"   Document Type: {data['classification']['document_type']}")
            print(f"   Classification Confidence: {data['classification']['confidence']:.2f}")
            print(f"   Records Extracted: {data['extraction']['total_records']}")
            print(f"   Extraction Confidence: {data['extraction']['extraction_confidence']:.2f}")
            print(f"   Processing Time: {data['processing_time_ms']}ms")
            print(f"   AI Enhanced: {data['ai_enhanced']}")
            return True
        else:
            print(f"❌ Extraction failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Extraction error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing FastAPI AI Document Processor")
    print("=" * 50)
    
    # Test health check
    print("\n1. Testing Health Check...")
    health_ok = test_health_check()
    
    if not health_ok:
        print("❌ Service not available. Make sure it's running on port 8000")
        return
    
    # Test files
    test_files = [
        "../test-files/bank-statement-sample.csv",
        "../test-files/sales-register-sample.csv", 
        "../test-files/purchase-register-sample.csv"
    ]
    
    # Test classification
    print("\n2. Testing Document Classification...")
    for file_path in test_files:
        if os.path.exists(file_path):
            test_document_classification(file_path)
        else:
            print(f"⚠️  Test file not found: {file_path}")
    
    # Test extraction
    print("\n3. Testing Document Extraction...")
    for file_path in test_files:
        if os.path.exists(file_path):
            test_document_extraction(file_path)
        else:
            print(f"⚠️  Test file not found: {file_path}")
    
    print("\n🎉 Testing completed!")

if __name__ == "__main__":
    main()
