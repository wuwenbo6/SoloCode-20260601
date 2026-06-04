import { Router, type Request, type Response } from 'express'
import { marked } from 'marked'
import htmlPdfNode from 'html-pdf-node'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx'
import auth from '../middleware/auth.js'

const router = Router()

router.use(auth)

const RATE_LIMIT_WINDOW = 60000
const RATE_LIMIT_MAX = 10
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userData = rateLimitMap.get(userId)

  if (!userData) {
    rateLimitMap.set(userId, { count: 1, windowStart: now })
    return true
  }

  if (now - userData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { count: 1, windowStart: now })
    return true
  }

  if (userData.count >= RATE_LIMIT_MAX) {
    return false
  }

  userData.count++
  return true
}

function generateHtml(markdown: string, title: string): string {
  const htmlContent = marked.parse(markdown) as string
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title || 'Document'}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #111;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1.1em; }
        p { margin: 1em 0; }
        code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-size: 0.9em;
        }
        pre {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
        }
        pre code {
          background: none;
          padding: 0;
        }
        ul, ol {
          padding-left: 2em;
          margin: 1em 0;
        }
        li { margin: 0.5em 0; }
        blockquote {
          border-left: 4px solid #ddd;
          margin: 1em 0;
          padding-left: 1em;
          color: #666;
        }
        a { color: #0366d6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        th { background: #f5f5f5; font-weight: 600; }
        .title {
          font-size: 2.5em;
          font-weight: 700;
          margin-bottom: 1em;
          text-align: center;
          color: #111;
        }
        hr {
          border: none;
          border-top: 1px solid #eee;
          margin: 2em 0;
        }
      </style>
    </head>
    <body>
      ${title ? `<div class="title">${title}</div>` : ''}
      ${htmlContent}
    </body>
    </html>
  `
}

router.post('/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { markdown, title } = req.body

    if (!checkRateLimit(userId)) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
      return
    }

    if (!markdown) {
      res.status(400).json({ success: false, error: 'Markdown content is required' })
      return
    }

    const html = generateHtml(markdown, title)

    const options = {
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    }

    const file = { content: html }
    const pdfBuffer = await htmlPdfNode.generatePdf(file, options)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(title || 'document')}.pdf"`,
    )
    res.setHeader('Content-Security-Policy', "default-src 'self'")
    res.setHeader('X-Content-Type-Options', 'nosniff')

    res.end(pdfBuffer)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

interface Token {
  type: string
  text?: string
  tokens?: Token[]
  items?: Token[]
  ordered?: boolean
  depth?: number
  lang?: string
}

function parseInline(tokens: Token[] | undefined, isBold = false, isItalic = false): TextRun[] {
  if (!tokens) return []

  const runs: TextRun[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        runs.push(
          new TextRun({
            text: token.text || '',
            bold: isBold,
            italics: isItalic,
          }),
        )
        break
      case 'strong':
        runs.push(...parseInline(token.tokens, true, isItalic))
        break
      case 'em':
        runs.push(...parseInline(token.tokens, isBold, true))
        break
      case 'codespan':
        runs.push(
          new TextRun({
            text: token.text || '',
            font: 'Consolas',
            bold: isBold,
            italics: isItalic,
          }),
        )
        break
      case 'link':
        runs.push(
          new TextRun({
            text: token.text || '',
            bold: isBold,
            italics: isItalic,
          }),
        )
        break
      case 'break':
        runs.push(new TextRun({ text: '\n' }))
        break
      default:
        if (token.text) {
          runs.push(
            new TextRun({
              text: token.text,
              bold: isBold,
              italics: isItalic,
            }),
          )
        }
    }
  }

  return runs
}

function createParagraphFromInline(tokens: Token[] | undefined): Paragraph {
  const runs = parseInline(tokens)
  return new Paragraph({
    children: runs,
    spacing: { after: 200 },
  })
}

function markdownToDocx(markdown: string, title: string): Document {
  const tokens = marked.lexer(markdown) as Token[]
  const children: Paragraph[] = []

  if (title) {
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
        alignment: 'center',
      }),
    )
    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 400 },
      }),
    )
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        const headingLevels: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        }
        children.push(
          new Paragraph({
            children: parseInline(token.tokens),
            heading: headingLevels[token.depth || 1] || HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
        )
        break

      case 'paragraph':
        children.push(createParagraphFromInline(token.tokens))
        break

      case 'list':
        const listItems = token.items || []
        for (let i = 0; i < listItems.length; i++) {
          const item = listItems[i]
          const itemText = item.text || ''
          const prefix = token.ordered ? `${i + 1}. ` : '• '
          children.push(
            new Paragraph({
              children: [new TextRun({ text: prefix }), ...parseInline(item.tokens)],
              spacing: { after: 100 },
              indent: { left: 720 },
            }),
          )
        }
        break

      case 'code':
        const codeLines = (token.text || '').split('\n')
        for (const line of codeLines) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: 'Consolas',
                }),
              ],
              shading: {
                fill: 'F5F5F5',
              },
              spacing: { after: 0 },
              indent: { left: 360 },
            }),
          )
        }
        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 },
          }),
        )
        break

      case 'blockquote':
        if (token.tokens) {
          for (const blockToken of token.tokens) {
            if (blockToken.type === 'paragraph') {
              children.push(
                new Paragraph({
                  children: parseInline(blockToken.tokens),
                  spacing: { after: 200 },
                  indent: { left: 720 },
                }),
              )
            }
          }
        }
        break

      case 'hr':
        children.push(
          new Paragraph({
            text: '————————————————————',
            alignment: 'center',
            spacing: { before: 200, after: 200 },
          }),
        )
        break

      case 'space':
        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 },
          }),
        )
        break
    }
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
}

router.post('/docx', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.body._userId
    const { markdown, title } = req.body

    if (!checkRateLimit(userId)) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
      return
    }

    if (!markdown) {
      res.status(400).json({ success: false, error: 'Markdown content is required' })
      return
    }

    const doc = markdownToDocx(markdown, title)
    const buffer = await Packer.toBuffer(doc)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(title || 'document')}.docx"`,
    )
    res.setHeader('Content-Security-Policy', "default-src 'self'")
    res.setHeader('X-Content-Type-Options', 'nosniff')

    res.end(buffer)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
