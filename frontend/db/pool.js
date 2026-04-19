// db/pool.js  ─── MySQL version
//
// KEY DIFFERENCES vs PostgreSQL:
//   PostgreSQL (pg)   uses  $1, $2, $3  for parameters
//   MySQL (mysql2)    uses  ?,  ?,  ?   for parameters
//
//   pg pool.query()   returns { rows: [...] }
//   mysql2 execute()  returns [ [rows], fields ]
//
// We wrap mysql2 so pool.query(sql, params) returns { rows }
// everywhere — meaning routes/auth.js and routes/datasets.js
// need ZERO changes from the PostgreSQL version.
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'datavision',

  connectionLimit:    20,
  idleTimeout:        30000,
  waitForConnections: true,
  queueLimit:         0,
  enableKeepAlive:    true,

  // SSL for cloud MySQL (PlanetScale, Railway, AWS RDS)
  ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined,
});

// Wrapper: normalize mysql2 output to { rows } so all
// existing route files work without modification
const wrappedPool = {
  async query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return { rows };
  },
  getConnection: () => pool.getConnection(),
};

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('🟢 MySQL connected →', process.env.DB_HOST + ':' + (process.env.DB_PORT||3306) + '/' + process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   → Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in your .env file');
    process.exit(1);
  });

export default wrappedPool;
