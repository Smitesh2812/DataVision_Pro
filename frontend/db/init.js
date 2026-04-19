// db/init.js  ─── MySQL version
// Run ONCE to create all tables: node db/init.js
//
// POSTGRESQL → MYSQL DIFFERENCES IN THIS FILE:
//   SERIAL PRIMARY KEY      →  INT AUTO_INCREMENT PRIMARY KEY
//   BOOLEAN                 →  TINYINT(1)   (MySQL has no native bool)
//   TEXT                    →  TEXT / LONGTEXT
//   TIMESTAMP DEFAULT NOW() →  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   ON UPDATE               →  ON UPDATE CURRENT_TIMESTAMP
//   $1, $2                  →  ?,  ?    (parameter placeholders)
//   INTERVAL '7 days'       →  DATE_ADD(NOW(), INTERVAL 7 DAY)
//   REFERENCES x ON DELETE  →  same syntax ✓
//   VARCHAR                 →  same ✓
//   CREATE INDEX IF NOT EXISTS → same ✓

require('dotenv').config();
const mysql = require('mysql2/promise');

async function initDB() {
  // Connect WITHOUT specifying the database first
  // so we can CREATE it if it doesn't exist
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'smitesh2812',
  });

  const DB = process.env.DB_NAME || 'datavision';
  console.log('🔌 Connected to MySQL server...');

  // Create database if it doesn't exist
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB}\``);
  console.log(`✅ Using database: ${DB}`);

  // ───────────────────────────────────────────────────────────
  // USERS TABLE
  // TINYINT(1) = MySQL's boolean (0=false, 1=true)
  // AUTO_INCREMENT = PostgreSQL's SERIAL
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      email          VARCHAR(255) UNIQUE NOT NULL,
      password_hash  VARCHAR(255) NOT NULL,
      first_name     VARCHAR(100) NOT NULL,
      last_name      VARCHAR(100) DEFAULT '',
      company        VARCHAR(200) DEFAULT '',
      role           VARCHAR(50)  DEFAULT 'owner',
      plan           VARCHAR(20)  DEFAULT 'free',
      plan_expires   TIMESTAMP NULL DEFAULT NULL,
      avatar_color   VARCHAR(7)   DEFAULT '#5b8ff9',
      is_active      TINYINT(1)   DEFAULT 1,
      is_verified    TINYINT(1)   DEFAULT 0,
      created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login     TIMESTAMP NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ Table: users');

  // ───────────────────────────────────────────────────────────
  // SESSIONS TABLE
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      token_hash  VARCHAR(255) NOT NULL,
      ip_address  VARCHAR(50)  DEFAULT NULL,
      user_agent  TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at  TIMESTAMP NOT NULL,
      is_valid    TINYINT(1) DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ Table: sessions');

  // ───────────────────────────────────────────────────────────
  // DATASETS TABLE
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS datasets (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      user_id            INT NOT NULL,
      name               VARCHAR(255) NOT NULL,
      original_filename  VARCHAR(255) DEFAULT NULL,
      file_type          VARCHAR(20)  DEFAULT NULL,
      row_count          INT          DEFAULT 0,
      col_count          INT          DEFAULT 0,
      file_size          BIGINT       DEFAULT 0,
      columns_json       LONGTEXT,
      is_public          TINYINT(1)   DEFAULT 0,
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ Table: datasets');

  // ───────────────────────────────────────────────────────────
  // CHART CONFIGS TABLE
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS chart_configs (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      dataset_id  INT NOT NULL,
      name        VARCHAR(255) DEFAULT NULL,
      config_json LONGTEXT NOT NULL,
      thumbnail   LONGTEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ Table: chart_configs');

  // ───────────────────────────────────────────────────────────
  // AUDIT LOG TABLE
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NULL,
      action     VARCHAR(100) NOT NULL,
      detail     TEXT,
      ip_address VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ Table: audit_log');

  // ───────────────────────────────────────────────────────────
  // INDEXES — speeds up lookups
  // MySQL syntax: CREATE INDEX IF NOT EXISTS (same as PostgreSQL)
  // ───────────────────────────────────────────────────────────
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_valid  ON sessions(is_valid, expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_datasets_user   ON datasets(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_configs_user    ON chart_configs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action)',
  ];
  for (const idx of indexes) {
    await conn.query(idx).catch(() => {}); // ignore "already exists" errors
  }
  console.log('✅ Indexes created');

  // ───────────────────────────────────────────────────────────
  // SEED DATA — demo accounts
  // Passwords (bcrypt hashes):
  //   admin@datavision.pro → admin123
  //   demo@datavision.pro  → demo123
  //
  // Generate new hashes:
  //   node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpass',12))"
  // ───────────────────────────────────────────────────────────
  await conn.query(`
    INSERT IGNORE INTO users
      (email, password_hash, first_name, last_name, company, role, plan, is_verified)
    VALUES
      ('admin@datavision.pro',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCkJ3mCEFqJBl2L4gBe6vUO',
       'Admin', 'User', 'DataVision Pro', 'admin', 'enterprise', 1),
      ('demo@datavision.pro',
       '$2a$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
       'Demo', 'User', 'Demo Company', 'analyst', 'free', 1)
  `);
  // NOTE: MySQL uses INSERT IGNORE instead of PostgreSQL's ON CONFLICT DO NOTHING

  console.log('✅ Demo accounts seeded');
  console.log('\n──────────────────────────────');
  console.log('Demo credentials:');
  console.log('  admin@datavision.pro / admin123  (Enterprise)');
  console.log('  demo@datavision.pro  / demo123   (Free)');
  console.log('──────────────────────────────\n');

  await conn.end();
}

initDB().catch(err => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
