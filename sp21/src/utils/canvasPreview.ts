import { getStringPrintWidth } from './escpos';

export interface PrintLine {
  text: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
}

export interface PreviewOptions {
  width: number;
  padding: number;
  fontSize: number;
  lineHeight: number;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

const DEFAULT_OPTIONS: PreviewOptions = {
  width: 58,
  padding: 20,
  fontSize: 12,
  lineHeight: 18,
  backgroundColor: '#FDF6E3',
  textColor: '#000000',
  fontFamily: '"Monaco", "Consolas", "Courier New", monospace'
};

export function parsePrintContent(content: string): PrintLine[] {
  const lines: PrintLine[] = [];
  const rawLines = content.split('\n');

  for (const line of rawLines) {
    let parsed: PrintLine = {
      text: line,
      align: 'left',
      bold: false,
      fontSize: 'normal'
    };

    if (line.includes('====') || line.includes('----')) {
      parsed.align = 'center';
      parsed.bold = true;
    } else if (line.startsWith('===') && line.endsWith('===')) {
      parsed.text = line.replace(/=/g, '').trim();
      parsed.align = 'center';
      parsed.bold = true;
      parsed.fontSize = 'xlarge';
    } else if (line.includes('{') && line.includes('}')) {
      parsed.align = 'center';
      parsed.bold = true;
      parsed.fontSize = 'large';
    } else if (line.includes(':') && (line.includes('合计') || line.includes('金额') || line.includes('总计'))) {
      parsed.bold = true;
    } else if (line.startsWith('----------------') || line.startsWith('===========')) {
      parsed.text = '-'.repeat(40);
    }

    lines.push(parsed);
  }

  return lines;
}

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  content: string,
  options: Partial<PreviewOptions> = {}
): { height: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { height: 0 };

  const dpr = window.devicePixelRatio || 1;
  const mmToPx = 3.78;
  const paperWidthPx = opts.width * mmToPx;
  const contentWidth = paperWidthPx - opts.padding * 2;

  const lines = parsePrintContent(content);
  let y = opts.padding;
  let maxHeight = opts.padding * 2;

  ctx.save();
  ctx.scale(dpr, dpr);

  lines.forEach(line => {
    let fontSize = opts.fontSize;
    if (line.fontSize === 'large') fontSize = opts.fontSize * 1.5;
    if (line.fontSize === 'xlarge') fontSize = opts.fontSize * 2;

    ctx.font = `${line.bold ? 'bold ' : ''}${fontSize}px ${opts.fontFamily}`;
    ctx.fillStyle = opts.textColor;
    ctx.textBaseline = 'top';

    let x = opts.padding;
    if (line.align === 'center') {
      ctx.textAlign = 'center';
      x = paperWidthPx / 2;
    } else if (line.align === 'right') {
      ctx.textAlign = 'right';
      x = paperWidthPx - opts.padding;
    } else {
      ctx.textAlign = 'left';
    }

    if (line.text.length > 0) {
      const words = line.text.split('');
      let currentLine = '';
      
      for (const char of words) {
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > contentWidth && currentLine) {
          ctx.fillText(currentLine, x, y);
          currentLine = char;
          y += opts.lineHeight;
          maxHeight = Math.max(maxHeight, y + opts.lineHeight);
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        ctx.fillText(currentLine, x, y);
      }
    }

    y += opts.lineHeight;
    maxHeight = Math.max(maxHeight, y + opts.padding);
  });

  ctx.restore();

  const finalHeight = Math.ceil(maxHeight);
  canvas.width = Math.ceil(paperWidthPx * dpr);
  canvas.height = finalHeight * dpr;
  canvas.style.width = `${paperWidthPx}px`;
  canvas.style.height = `${finalHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, paperWidthPx, finalHeight);

  y = opts.padding;
  lines.forEach(line => {
    let fontSize = opts.fontSize;
    if (line.fontSize === 'large') fontSize = opts.fontSize * 1.5;
    if (line.fontSize === 'xlarge') fontSize = opts.fontSize * 2;

    ctx.font = `${line.bold ? 'bold ' : ''}${fontSize}px ${opts.fontFamily}`;
    ctx.fillStyle = opts.textColor;
    ctx.textBaseline = 'top';

    let x = opts.padding;
    if (line.align === 'center') {
      ctx.textAlign = 'center';
      x = paperWidthPx / 2;
    } else if (line.align === 'right') {
      ctx.textAlign = 'right';
      x = paperWidthPx - opts.padding;
    } else {
      ctx.textAlign = 'left';
    }

    if (line.text.length > 0) {
      const words = line.text.split('');
      let currentLine = '';
      
      for (const char of words) {
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > contentWidth && currentLine) {
          ctx.fillText(currentLine, x, y);
          currentLine = char;
          y += opts.lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        ctx.fillText(currentLine, x, y);
      }
    }

    y += opts.lineHeight;
  });

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(opts.padding, finalHeight - opts.padding + 10);
  ctx.lineTo(paperWidthPx - opts.padding, finalHeight - opts.padding + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  return { height: finalHeight };
}

export function downloadAsImage(canvas: HTMLCanvasElement, filename: string = 'receipt.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function printAsImage(canvas: HTMLCanvasElement): void {
  const popup = window.open('', '_blank');
  if (!popup) return;

  const imgData = canvas.toDataURL('image/png');
  popup.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>打印预览</title>
      <style>
        @media print {
          @page { margin: 0; }
          body { margin: 0; }
          img { width: 100%; max-width: 80mm; }
        }
      </style>
    </head>
    <body>
      <img src="${imgData}" />
    </body>
    </html>
  `);
  popup.document.close();
  popup.onload = () => {
    popup.print();
  };
}
