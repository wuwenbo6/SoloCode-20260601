import type { AlignType, FontSizeType, BarcodeType, QrCodeErrorLevel } from '../../shared/types';

const ESC = 0x1B;
const GS = 0x1D;
const FS = 0x1C;
const DLE = 0x10;

const GB18030_RANGES: [number, number][] = [
  [0x4E00, 0x9FFF],
  [0x3400, 0x4DBF],
  [0x3000, 0x303F],
  [0xFF00, 0xFFEF],
  [0x2E80, 0x2EFF],
  [0x2F00, 0x2FDF],
  [0x3100, 0x312F],
  [0x31A0, 0x31BF],
  [0xF900, 0xFAFF],
  [0x20000, 0x2A6DF],
  [0x2A700, 0x2B73F],
  [0x2B740, 0x2B81F],
  [0xFE30, 0xFE4F],
  [0x2600, 0x26FF],
  [0x2700, 0x27BF],
];

function isCJK(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;
  return GB18030_RANGES.some(([start, end]) => code >= start && code <= end);
}

export function getCharPrintWidth(char: string): number {
  if (isCJK(char)) return 2;
  if (char === '\t') return 4;
  if (char.charCodeAt(0) < 0x20) return 0;
  return 1;
}

export function getStringPrintWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += getCharPrintWidth(char);
  }
  return width;
}

export function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
      continue;
    }

    if (char === '\r') continue;

    const charWidth = getCharPrintWidth(char);

    if (currentWidth + charWidth > maxWidth) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

export function padText(text: string, maxWidth: number, align: 'left' | 'center' | 'right'): string {
  const textWidth = getStringPrintWidth(text);
  if (textWidth >= maxWidth) return text;

  const padding = maxWidth - textWidth;

  if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  } else if (align === 'right') {
    return ' '.repeat(padding) + text;
  }
  return text + ' '.repeat(padding);
}

function encodeGBK(char: string): number[] {
  const code = char.codePointAt(0);
  if (!code) return [0x3F];

  if (code < 0x80) {
    return [code];
  }

  if (code >= 0x4E00 && code <= 0x9FFF) {
    const offset = code - 0x4E00;
    const lead = Math.floor(offset / 190) + 0xB0;
    const trail = (offset % 190);
    const second = trail < 0x3F ? trail + 0x40 : trail + 0x41;
    return [lead, second];
  }

  if (code >= 0x3000 && code <= 0x303F) {
    const gbkMap: Record<number, [number, number]> = {
      0x3000: [0xA1, 0xA1],
      0x3001: [0xA1, 0xA2],
      0x3002: [0xA1, 0xA3],
      0x300A: [0xA1, 0xB1],
      0x300B: [0xA1, 0xB2],
      0x300C: [0xA1, 0xB3],
      0x300D: [0xA1, 0xB4],
      0x300E: [0xA1, 0xB5],
      0x300F: [0xA1, 0xB6],
    };
    const mapped = gbkMap[code];
    if (mapped) return [mapped[0], mapped[1]];
  }

  if (code >= 0xFF00 && code <= 0xFFEF) {
    const fullWidthMap: Record<number, [number, number]> = {
      0xFF01: [0xA3, 0xA1],
      0xFF08: [0xA3, 0xA8],
      0xFF09: [0xA3, 0xA9],
      0xFF0C: [0xA3, 0xAC],
      0xFF0E: [0xA3, 0xAE],
      0xFF1A: [0xA3, 0xBA],
      0xFF1B: [0xA3, 0xBB],
      0xFF1F: [0xA3, 0xBF],
    };
    const mapped = fullWidthMap[code];
    if (mapped) return [mapped[0], mapped[1]];

    if (code >= 0xFF10 && code <= 0xFF19) {
      return [0xA3, 0xB0 + (code - 0xFF10)];
    }
    if (code >= 0xFF21 && code <= 0xFF3A) {
      return [0xA3, 0xC1 + (code - 0xFF21)];
    }
    if (code >= 0xFF41 && code <= 0xFF5A) {
      return [0xA3, 0xE1 + (code - 0xFF41)];
    }
  }

  if (code >= 0x20000) {
    const b1 = 0x30 + Math.floor((code - 0x10000) / (10 * 126 * 10));
    const remainder1 = (code - 0x10000) % (10 * 126 * 10);
    const b2 = 0x81 + Math.floor(remainder1 / (10 * 126));
    const remainder2 = remainder1 % (10 * 126);
    const b3 = 0x30 + Math.floor(remainder2 / 10);
    const b4 = 0x81 + (remainder2 % 10);
    return [b1, b2, b3, b4];
  }

  return [0x3F];
}

export function encodeGB18030(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (!code) continue;
    bytes.push(...encodeGBK(char));
  }
  return bytes;
}

export class ESCPOSCommand {
  private buffer: number[] = [];
  private _charEncoding: 'utf8' | 'gb18030' = 'gb18030';

  get length(): number {
    return this.buffer.length;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  toArrayBuffer(): ArrayBuffer {
    return this.toUint8Array().buffer;
  }

  private push(...bytes: number[]): this {
    this.buffer.push(...bytes);
    return this;
  }

  private pushText(text: string): this {
    if (this._charEncoding === 'gb18030') {
      const bytes = encodeGB18030(text);
      this.buffer.push(...bytes);
    } else {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      this.buffer.push(...Array.from(data));
    }
    return this;
  }

  setCharEncoding(encoding: 'utf8' | 'gb18030'): this {
    this._charEncoding = encoding;
    return this;
  }

  initialize(): this {
    this.push(ESC, 0x40);
    return this;
  }

  selectChineseMode(enable: boolean = true): this {
    if (enable) {
      this.push(FS, 0x26);
    } else {
      this.push(FS, 0x2E);
    }
    return this;
  }

  setChineseCharRightSpacing(n: number): this {
    this.push(FS, 0x53, n);
    return this;
  }

  setAlign(align: AlignType = 'left'): this {
    const alignCodes: Record<AlignType, number> = {
      left: 0,
      center: 1,
      right: 2
    };
    return this.push(ESC, 0x61, alignCodes[align]);
  }

  setFontSize(size: FontSizeType = 'normal'): this {
    const sizeCodes: Record<FontSizeType, number> = {
      normal: 0,
      'double-height': 1,
      'double-width': 16,
      quad: 17
    };
    return this.push(GS, 0x21, sizeCodes[size]);
  }

  setBold(enable: boolean = true): this {
    return this.push(ESC, 0x45, enable ? 1 : 0);
  }

  setUnderline(enable: boolean = true): this {
    return this.push(ESC, 0x2D, enable ? 1 : 0);
  }

  setReverse(enable: boolean = true): this {
    return this.push(GS, 0x42, enable ? 1 : 0);
  }

  setCharRightSpacing(n: number): this {
    return this.push(ESC, 0x20, n);
  }

  setLineSpacing(n: number): this {
    return this.push(ESC, 0x33, n);
  }

  text(content: string): this {
    return this.pushText(content);
  }

  line(content?: string): this {
    if (content !== undefined) {
      this.pushText(content);
    }
    return this.push(0x0A);
  }

  feedLines(lines: number = 1): this {
    return this.push(ESC, 0x64, lines);
  }

  cut(mode: 'partial' | 'full' = 'partial'): this {
    return this.push(GS, 0x56, mode === 'full' ? 0 : 1);
  }

  pulse(pin: number = 0, onTime: number = 120, offTime: number = 240): this {
    return this.push(ESC, 0x70, pin, onTime / 2, offTime / 2);
  }

  barcode(content: string, type: BarcodeType = 'CODE-128', height: number = 162, width: number = 3): this {
    const typeCodes: Record<BarcodeType, number> = {
      'UPC-A': 0,
      'UPC-E': 1,
      'EAN-13': 2,
      'EAN-8': 3,
      'CODE-39': 4,
      'ITF': 5,
      'CODEBAR': 6,
      'CODE-93': 7,
      'CODE-128': 8
    };

    this.push(GS, 0x68, height);
    this.push(GS, 0x77, width);
    this.push(GS, 0x6B, typeCodes[type]);
    this.pushText(content);
    return this.push(0x00);
  }

  qrCode(content: string, size: number = 8, errorLevel: QrCodeErrorLevel = 'M'): this {
    const errorCodes: Record<QrCodeErrorLevel, number> = {
      L: 0,
      M: 1,
      Q: 2,
      H: 3
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const dataLen = data.length;
    const pL = dataLen & 0xFF;
    const pH = (dataLen >> 8) & 0xFF;

    this.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size);
    this.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, errorCodes[errorLevel]);
    this.push(GS, 0x28, 0x6B, pL + 3, pH, 0x31, 0x50, 0x30);
    this.push(...Array.from(data));
    this.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    return this;
  }

  queryStatus(): this {
    return this.push(DLE, 0x04, 0x01);
  }

  queryPaperStatus(): this {
    return this.push(DLE, 0x04, 0x04);
  }

  static textToCommands(text: string, width: number = 58): ESCPOSCommand {
    const cmd = new ESCPOSCommand();
    cmd.initialize();
    cmd.selectChineseMode(true);
    cmd.setChineseCharRightSpacing(0);

    const charsPerLine = width === 80 ? 48 : 32;

    const rawLines = text.split('\n');

    for (const rawLine of rawLines) {
      const wrappedLines = wrapText(rawLine, charsPerLine);

      for (let i = 0; i < wrappedLines.length; i++) {
        const line = wrappedLines[i];

        if (line.match(/^[=\-─━]{3,}$/)) {
          cmd.setAlign('center');
          cmd.line('─'.repeat(charsPerLine));
          continue;
        }

        const isHeader = line.match(/^[=＝]{3,}.+[=＝]{3,}$/);
        if (isHeader) {
          const headerText = line.replace(/^[=＝]+|[=＝]+$/g, '').trim();
          cmd.setAlign('center');
          cmd.setFontSize('double-height');
          cmd.setBold(true);
          cmd.line(headerText);
          cmd.setBold(false);
          cmd.setFontSize('normal');
          continue;
        }

        if (line.includes('合计') || line.includes('金额') || line.includes('总计') || line.includes('Total')) {
          cmd.setBold(true);
          cmd.setAlign('left');
          cmd.line(line);
          cmd.setBold(false);
          continue;
        }

        if (line.includes('====') || line.includes('----')) {
          cmd.setAlign('center');
          cmd.setBold(true);
          cmd.line(line);
          cmd.setBold(false);
          continue;
        }

        cmd.setAlign('left');
        cmd.line(line);
      }
    }

    cmd.feedLines(3);
    cmd.cut('partial');

    return cmd;
  }

  static parseTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    const regex = /\{([^}]+)\}/g;

    result = result.replace(regex, (match, key) => {
      const value = data[key.trim()];
      if (value === undefined || value === null || value === '') {
        return match;
      }
      return String(value);
    });

    return result;
  }
}

export function parseStatus(data: Uint8Array): {
  online: boolean;
  paperOk: boolean;
  temperatureOk: boolean;
  coverOpen: boolean;
  errorMessage?: string;
} {
  if (data.length === 0) {
    return {
      online: false,
      paperOk: false,
      temperatureOk: false,
      coverOpen: false,
      errorMessage: '未接收到状态数据'
    };
  }

  const status = data[0];
  const online = !(status & 0x08);
  const paperOk = !(status & 0x20) && !(status & 0x40);
  const coverOpen = !!(status & 0x04);
  const temperatureOk = !(status & 0x02);

  let errorMessage: string | undefined;
  if (!online) errorMessage = '打印机离线';
  else if (!paperOk) errorMessage = '缺纸或纸将用尽';
  else if (coverOpen) errorMessage = '机盖未关闭';
  else if (!temperatureOk) errorMessage = '打印头过热';

  return {
    online,
    paperOk,
    temperatureOk,
    coverOpen,
    errorMessage
  };
}

export const SUPPORTED_PRINTERS = [
  { vendorId: 0x04b8, name: 'EPSON' },
  { vendorId: 0x067b, name: 'HP' },
  { vendorId: 0x0dd4, name: 'Star Micronics' },
  { vendorId: 0x154f, name: 'Wincor Nixdorf' },
  { vendorId: 0x1fc9, name: 'Custom' },
  { vendorId: 0x20d1, name: 'Bixolon' },
  { vendorId: 0x2175, name: 'Datecs' },
  { vendorId: 0x241a, name: 'Zjiang' },
  { vendorId: 0x2730, name: 'Citizen' },
  { vendorId: 0x1a86, name: 'QinHeng' },
  { vendorId: 0x0483, name: 'STMicroelectronics' },
  { vendorId: 0x10c4, name: 'Silicon Labs' },
  { vendorId: 0x0525, name: 'Netchip' },
];
