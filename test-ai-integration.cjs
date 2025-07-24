/**
 * Test AI Service Integration
 */

const axios = require('axios');

async function testAIServiceIntegration() {
  console.log('🧪 Testing AI Service Integration...');
  
  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:8000/health', { timeout: 5000 });
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test classification endpoint
    console.log('2. Testing classification endpoint...');
    const FormData = require('form-data');
    const fs = require('fs');
    
    const formData = new FormData();
    const fileStream = fs.createReadStream('test-files/test-upload.csv');
    formData.append('file', fileStream, {
      filename: 'test-upload.csv',
      contentType: 'text/csv'
    });
    
    const classifyResponse = await axios.post(
      'http://localhost:8000/classify/document',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Classification test passed:', {
      type: classifyResponse.data.document_type,
      confidence: classifyResponse.data.confidence
    });
    
    // Test extraction endpoint
    console.log('3. Testing extraction endpoint...');
    const formData2 = new FormData();
    const fileStream2 = fs.createReadStream('test-files/test-upload.csv');
    formData2.append('file', fileStream2, {
      filename: 'test-upload.csv',
      contentType: 'text/csv'
    });
    
    const extractResponse = await axios.post(
      'http://localhost:8000/extract/document',
      formData2,
      {
        headers: {
          ...formData2.getHeaders(),
        },
        timeout: 15000
      }
    );
    
    console.log('✅ Extraction test passed:', {
      records: extractResponse.data.extraction.total_records,
      confidence: extractResponse.data.extraction.extraction_confidence
    });
    
    console.log('🎉 All AI Service Integration tests passed!');
    
  } catch (error) {
    console.error('❌ AI Service Integration test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAIServiceIntegration();
