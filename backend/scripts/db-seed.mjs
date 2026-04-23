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

const TABLE_CONFIG = [
  { name: "suppliers", conflictKey: "id", jsonbCols: [] },
  { name: "products", conflictKey: "id", jsonbCols: [] },
  { name: "product_stock_demand_trends", conflictKey: "id", jsonbCols: [] },
  { name: "product_suppliers", conflictKey: "id", jsonbCols: [] },
  { name: "threshold_change_requests", conflictKey: "id", jsonbCols: [] },
  { name: "conversations", conflictKey: "id", jsonbCols: [] },
  { name: "conversation_products", conflictKey: "id", jsonbCols: [] },
  { name: "conversation_messages", conflictKey: "id", jsonbCols: [] },
  { name: "workflows", conflictKey: "id", jsonbCols: [] },
  { name: "restock_requests", conflictKey: "id", jsonbCols: [] },
  { name: "workflow_events", conflictKey: "id", jsonbCols: [] },
  { name: "invoices", conflictKey: "id", jsonbCols: [] },
  { name: "invoice_products", conflictKey: "id", jsonbCols: [] },
  { name: "invoice_validation_results", conflictKey: "id", jsonbCols: [] },
  { name: "invoice_actions", conflictKey: "id", jsonbCols: [] },
]

function uniqueColumns(rows) {
  const keys = new Set()
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key))
  })
  return Array.from(keys)
}

function buildInsertSQL(table, columns, rows, conflictKey, jsonbCols) {
  const values = []
  const rowPlaceholders = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, colIndex) => {
      const paramIndex = rowIndex * columns.length + colIndex + 1
      const isJsonb = jsonbCols.includes(column)
      const value = row[column] ?? null
      values.push(isJsonb && value !== null ? JSON.stringify(value) : value)
      return isJsonb ? `CAST($${paramIndex} AS jsonb)` : `$${paramIndex}`
    })
    return `(${placeholders.join(", ")})`
  })

  const updateCols = columns
    .filter((column) => column !== conflictKey)
    .map((column) => `${column} = EXCLUDED.${column}`)

  const sql = `
    INSERT INTO public.${table} (${columns.join(", ")})
    VALUES ${rowPlaceholders.join(",\n")}
    ON CONFLICT (${conflictKey}) DO UPDATE
    SET ${updateCols.join(", ")};
  `

  return { sql, values }
}

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL

  if (!databaseUrl) {
    throw new Error(
      "Missing SUPABASE_DB_URL. Set it in backend/.env.local or backend/.env before running db:seed."
    )
  }

  const seedPath = path.resolve(__dirname, "../supabase/seed-data.json")
  const rawSeed = await readFile(seedPath, "utf8")
  const seed = JSON.parse(rawSeed)

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query("BEGIN")

    for (const config of TABLE_CONFIG) {
      const rows = seed[config.name] ?? []
      if (!Array.isArray(rows) || rows.length === 0) {
        continue
      }

      const columns = uniqueColumns(rows)
      const { sql, values } = buildInsertSQL(
        config.name,
        columns,
        rows,
        config.conflictKey,
        config.jsonbCols
      )

      await client.query(sql, values)
      console.log(`Seeded ${config.name}: ${rows.length} row(s)`)
    }

    await client.query("COMMIT")
    console.log("Seed completed successfully.")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("db:seed failed:", error.message)
  process.exit(1)
})
