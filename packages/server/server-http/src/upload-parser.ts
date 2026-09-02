import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface UploadedFileInfo {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  fileCategory: 'spreadsheet' | 'document' | 'image' | 'code' | 'other'
  schemaSummary?: string
  ocrText?: string
  sampleContent?: string
  createdAt: number
}

export class UploadParser {
  private static vllmVisionUrl = process.env.VLLM_VISION_URL || 'http://localhost:8010'

  public static async parseFile(filePath: string, originalName?: string): Promise<UploadedFileInfo> {
    const fileName = originalName || path.basename(filePath)
    const ext = path.extname(fileName).toLowerCase()
    const stat = await fs.stat(filePath)
    const fileSize = stat.size
    const id = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const createdAt = Date.now()

    let fileCategory: UploadedFileInfo['fileCategory'] = 'other'
    let schemaSummary: string | undefined
    let ocrText: string | undefined
    let sampleContent: string | undefined
    let mimeType = 'application/octet-stream'

    const spreadsheetExts = new Set(['.xlsx', '.xls', '.csv', '.tsv', '.parquet'])
    const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.svg'])
    const docExts = new Set(['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf', '.html'])
    const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.yaml', '.yml', '.sql', '.sh', '.rs', '.go', '.java', '.cpp', '.c', '.h'])

    try {
      if (spreadsheetExts.has(ext)) {
        fileCategory = 'spreadsheet'
        mimeType = ext === '.csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        schemaSummary = await this.parseSpreadsheet(filePath, ext)
      } else if (imageExts.has(ext)) {
        fileCategory = 'image'
        mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg'
        ocrText = await this.extractImageOcr(filePath)
        if (ocrText && ocrText.trim().length > 0) {
          schemaSummary = `🖼️ Görsel OCR Metni (${fileName}):\n${ocrText.slice(0, 2000)}${ocrText.length > 2000 ? '\n...(kırpıldı)' : ''}`
        } else {
          schemaSummary = `🖼️ Görsel yüklendi: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`
        }
      } else if (docExts.has(ext)) {
        fileCategory = 'document'
        mimeType = ext === '.pdf' ? 'application/pdf' : 'text/plain'
        if (ext === '.pdf') {
          const { text, pageCount } = await this.parsePdf(filePath)
          sampleContent = text.slice(0, 1500)
          schemaSummary = `📄 PDF Dokümanı (${fileName}, ~${pageCount} sayfa, ${(fileSize / 1024).toFixed(1)} KB):\n${sampleContent ? sampleContent + '...' : '(Dijital metin bulunamadı)'}`
        } else {
          const text = await fs.readFile(filePath, 'utf-8').catch(() => '')
          sampleContent = text.slice(0, 1500)
          schemaSummary = `📄 Metin Dokümanı (${fileName}, ${(fileSize / 1024).toFixed(1)} KB):\n${sampleContent ? sampleContent + '...' : ''}`
        }
      } else if (codeExts.has(ext)) {
        fileCategory = 'code'
        mimeType = 'text/plain'
        const text = await fs.readFile(filePath, 'utf-8').catch(() => '')
        sampleContent = text.slice(0, 1500)
        schemaSummary = `💻 Kaynak Kod (${fileName}, ${(fileSize / 1024).toFixed(1)} KB):\n\`\`\`${ext.replace('.', '')}\n${sampleContent}\n\`\`\``
      }
    } catch (err: any) {
      console.warn(`[UploadParser] Error parsing ${fileName}:`, err.message)
      schemaSummary = `📎 Dosya: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`
    }

    return {
      id,
      fileName,
      filePath,
      fileSize,
      mimeType,
      fileCategory,
      schemaSummary: schemaSummary || `📎 Dosya: ${fileName}`,
      ocrText,
      sampleContent,
      createdAt
    }
  }

  /**
   * Fast Excel / CSV Schema extractor using Python standard library & pandas/openpyxl if available.
   */
  private static async parseSpreadsheet(filePath: string, ext: string): Promise<string> {
    try {
      if (ext === '.csv' || ext === '.tsv') {
        const delimiter = ext === '.tsv' ? '\t' : ','
        const raw = await fs.readFile(filePath, 'utf-8')
        const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0)
        const header = lines[0]?.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')) || []
        const totalRows = Math.max(0, lines.length - 1)
        const sampleRows = lines.slice(1, 4).map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')))

        let summary = `📊 Tablo (CSV): ${path.basename(filePath)}\n`
        summary += `- Toplam Satır: ${totalRows.toLocaleString()}\n`
        summary += `- Sütunlar (${header.length}): [${header.join(', ')}]\n`
        summary += `- Örnek Satırlar (İlk 3):\n`
        sampleRows.forEach((row, i) => {
          summary += `  ${i + 1}. ${row.slice(0, 8).join(' | ')}${row.length > 8 ? ' | ...' : ''}\n`
        })
        summary += `\n*Not: Bu tablo üzerinde Python (pandas/duckdb) veya SQL ile filtreleme, gruplama ve matematiksel analiz yapabilirsin.*`
        return summary
      }

      // Excel (.xlsx, .xls) via python script for reliable schema parsing
      const pyScript = `
import sys, json, os

file_path = sys.argv[1]
result = {"sheets": []}

try:
    import pandas as pd
    xl = pd.ExcelFile(file_path)
    for sheet_name in xl.sheet_names[:5]:
        df = xl.parse(sheet_name, nrows=3)
        cols = list(df.columns)
        total_rows = 0
        try:
            total_rows = len(xl.parse(sheet_name, usecols=[0]))
        except:
            total_rows = len(df)
        sample = df.astype(str).values.tolist()
        result["sheets"].append({
            "name": sheet_name,
            "columns": cols,
            "total_rows": total_rows,
            "sample": sample
        })
    print(json.dumps(result))
    sys.exit(0)
except Exception as e:
    pass

try:
    import openpyxl
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    for sheet_name in wb.sheetnames[:5]:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if rows:
            cols = [str(c) if c is not None else f"Col_{i}" for i, c in enumerate(rows[0])]
            sample = [[str(c) if c is not None else "" for c in r] for r in rows[1:4]]
            result["sheets"].append({
                "name": sheet_name,
                "columns": cols,
                "total_rows": max(0, len(rows) - 1),
                "sample": sample
            })
    print(json.dumps(result))
    sys.exit(0)
except Exception as e:
    result["error"] = str(e)
    print(json.dumps(result))
`
      const { stdout } = await execFileAsync('python3', ['-c', pyScript, filePath], { timeout: 15000 }).catch(() => ({ stdout: '' }))
      if (stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout)
          if (parsed.sheets && parsed.sheets.length > 0) {
            let summary = `📊 Excel Tablosu: ${path.basename(filePath)}\n`
            for (const s of parsed.sheets) {
              summary += `\n▶ Sayfa: "${s.name}" (${s.total_rows} satır)\n`
              summary += `  - Sütunlar (${s.columns.length}): [${s.columns.join(', ')}]\n`
              if (s.sample && s.sample.length > 0) {
                summary += `  - Örnek Satırlar:\n`
                s.sample.forEach((row: string[], i: number) => {
                  summary += `    ${i + 1}. ${row.slice(0, 8).join(' | ')}${row.length > 8 ? ' | ...' : ''}\n`
                })
              }
            }
            summary += `\n*Not: Bu Excel tablosunu incelemek ve hesaplama yapmak için Python (pandas/openpyxl) komutları çalıştırabilirsin.*`
            return summary
          }
        } catch {}
      }

      return `📊 Excel Dosyası yüklendi: ${path.basename(filePath)} (Detaylı analiz için Python ile okunabilir)`
    } catch (e: any) {
      return `📊 Tablo Dosyası: ${path.basename(filePath)} (${e.message})`
    }
  }

  /**
   * Multi-tier PDF Parser (Python pypdf/fitz -> System pdftotext -> GLM-OCR fallback).
   */
  private static async parsePdf(filePath: string): Promise<{ text: string; pageCount: number }> {
    // 1. Try Python (pypdf / fitz / pdfminer) - Zero OS dependency
    const pyScript = `
import sys, json
file_path = sys.argv[1]
try:
    import pypdf
    reader = pypdf.PdfReader(file_path)
    text = "\\n\\n".join([p.extract_text() or "" for p in reader.pages[:10]])
    print(json.dumps({"text": text, "pageCount": len(reader.pages)}))
    sys.exit(0)
except Exception:
    pass

try:
    import fitz # PyMuPDF
    doc = fitz.open(file_path)
    text = "\\n\\n".join([page.get_text() for page in doc[:10]])
    print(json.dumps({"text": text, "pageCount": len(doc)}))
    sys.exit(0)
except Exception:
    pass
`
    try {
      const { stdout } = await execFileAsync('python3', ['-c', pyScript, filePath], { timeout: 8000 }).catch(() => ({ stdout: '' }))
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout)
        if (parsed.text && parsed.text.trim().length > 0) {
          return { text: parsed.text.trim(), pageCount: parsed.pageCount || 1 }
        }
      }
    } catch {}

    // 2. Try pdftotext (C++ native poppler-utils if installed)
    try {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000
      }).catch(() => ({ stdout: '' }))

      if (stdout.trim()) {
        const pageBreaks = (stdout.match(/\f/g) || []).length
        const pageCount = pageBreaks > 0 ? pageBreaks + 1 : 1
        const clean = stdout
          .replace(/\f/g, '\n--- [Sayfa Sonu] ---\n')
          .replace(/[\t\u00A0]+/g, ' ')
          .replace(/\r\n/g, '\n')
        return { text: clean.trim(), pageCount }
      }
    } catch {}

    // 3. Fallback: Check if GLM-OCR on port 8010 can parse scanned PDF
    try {
      const ocrText = await this.extractImageOcr(filePath)
      if (ocrText && ocrText.trim().length > 0) {
        return { text: ocrText.trim(), pageCount: 1 }
      }
    } catch {}

    return { text: '', pageCount: 1 }
  }

  /**
   * GLM-OCR extraction on port 8010 for uploaded images / scanned docs.
   */
  private static async extractImageOcr(filePath: string): Promise<string> {
    try {
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const fileBuffer = await fs.readFile(filePath)

      const baseUrl = this.vllmVisionUrl.replace(/\/v1\/?$/, '')
      const processUrl = `${baseUrl}/process`

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)

      const formData = new FormData()
      const blob = new Blob([fileBuffer], { type: mimeType })
      formData.append('file', blob, path.basename(filePath))

      const res = await fetch(processUrl, {
        method: 'POST',
        headers: { 'x-filename': path.basename(filePath) },
        body: formData,
        signal: controller.signal
      })
      clearTimeout(timer)

      if (res.ok) {
        const data: any = await res.json()
        if (Array.isArray(data) && data[0]?.page_content) {
          const text = data.map((d: any) => d.page_content).join('\n').trim()
          if (text && text !== 'No file data found' && text !== 'vLLM process not started') {
            return text
          }
        }
      }
      return ''
    } catch (e: any) {
      // Return empty gracefully if OCR microservice is not active
      return ''
    }
  }
}
