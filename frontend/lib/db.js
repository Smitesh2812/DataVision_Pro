import mysql from "mysql2/promise";

let pool;

export default async function getPool() {
  try {
    if (!pool) {
      console.log("🔌 Creating DB connection...");

      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,

        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      });
    }

    return pool;

  } catch (err) {
    console.error("❌ DB ERROR:", err);
    throw err;
  }
}