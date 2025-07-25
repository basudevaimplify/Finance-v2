#!/usr/bin/env node

/**
 * Database Verification Script
 * Queries the PostgreSQL database to verify stored document data
 */

import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/finance_app";

console.log("🔍 FINANCE-V2 DATABASE VERIFICATION");
console.log("=====================================");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

async function verifyDatabase() {
  try {
    console.log("\n📊 Connecting to database...");
    const client = await pool.connect();
    
    // 1. Check documents table
    console.log("\n📄 DOCUMENTS TABLE:");
    console.log("-------------------");
    const documentsResult = await client.query(`
      SELECT 
        id, 
        file_name, 
        original_name, 
        document_type, 
        status, 
        file_size,
        uploaded_by,
        created_at,
        updated_at,
        CASE 
          WHEN extracted_data IS NOT NULL THEN 'YES'
          ELSE 'NO'
        END as has_extracted_data,
        CASE 
          WHEN metadata IS NOT NULL THEN 'YES'
          ELSE 'NO'
        END as has_metadata
      FROM documents 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`Found ${documentsResult.rows.length} documents:`);
    documentsResult.rows.forEach((doc, index) => {
      console.log(`\n${index + 1}. Document: ${doc.original_name}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${doc.document_type}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Size: ${doc.file_size} bytes`);
      console.log(`   Uploaded: ${doc.created_at}`);
      console.log(`   Has Extracted Data: ${doc.has_extracted_data}`);
      console.log(`   Has Metadata: ${doc.has_metadata}`);
    });

    // 2. Check extracted data details for recent documents
    console.log("\n📊 EXTRACTED DATA DETAILS:");
    console.log("---------------------------");
    const extractedDataResult = await client.query(`
      SELECT 
        id,
        original_name,
        document_type,
        extracted_data,
        metadata
      FROM documents 
      WHERE extracted_data IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    extractedDataResult.rows.forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.original_name} (${doc.document_type})`);
      console.log(`   Document ID: ${doc.id}`);
      
      if (doc.extracted_data) {
        const extractedData = doc.extracted_data;
        console.log(`   📋 Extracted Records: ${extractedData.totalRecords || 'N/A'}`);
        console.log(`   🎯 Confidence: ${extractedData.confidence || 'N/A'}`);
        console.log(`   🤖 AI Enhanced: ${extractedData.aiEnhanced || 'N/A'}`);
        console.log(`   📝 Headers: ${extractedData.headers ? extractedData.headers.join(', ') : 'N/A'}`);
        
        if (extractedData.records && extractedData.records.length > 0) {
          console.log(`   📊 Sample Record:`);
          const sampleRecord = extractedData.records[0];
          Object.keys(sampleRecord).slice(0, 5).forEach(key => {
            console.log(`      ${key}: ${sampleRecord[key]}`);
          });
          if (Object.keys(sampleRecord).length > 5) {
            console.log(`      ... and ${Object.keys(sampleRecord).length - 5} more fields`);
          }
        }
      }
      
      if (doc.metadata) {
        const metadata = doc.metadata;
        console.log(`   🔍 Classification Method: ${metadata.classificationMethod || 'N/A'}`);
        if (metadata.contentAnalysis) {
          console.log(`   📋 Classification: ${metadata.contentAnalysis.documentType} (${metadata.contentAnalysis.confidence})`);
        }
      }
    });

    // 3. Check journal entries
    console.log("\n📚 JOURNAL ENTRIES:");
    console.log("-------------------");
    const journalResult = await client.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT document_id) as documents_with_entries
      FROM journal_entries
    `);
    
    console.log(`Total Journal Entries: ${journalResult.rows[0].total_entries}`);
    console.log(`Documents with Entries: ${journalResult.rows[0].documents_with_entries}`);

    // 4. Check agent jobs
    console.log("\n🤖 AGENT JOBS:");
    console.log("---------------");
    const agentJobsResult = await client.query(`
      SELECT
        agent_name,
        status,
        COUNT(*) as count
      FROM agent_jobs
      GROUP BY agent_name, status
      ORDER BY agent_name, status
    `);
    
    if (agentJobsResult.rows.length > 0) {
      agentJobsResult.rows.forEach(job => {
        console.log(`${job.agent_name} (${job.status}): ${job.count}`);
      });
    } else {
      console.log("No agent jobs found");
    }

    // 5. Database statistics
    console.log("\n📈 DATABASE STATISTICS:");
    console.log("-----------------------");
    const statsResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM documents) as total_documents,
        (SELECT COUNT(*) FROM documents WHERE extracted_data IS NOT NULL) as documents_with_data,
        (SELECT COUNT(*) FROM journal_entries) as total_journal_entries,
        (SELECT COUNT(*) FROM agent_jobs) as total_agent_jobs,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM tenants) as total_tenants
    `);
    
    const stats = statsResult.rows[0];
    console.log(`Total Documents: ${stats.total_documents}`);
    console.log(`Documents with Extracted Data: ${stats.documents_with_data}`);
    console.log(`Total Journal Entries: ${stats.total_journal_entries}`);
    console.log(`Total Agent Jobs: ${stats.total_agent_jobs}`);
    console.log(`Total Users: ${stats.total_users}`);
    console.log(`Total Tenants: ${stats.total_tenants}`);

    client.release();
    console.log("\n✅ Database verification completed!");
    
  } catch (error) {
    console.error("❌ Database verification failed:", error);
  } finally {
    await pool.end();
  }
}

// Run verification
verifyDatabase();
