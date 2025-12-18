import { readFileSync } from 'fs';
import { getPool, testConnection, closePool } from './database.js';

async function initializeDatabase() {
  console.log('Initializing database...');
  
  // Test connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Error: Could not connect to database');
    process.exit(1);
  }

  try {
    // Read and execute schema
    const schema = readFileSync('src/config/schema.sql', 'utf-8');
    
    const pool = getPool();
    await pool.query(schema);
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error: Error initializing database:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

initializeDatabase();