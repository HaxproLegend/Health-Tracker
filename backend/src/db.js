import mysql from "mysql2/promise";
import "dotenv/config";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "health_tracker",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    age             INT          NULL,
    gender          VARCHAR(20)  NULL,
    height_cm       FLOAT        NULL,
    target_weight   FLOAT        NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CREATE_HEALTH_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS health_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    log_date        DATE NOT NULL,
    weight_kg       FLOAT NOT NULL,
    height_cm       FLOAT NOT NULL,
    bmi             FLOAT NOT NULL,
    bmi_category    VARCHAR(20) NOT NULL,
    systolic_bp     INT NULL,
    diastolic_bp    INT NULL,
    resting_hr      INT NULL,
    daily_steps     INT NULL,
    water_liters    FLOAT NULL,
    sleep_hours     FLOAT NULL,
    notes           TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_health_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_health_logs_user_date (user_id, log_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

/**
 * Idempotently create the schema. Safe to call on every boot.
 */
export async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(CREATE_USERS_TABLE);
    await conn.query(CREATE_HEALTH_LOGS_TABLE);
  } finally {
    conn.release();
  }
}

/**
 * Retry wrapper for transient connection failures (pool exhaustion,
 * the DB server still starting up, a dropped connection, etc.)
 */
export async function withRetry(fn, { attempts = 3, backoffMs = 400 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const transient = ["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT", "PROTOCOL_ENQUEUE_AFTER_QUIT"];
      if (attempt < attempts && transient.includes(err.code)) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export default pool;
