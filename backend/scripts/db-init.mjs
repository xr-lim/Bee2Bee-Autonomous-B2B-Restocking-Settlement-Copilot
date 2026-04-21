import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".env.local" })
dotenv.config()

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL

  if (!databaseUrl) {
    throw new Error(
      "Missing SUPABASE_DB_URL. Set it in backend/.env.local before running db:init."
    )
  }

  const schemaPath = path.resolve(__dirname, "../supabase/schema.sql")
  const schemaSql = await readFile(schemaPath, "utf8")

  if (!schemaSql.trim()) {
    throw new Error("Schema file is empty: backend/supabase/schema.sql")
  }

  if (/\bdrop\s+(table|column)\b/i.test(schemaSql)) {
    console.warn(
      [
        "Warning: schema.sql contains destructive cleanup statements.",
        "This removes legacy UI-only tables/columns before recreating the domain schema.",
      ].join("\n")
    )
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query("BEGIN")
    await client.query(schemaSql)
    await client.query("COMMIT")
    console.log("Schema initialization completed successfully.")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("db:init failed:", error.message)

  if (
    error?.code === "ENOTFOUND" ||
    String(error?.message ?? "").includes("ENOTFOUND")
  ) {
    console.error(
      [
        "Hint: DNS could not resolve your database host.",
        "Use the Supabase Pooler connection string for SUPABASE_DB_URL",
        "(Project Settings -> Database -> Connection string -> Pooler).",
        "Then run: npm run db:init",
      ].join("\n")
    )
  }

  process.exit(1)
})
