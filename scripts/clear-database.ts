/**
 * Database Cleanup Script
 * Safely clears all data from database tables while preserving structure
 */

import { db, pool } from '../server/db';
import { sql } from 'drizzle-orm';
import {
  users,
  tenants,
  documents,
  agentJobs,
  journalEntries,
  financialStatements,
  complianceChecks,
  auditTrail,
  reconciliationReports,
  reconciliationMatches,
  intercompanyTransactions,
  dataSources
} from '@shared/schema';

async function clearAllTables() {
  console.log('🧹 Starting database cleanup...');
  
  try {
    // Disable foreign key checks temporarily
    console.log('⏸️  Disabling foreign key constraints...');
    await db.execute(sql`SET session_replication_role = replica;`);
    
    // Get all table names from the current schema
    const tablesResult = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'drizzle%'
      ORDER BY tablename;
    `);

    const tables = Array.isArray(tablesResult) ? tablesResult.map(row => row.tablename as string) : [];
    console.log(`📋 Found ${tables.length} tables to clear:`, tables);
    
    // Clear each table
    for (const tableName of tables) {
      try {
        console.log(`🗑️  Clearing table: ${tableName}`);
        await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE;`));
        console.log(`✅ Cleared: ${tableName}`);
      } catch (error) {
        console.error(`❌ Error clearing ${tableName}:`, error.message);
      }
    }
    
    // Re-enable foreign key checks
    console.log('🔄 Re-enabling foreign key constraints...');
    await db.execute(sql`SET session_replication_role = DEFAULT;`);
    
    // Reset sequences to start from 1
    console.log('🔢 Resetting sequences...');
    const sequencesResult = await db.execute(sql`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);
    
    for (const row of sequencesResult) {
      const sequenceName = row.sequence_name as string;
      try {
        await db.execute(sql.raw(`ALTER SEQUENCE "${sequenceName}" RESTART WITH 1;`));
        console.log(`🔄 Reset sequence: ${sequenceName}`);
      } catch (error) {
        console.error(`❌ Error resetting sequence ${sequenceName}:`, error.message);
      }
    }
    
    // Verify tables are empty
    console.log('🔍 Verifying cleanup...');
    let totalRecords = 0;
    
    for (const tableName of tables) {
      try {
        const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}";`));
        const count = parseInt(countResult[0].count as string);
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

// Additional function to clear specific tables only
async function clearSpecificTables(tableNames: string[]) {
  console.log(`🧹 Clearing specific tables: ${tableNames.join(', ')}`);
  
  try {
    await db.execute(sql`SET session_replication_role = replica;`);
    
    for (const tableName of tableNames) {
      try {
        console.log(`🗑️  Clearing table: ${tableName}`);
        await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE;`));
        console.log(`✅ Cleared: ${tableName}`);
      } catch (error) {
        console.error(`❌ Error clearing ${tableName}:`, error.message);
      }
    }
    
    await db.execute(sql`SET session_replication_role = DEFAULT;`);
    console.log('✅ Specific tables cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing specific tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Clear specific tables if provided as arguments
    await clearSpecificTables(args);
  } else {
    // Clear all tables
    await clearAllTables();
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

export { clearAllTables, clearSpecificTables };
