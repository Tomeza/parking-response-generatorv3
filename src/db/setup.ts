import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'parking_response',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    // マイグレーションファイルを読み込んで実行
    const migrationPath = path.join(__dirname, 'migrations', '001_create_admin_users.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migration);

    // 初期管理者ユーザーの作成
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // 既存のユーザーをチェック
    const existingUser = await client.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [adminUsername]
    );

    if (existingUser.rows.length === 0) {
      await client.query(
        'INSERT INTO admin_users (username, password_hash, email) VALUES ($1, $2, $3)',
        [adminUsername, passwordHash, 'admin@example.com']
      );
      console.log('Initial admin user created');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    client.release();
  }
}

runMigrations().catch(console.error); 