import config from "@/config/env.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as schema from "./schema/index.js";
import logger from "@/utils/logger.js";
import { autoSeedIfEmpty } from "./seed/seed.js";
import { sql } from "drizzle-orm";

const pool = new Pool({
  connectionString: config.database.url,
});

export const db = drizzle(pool, { schema });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase() {
  try {
    // Check if incidents table exists using standard PostgreSQL information_schema
    const tableCheck = await db.execute<{ count: string }>(
      sql`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incidents'`
    );
    const count = parseInt(String(tableCheck.rows[0]?.count || '0'), 10);

    if (count === 0) {
      logger.info('Database tables missing. Executing initial schema creation DDL...');
      const migrationsFolder = path.resolve(__dirname, 'drizzle');
      const sqlFiles = ['0000_freezing_loners.sql', '0001_sweet_kinsey_walden.sql'];

      for (const file of sqlFiles) {
        const filePath = path.join(migrationsFolder, file);
        if (fs.existsSync(filePath)) {
          const sqlContent = fs.readFileSync(filePath, 'utf-8');
          const statements = sqlContent.split('--> statement-breakpoint');
          for (const stmt of statements) {
            const trimmed = stmt.trim();
            if (trimmed) {
              await db.execute(sql.raw(trimmed));
            }
          }
        }
      }
      logger.info('Database schema tables created successfully.');
    } else {
      logger.info('Database schema tables already exist.');
    }
  } catch (err) {
    logger.warn('Schema initialization notice:', err instanceof Error ? err.message : err);
  }

  await autoSeedIfEmpty();
}