import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  const { rows } = await client.query('SELECT NOW() AS time');
  console.log(`PostgreSQL connected: ${rows[0].time}`);
  client.release();
}

export default pool;
