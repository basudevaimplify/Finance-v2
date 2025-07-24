/**
 * Initialize Demo Data
 * Creates required users and tenants for testing
 */

import { db, pool } from '../server/db';
import { users, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function initializeDemoData() {
  console.log('🚀 Initializing demo data...');
  
  try {
    // Create demo tenant
    const demoTenant = {
      id: '66a2a729-dfeb-4a96-b0bb-d65b91aeabb8',
      companyName: 'Demo Company Ltd',
      cin: 'U72900DL2020PTC123456',
      gstin: '07AABCU9603R1ZX',
      pan: 'AABCU9603R',
      registeredAddress: '123 Business District, New Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India',
      phone: '+91-11-12345678',
      email: 'admin@democompany.com',
      website: 'https://democompany.com',
      subscriptionTier: 'trial' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📊 Creating demo tenant...');
    await db.insert(tenants).values(demoTenant).onConflictDoNothing();
    console.log('✅ Demo tenant created');

    // Create demo user
    const demoUser = {
      id: 'demo-user',
      email: 'demo@finance.app',
      name: 'Demo User',
      role: 'admin' as const,
      tenantId: '66a2a729-dfeb-4a96-b0bb-d65b91aeabb8',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('👤 Creating demo user...');
    await db.insert(users).values(demoUser).onConflictDoNothing();
    console.log('✅ Demo user created');

    // Verify data was created
    console.log('🔍 Verifying demo data...');
    
    const tenantCheck = await db.select().from(tenants).where(eq(tenants.id, demoTenant.id));
    const userCheck = await db.select().from(users).where(eq(users.id, demoUser.id));
    
    if (tenantCheck.length > 0) {
      console.log('✅ Demo tenant verified');
    } else {
      console.log('❌ Demo tenant not found');
    }
    
    if (userCheck.length > 0) {
      console.log('✅ Demo user verified');
    } else {
      console.log('❌ Demo user not found');
    }

    console.log('\n🎉 Demo data initialization completed!');
    console.log('📋 Demo credentials:');
    console.log(`   User ID: ${demoUser.id}`);
    console.log(`   Email: ${demoUser.email}`);
    console.log(`   Tenant ID: ${demoTenant.id}`);
    console.log(`   Tenant Name: ${demoTenant.name}`);

  } catch (error) {
    console.error('❌ Demo data initialization failed:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the initialization
initializeDemoData().catch((error) => {
  console.error('💥 Initialization failed:', error);
  process.exit(1);
});
