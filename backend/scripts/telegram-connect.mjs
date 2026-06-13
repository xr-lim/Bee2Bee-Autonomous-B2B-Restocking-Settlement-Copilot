import { spawn } from "node:child_process"
import process from "node:process"

import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config()

const backendPort = process.env.BACKEND_PORT || "8000"
const ngrokAuthtoken = (process.env.NGROK_AUTHTOKEN || "").trim()
const telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
const telegramWebhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim()
const telegramApiBaseUrl = (
  process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org"
).replace(/\/+$/, "")

function requireValue(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in backend/.env first.`)
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    const description =
      body && typeof body === "object" && "description" in body
        ? body.description
        : text
    throw new Error(`HTTP ${response.status}: ${description || response.statusText}`)
  }

  return body
}

async function configureNgrokAuthtoken() {
  console.log("Configuring ngrok authtoken...")
  await new Promise((resolve, reject) => {
    const child = spawn("ngrok", ["config", "add-authtoken", ngrokAuthtoken], {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `ngrok config exited with code ${code}`))
    })
  })
}

async function waitForBackend() {
  const healthUrl = `http://127.0.0.1:${backendPort}/api/v1/health`
  console.log(`Checking backend health at ${healthUrl}...`)

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const body = await fetchJson(healthUrl)
      if (body.status === "ok") {
        console.log("Backend is reachable.")
        return
      }
    } catch {
      // Give the developer server a few seconds if it is still booting.
    }
    await delay(1000)
  }

  throw new Error(
    `Backend is not reachable at ${healthUrl}. Start it first with: npm run backend:dev`
  )
}

function startNgrok() {
  console.log(`Starting ngrok tunnel to http://localhost:${backendPort}...`)
  const child = spawn("ngrok", ["http", backendPort], {
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.on("data", (chunk) => {
    const line = chunk.toString().trim()
    if (line) console.log(`[ngrok] ${line}`)
  })
  child.stderr.on("data", (chunk) => {
    const line = chunk.toString().trim()
    if (line) console.error(`[ngrok] ${line}`)
  })
  child.on("exit", (code) => {
    if (code !== null) {
      console.error(`ngrok exited with code ${code}.`)
      process.exitCode = code || 1
    }
  })

  return child
}

async function waitForNgrokPublicUrl() {
  const apiUrl = "http://127.0.0.1:4040/api/tunnels"

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const body = await fetchJson(apiUrl)
      const tunnels = Array.isArray(body.tunnels) ? body.tunnels : []
      const httpsTunnel = tunnels.find(
        (tunnel) =>
          typeof tunnel.public_url === "string" &&
          tunnel.public_url.startsWith("https://")
      )
      if (httpsTunnel) return httpsTunnel.public_url.replace(/\/+$/, "")
    } catch {
      // ngrok's local API can take a moment to boot.
    }
    await delay(1000)
  }

  throw new Error("Timed out waiting for ngrok local API at http://127.0.0.1:4040.")
}

async function registerTelegramWebhook(publicUrl) {
  const webhookUrl = `${publicUrl}/api/v1/telegram/webhook`
  const url = `${telegramApiBaseUrl}/bot${telegramBotToken}/setWebhook`
  const params = new URLSearchParams({
    url: webhookUrl,
    secret_token: telegramWebhookSecret,
    drop_pending_updates: "false",
  })

  console.log(`Registering Telegram webhook: ${webhookUrl}`)
  const body = await fetchJson(`${url}?${params.toString()}`)
  if (!body.ok) {
    throw new Error(body.description || "Telegram rejected the webhook.")
  }
  console.log("Telegram webhook registered.")
  return webhookUrl
}

async function printWebhookInfo() {
  const url = `${telegramApiBaseUrl}/bot${telegramBotToken}/getWebhookInfo`
  const body = await fetchJson(url)
  const result = body.result || {}
  console.log(
    JSON.stringify(
      {
        webhook_url: result.url,
        pending_update_count: result.pending_update_count,
        last_error_message: result.last_error_message || null,
      },
      null,
      2
    )
  )
}

async function main() {
  requireValue("NGROK_AUTHTOKEN", ngrokAuthtoken)
  requireValue("TELEGRAM_BOT_TOKEN", telegramBotToken)
  requireValue("TELEGRAM_WEBHOOK_SECRET", telegramWebhookSecret)

  await waitForBackend()
  await configureNgrokAuthtoken()
  const ngrokProcess = startNgrok()
  const publicUrl = await waitForNgrokPublicUrl()
  const webhookUrl = await registerTelegramWebhook(publicUrl)

  console.log("")
  console.log("Connection ready.")
  console.log(`- Backend: http://localhost:${backendPort}`)
  console.log(`- Ngrok:   ${publicUrl}`)
  console.log(`- Webhook: ${webhookUrl}`)
  console.log("")
  console.log("Keep this terminal open while testing Telegram replies.")
  console.log("Press Ctrl+C to stop ngrok.")
  console.log("")
  await printWebhookInfo()

  const shutdown = () => {
    console.log("\nStopping ngrok...")
    ngrokProcess.kill()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
