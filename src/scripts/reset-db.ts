import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../lib/db/schema';
import dotenv from 'dotenv';

dotenv.config();

async function resetDatabase() {
  // First connect to 'postgres' database to create our target database
  const mainPool = new Pool({
    connectionString: process.env.POSTGRES_URL?.replace(/\/[^/]+$/, '/postgres'),
  });

  const dbName = 'ericai'; 

  try {
    // Create database if it doesn't exist
    await mainPool.query(`
      SELECT 'CREATE DATABASE ${dbName}'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}')
    `);
    
    console.log('Ensured database exists');
    
    // Close connection to postgres database
    await mainPool.end();

    // Connect to our target database
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    });

    const db = drizzle(pool, { schema });

    // Drop all existing tables
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);

    console.log('Successfully dropped all tables');

    // Run migrations to recreate tables
    await migrate(db, { migrationsFolder: 'drizzle' });
    
    console.log('Successfully recreated all tables');
    
    await pool.end();
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

resetDatabase(); 