/**
 * Simple Database Cleanup Script
 * Uses direct SQL commands to clear all tables
 */

import { db, pool } from '../server/db';
import { sql } from 'drizzle-orm';

async function clearDatabase() {
  console.log('🧹 Starting database cleanup...');
  
  try {
    // List of tables to clear in order (respecting foreign key dependencies)
    const tablesToClear = [
      'audit_trail',
      'journal_entries', 
      'financial_statements',
      'compliance_checks',
      'reconciliation_matches',
      'reconciliation_reports',
      'intercompany_transactions',
      'agent_jobs',
      'documents',
      'data_sources',
      'users',
      'tenants'
    ];

    console.log(`📋 Clearing ${tablesToClear.length} tables...`);

    // Disable foreign key checks temporarily
    await db.execute(sql`SET session_replication_role = replica;`);
    console.log('⏸️  Foreign key constraints disabled');

    // Clear each table
    for (const tableName of tablesToClear) {
      try {
        console.log(`🗑️  Clearing table: ${tableName}`);
        await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE;`));
        console.log(`✅ Cleared: ${tableName}`);
      } catch (error) {
        console.error(`❌ Error clearing ${tableName}:`, error.message);
      }
    }

    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = DEFAULT;`);
    console.log('🔄 Foreign key constraints re-enabled');

    // Verify tables are empty
    console.log('🔍 Verifying cleanup...');
    let totalRecords = 0;
    
    for (const tableName of tablesToClear) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}";`));
        const count = parseInt(result[0].count as string);
        totalRecords += count;
        
        if (count > 0) {
          console.log(`⚠️  Table ${tableName} still has ${count} records`);
        } else {
          console.log(`✅ Table ${tableName} is empty`);
        }
      } catch (error) {
        console.error(`❌ Error checking ${tableName}:`, error.message);
      }
    }

    console.log('\n🎉 Database cleanup completed!');
    console.log(`📊 Total records remaining: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('✅ All tables successfully cleared!');
    } else {
      console.log('⚠️  Some tables may still contain data. Check the logs above.');
    }

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    // Ensure foreign key constraints are re-enabled
    try {
      await db.execute(sql`SET session_replication_role = DEFAULT;`);
    } catch (error) {
      console.error('❌ Error re-enabling foreign key constraints:', error);
    }
    
    // Close database connection
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
clearDatabase().catch((error) => {
  console.error('💥 Cleanup failed:', error);
  process.exit(1);
});
