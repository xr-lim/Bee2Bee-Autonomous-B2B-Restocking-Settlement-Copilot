import "server-only"

import { existsSync } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

type InvoiceFileKind = "pdf" | "image"

const PDF_PAGE_LIMIT = 1
const MAX_IMAGE_EDGE = 1600
const MAX_EXTRACTED_TEXT_LENGTH = 3000

export type ExtractedInvoiceDocument = {
  text: string
  fileKind: InvoiceFileKind
  sourceUrl: string
  contentType?: string | null
}

type PartialInvoiceFields = {
  quantity?: number
  paymentTerms?: string
  bankDetails?: string
}

function backendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function truncateExtractedText(value: string) {
  return normalizeWhitespace(value).slice(0, MAX_EXTRACTED_TEXT_LENGTH)
}

function frontendProjectRoot() {
  const cwd = process.cwd()
  const candidates = [cwd, path.join(cwd, "frontend")]

  const matchedRoot = candidates.find((candidate) =>
    existsSync(path.join(candidate, "node_modules", "tesseract.js"))
  )

  return matchedRoot ?? cwd
}

function resolveTesseractPaths() {
  const cwd = process.cwd()
  const root = frontendProjectRoot()
  const nodeModulesRoot = path.join(root, "node_modules")
  const workerFilePath = path.join(
    nodeModulesRoot,
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  )
  const corePath = path.join(nodeModulesRoot, "tesseract.js-core")
  const localLangPath = path.join(root, "public", "tesseract", "lang-data")
  const localLangFile = path.join(localLangPath, "eng.traineddata")
  const localLangFileGzip = path.join(localLangPath, "eng.traineddata.gz")
  const cachePath = path.join(root, ".cache", "tesseract")
  const langPath =
    existsSync(localLangFile) || existsSync(localLangFileGzip)
      ? localLangPath
      : "https://tessdata.projectnaptha.com/4.0.0"

  return {
    cwd,
    root,
    workerFilePath,
    workerFileUrl: pathToFileURL(workerFilePath),
    workerExists: existsSync(workerFilePath),
    corePath,
    coreExists: existsSync(path.join(corePath, "tesseract-core.wasm.js")),
    langPath,
    localLangExists: existsSync(localLangFile) || existsSync(localLangFileGzip),
    cachePath,
  }
}

function resolvePdfWorkerPath() {
  const root = frontendProjectRoot()
  const workerFilePath = path.join(
    root,
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "web",
    "pdf.worker.mjs"
  )

  return {
    workerFilePath,
    workerFileUrl: pathToFileURL(workerFilePath).href,
    workerExists: existsSync(workerFilePath),
  }
}

function resolveInvoiceFileUrl(fileUrl: string) {
  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl
  }

  return new URL(fileUrl, `${backendApiBaseUrl()}/`).toString()
}

function resolveLocalInvoiceFilePath(fileUrl: string) {
  if (!fileUrl.startsWith("/")) {
    return null
  }

  const relativePath = fileUrl.replace(/^\/+/, "")
  const candidatePaths = [
    path.join(process.cwd(), "public", relativePath),
    path.join(process.cwd(), "frontend", "public", relativePath),
  ]

  return candidatePaths
}

function detectFileKind(
  fileUrl: string,
  contentType: string | null,
  bytes: Uint8Array
): InvoiceFileKind {
  const lowerUrl = fileUrl.toLowerCase()
  const lowerType = contentType?.toLowerCase() ?? ""

  if (lowerType.includes("pdf") || lowerUrl.endsWith(".pdf")) {
    return "pdf"
  }

  if (lowerType.startsWith("image/")) {
    return "image"
  }

  if (/\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(lowerUrl)) {
    return "image"
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf"
  }

  return "image"
}

async function extractPdfText(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse")
  const worker = resolvePdfWorkerPath()
  console.info("[Invoice OCR] resolved pdf workerPath", worker.workerFilePath)
  console.info("[Invoice OCR] resolved pdf workerUrl", worker.workerFileUrl)
  console.info("[Invoice OCR] pdf worker exists", worker.workerExists)

  if (worker.workerExists) {
    PDFParse.setWorker(worker.workerFileUrl)
  }

  const parser = new PDFParse({ data: bytes })

  try {
    console.info("[Invoice OCR] PDF text extraction started")
    const result = await parser.getText({ partial: [PDF_PAGE_LIMIT] })
    const extractedText = truncateExtractedText(result.text ?? "")
    console.info("[Invoice OCR] PDF direct text length", extractedText.length)

    if (extractedText) {
      console.info("[Invoice OCR] PDF direct text preview", extractedText.slice(0, 300))
      return extractedText
    }

    console.warn(
      "[Invoice OCR] PDF direct text was empty, falling back to rendered page OCR"
    )

    const screenshot = await parser.getScreenshot({
      partial: [PDF_PAGE_LIMIT],
      desiredWidth: MAX_IMAGE_EDGE,
      imageBuffer: true,
      imageDataUrl: false,
    })
    const firstPageImage = screenshot.pages[0]?.data

    if (!firstPageImage || firstPageImage.length === 0) {
      throw new Error(
        "PDF parsing returned no text, and rendering a page image for OCR also failed."
      )
    }

    const ocrText = await extractImageText(new Uint8Array(firstPageImage))
    if (!ocrText) {
      throw new Error(
        "PDF parsing returned no text, and OCR on the rendered PDF page returned no text."
      )
    }

    console.info("[Invoice OCR] PDF OCR fallback text length", ocrText.length)
    console.info("[Invoice OCR] PDF OCR fallback preview", ocrText.slice(0, 300))
    return ocrText
  } catch (error) {
    console.error("[Invoice OCR] PDF text extraction failed", error)

    try {
      console.warn("[Invoice OCR] Retrying PDF extraction via rendered page OCR fallback")
      const screenshot = await parser.getScreenshot({
        partial: [PDF_PAGE_LIMIT],
        desiredWidth: MAX_IMAGE_EDGE,
        imageBuffer: true,
        imageDataUrl: false,
      })
      const firstPageImage = screenshot.pages[0]?.data

      if (!firstPageImage || firstPageImage.length === 0) {
        throw new Error("Rendered PDF page image was empty.")
      }

      const ocrText = await extractImageText(new Uint8Array(firstPageImage))
      if (!ocrText) {
        throw new Error("Rendered PDF page OCR returned no text.")
      }

      console.info("[Invoice OCR] PDF OCR retry text length", ocrText.length)
      console.info("[Invoice OCR] PDF OCR retry preview", ocrText.slice(0, 300))
      return ocrText
    } catch (fallbackError) {
      console.error("[Invoice OCR] PDF OCR fallback failed", fallbackError)
      throw fallbackError
    }
  } finally {
    await parser.destroy()
  }
}

async function downscaleImage(bytes: Uint8Array) {
  const { Jimp } = await import("jimp")
  const image = await Jimp.read(Buffer.from(bytes))
  const longestEdge = Math.max(image.width, image.height)

  if (longestEdge <= MAX_IMAGE_EDGE) {
    return Buffer.from(bytes)
  }

  const scale = MAX_IMAGE_EDGE / longestEdge
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  image.resize({ w: width, h: height })
  return image.getBuffer("image/png")
}

async function extractImageText(bytes: Uint8Array) {
  const { createWorker } = await import("tesseract.js")
  const normalizedImage = await downscaleImage(bytes)
  const paths = resolveTesseractPaths()

  console.info("[Invoice OCR] process.cwd()", paths.cwd)
  console.info("[Invoice OCR] resolved workerPath", paths.workerFilePath)
  console.info("[Invoice OCR] resolved workerFileUrl", paths.workerFileUrl.href)
  console.info("[Invoice OCR] worker exists", paths.workerExists)
  console.info("[Invoice OCR] resolved corePath", paths.corePath)
  console.info("[Invoice OCR] core exists", paths.coreExists)
  console.info("[Invoice OCR] resolved langPath", paths.langPath)
  console.info("[Invoice OCR] local lang exists", paths.localLangExists)

  if (!paths.workerExists) {
    throw new Error(`Tesseract worker script was not found at ${paths.workerFilePath}.`)
  }

  await mkdir(paths.cachePath, { recursive: true })

  const worker = await createWorker("eng", 1, {
    workerPath: paths.workerFilePath,
    corePath: paths.corePath,
    langPath: paths.langPath,
    cachePath: paths.cachePath,
    workerBlobURL: false,
    logger: () => undefined,
    errorHandler: (error) => {
      console.error("[Invoice OCR] Worker error", error)
    },
  })

  try {
    console.info("[Invoice OCR] OCR started")
    const result = await worker.recognize(normalizedImage)
    const rawText = result.data.text ?? ""
    const normalizedText = truncateExtractedText(rawText)
    console.info("[Invoice OCR] OCR text length", normalizedText.length)
    console.info("[Invoice OCR] OCR preview", normalizedText.slice(0, 300))
    return normalizedText
  } catch (error) {
    console.error("[Invoice OCR] OCR failed", error)
    throw error
  } finally {
    await worker.terminate()
  }
}

export async function extractInvoiceDocumentText(
  fileUrl: string
): Promise<ExtractedInvoiceDocument> {
  const localPaths = resolveLocalInvoiceFilePath(fileUrl)

  if (localPaths) {
    for (const filePath of localPaths) {
      try {
        const bytes = new Uint8Array(await readFile(filePath))
        const fileKind = detectFileKind(fileUrl, null, bytes)
        const text =
          fileKind === "pdf"
            ? await extractPdfText(bytes)
            : await extractImageText(bytes)

        if (!text) {
          throw new Error("No text could be extracted from the invoice file.")
        }

        return {
          text,
          fileKind,
          sourceUrl: fileUrl,
          contentType: null,
        }
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          continue
        }

        throw error
      }
    }

    throw new Error(`Invoice file ${fileUrl} could not be found in the app public directory.`)
  }

  const sourceUrl = resolveInvoiceFileUrl(fileUrl)
  const response = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Could not download invoice file. Received ${response.status}.`)
  }

  const contentType = response.headers.get("content-type")
  const bytes = new Uint8Array(await response.arrayBuffer())
  const fileKind = detectFileKind(fileUrl, contentType, bytes)
  const text =
    fileKind === "pdf"
      ? await extractPdfText(bytes)
      : await extractImageText(bytes)

  if (!text) {
    throw new Error("No text could be extracted from the invoice file.")
  }

  return {
    text,
    fileKind,
    sourceUrl,
    contentType,
  }
}

export function deriveInvoiceFieldsFromExtractedText(
  text: string
): PartialInvoiceFields {
  const normalized = normalizeWhitespace(text)
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const quantityMatch =
    normalized.match(/\b(?:qty|quantity)\s*[:\-]?\s*(\d{1,9})\b/i) ??
    normalized.match(/\btotal\s+units?\s*[:\-]?\s*(\d{1,9})\b/i)
  const paymentTermsMatch = normalized.match(
    /\b(net\s*\d{1,3}|due\s+on\s+receipt|cash\s+on\s+delivery|cod|immediate payment)\b/i
  )

  const bankLine = lines.find((line) =>
    /\b(bank|beneficiary|account|iban|swift|routing)\b/i.test(line)
  )

  return {
    quantity: quantityMatch ? Number(quantityMatch[1]) : undefined,
    paymentTerms: paymentTermsMatch?.[1]?.trim(),
    bankDetails: bankLine,
  }
}

export function buildExtractedTextSnippet(text?: string | null) {
  if (!text) return null

  const normalized = truncateExtractedText(text)
  if (!normalized) return null

  return normalized.slice(0, 2500)
}
