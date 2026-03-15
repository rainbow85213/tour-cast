import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// DATABASE_URL 이 있으면 연결 문자열 우선 사용 (IPv6·SSL 옵션 포함 가능)
// 없으면 개별 파라미터 사용
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:      false,
    });

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  const { rows } = await client.query('SELECT NOW() AS time');
  console.log(`PostgreSQL connected: ${rows[0].time}`);
  client.release();
}

export default pool;
