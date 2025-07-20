import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pg from "pg";
import dotenv from "dotenv";

// Get directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from the correct path (two levels up)
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// Debug: Verify env file is loading
console.log(`Loading environment from: ${envPath}`);
console.log("DB_HOST:", process.env.DB_HOST ? "✅ Found" : "❌ Missing");

const { Pool } = pg;

// Create database pool with environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === "production"
  }
});

const modelsDir = path.join(__dirname, "../models");

// Event listeners
pool.on("connect", () => {
  console.log("✅ Database connection established");
});

pool.on("error", (err) => {
  console.error("❌ Database connection error:", err);
  process.exit(1);
});

/**
 * Create schema if not exists
 */
async function ensureSchemaExists(schemaName) {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    console.log(`✅ Schema '${schemaName}' ensured`);
  } catch (err) {
    console.error(`❌ Failed to ensure schema '${schemaName}':`, err);
    throw err;
  }
}

/**
 * Check if a table exists
 */
async function checkTableExists(tableName) {
  try {
    const result = await pool.query(`SELECT to_regclass('${tableName}')`);
    return result.rows[0]?.to_regclass !== null;
  } catch (err) {
    console.error(`❌ Error checking table ${tableName}:`, err);
    throw err;
  }
}

/**
 * Migrate a single model
 */
async function migrateModel(modelName) {
  const modelPath = path.join(modelsDir, `${modelName}.sql`);
  
  if (!fs.existsSync(modelPath)) {
    console.error(`❌ Model file for ${modelName} not found at ${modelPath}`);
    return;
  }

  const client = await pool.connect();
  try {
    const createTableQuery = fs.readFileSync(modelPath, "utf-8");
    const tableExists = await checkTableExists(`hisab.${modelName}`);

    if (tableExists) {
      console.log(`ℹ️  Table hisab.${modelName} already exists`);
      return;
    }

    console.log(`🔄 Creating table for hisab.${modelName}`);
    await client.query("BEGIN");
    await client.query(createTableQuery);
    await client.query("COMMIT");
    console.log(`✅ Successfully created table hisab.${modelName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to migrate model ${modelName}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run all migrations
 */
async function runMigrations() {
  console.log("🚀 Starting database migrations...");

  try {
    await pool.query("SELECT 1"); // Verify DB connection
    await ensureSchemaExists("hisab"); // Ensure schema exists

    const modelFiles = fs.readdirSync(modelsDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => file.replace(".sql", ""));

    if (modelFiles.length === 0) {
      console.log("ℹ️  No migration files found in models directory");
      return;
    }

    for (const modelName of modelFiles) {
      await migrateModel(modelName);
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Execute the migration
runMigrations();
