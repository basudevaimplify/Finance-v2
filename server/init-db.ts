import 'dotenv/config';
import { db } from './db';
import { users, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database with default data...');

    // Check if default tenant exists
    const existingTenant = await db.select().from(tenants).where(eq(tenants.companyName, 'Default Company')).limit(1);

    let defaultTenantId: string;

    if (existingTenant.length === 0) {
      console.log('📝 Creating default tenant...');
      const [newTenant] = await db.insert(tenants).values({
        companyName: 'Default Company',
        email: 'admin@defaultcompany.com',
        city: 'Default City',
        state: 'Default State',
        isActive: true
      }).returning();
      defaultTenantId = newTenant.id;
      console.log('✅ Default tenant created:', defaultTenantId);
    } else {
      defaultTenantId = existingTenant[0].id;
      console.log('✅ Default tenant already exists:', defaultTenantId);
    }

    // Check if demo user exists
    const existingUser = await db.select().from(users).where(eq(users.email, 'demo@example.com')).limit(1);

    let defaultUserId: string;

    if (existingUser.length === 0) {
      console.log('👤 Creating demo user...');
      defaultUserId = 'demo-user'; // Fixed ID for demo user
      const [newUser] = await db.insert(users).values({
        id: defaultUserId,
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'admin',
        tenantId: defaultTenantId,
        tenantRole: 'admin',
        isActive: true,
        passwordHash: null // No password for demo user
      }).returning();
      console.log('✅ Demo user created:', defaultUserId);
    } else {
      defaultUserId = existingUser[0].id;
      console.log('✅ Demo user already exists:', defaultUserId);
    }

    console.log('🎉 Database initialization completed successfully!');
    console.log('📊 Default tenant ID:', defaultTenantId);
    console.log('👤 Default user ID:', defaultUserId);
    
    return { defaultTenantId, defaultUserId };
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      console.log('✅ Initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
