#!/usr/bin/env python3
import bcrypt
import asyncpg
import asyncio

async def create_test_user():
    # Hash the password
    password = "password"
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    print(f"Password hash: {password_hash}")
    
    # Connect to database
    conn = await asyncpg.connect("postgresql://postgres:1@localhost:5432/finance_app")
    
    try:
        # Get a tenant ID
        tenant_row = await conn.fetchrow("SELECT id FROM tenants LIMIT 1")
        if not tenant_row:
            print("No tenants found in database")
            return
        
        tenant_id = tenant_row['id']
        
        # Insert or update test user
        await conn.execute("""
            INSERT INTO users (id, email, first_name, last_name, password_hash, tenant_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                updated_at = NOW()
        """, 'test-user-1', 'test@example.com', 'Test', 'User', password_hash, tenant_id)
        
        print("✅ Test user created/updated successfully")
        print("Email: test@example.com")
        print("Password: password")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(create_test_user())
