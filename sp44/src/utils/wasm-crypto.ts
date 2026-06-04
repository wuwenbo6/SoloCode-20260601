function encodeLEB128(value: number): number[] {
  const bytes: number[] = [];
  let v = value;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return bytes;
}

function encodeSignedLEB128(value: number): number[] {
  const bytes: number[] = [];
  let v = value;
  let more = true;
  while (more) {
    let byte = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (byte & 0x40) === 0) || (v === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function flatten(arr: (number | number[])[]): number[] {
  const result: number[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flatten(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

function encodeVector(items: number[]): number[] {
  return [...encodeLEB128(items.length), ...items];
}

function encodeString(str: string): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return [...encodeLEB128(bytes.length), ...bytes];
}

function encodeSection(id: number, content: number[]): number[] {
  return [id, ...encodeLEB128(content.length), ...content];
}

const VALTYPE_I32 = 0x7f;
const VALTYPE_VOID = 0x40;

const OP_END = 0x0b;
const OP_I32_CONST = 0x41;
const OP_I64_CONST = 0x42;
const OP_LOCAL_GET = 0x20;
const OP_GLOBAL_GET = 0x23;
const OP_GLOBAL_SET = 0x24;
const OP_I32_ADD = 0x6a;
const OP_I32_SHR_U = 0x76;
const OP_I32_WRAP_I64 = 0xa7;
const OP_I64_ADD = 0x7c;
const OP_I32_STORE8 = 0x3a;
const OP_I64_STORE = 0x37;
const OP_MISC_PREFIX = 0xfc;
const OP_MEMORY_COPY = 0x0a;

function buildWasmModule(): Uint8Array {
  const typeSection = encodeSection(1, encodeVector(flatten([
    [...encodeLEB128(0), VALTYPE_VOID],
    [...encodeLEB128(2), VALTYPE_I32, VALTYPE_I32, VALTYPE_VOID],
    [...encodeLEB128(4), VALTYPE_I32, VALTYPE_I32, VALTYPE_I32, VALTYPE_I32, VALTYPE_VOID],
  ])));

  const funcSection = encodeSection(3, encodeVector(flatten([
    encodeLEB128(1),
    encodeLEB128(2),
  ])));

  const globalSection = encodeSection(6, encodeVector(flatten([
    [0x7e, 0x01, OP_I64_CONST, ...encodeSignedLEB128(0), OP_END],
  ])));

  const memorySection = encodeSection(5, encodeVector(flatten([
    [0x00, ...encodeLEB128(16)],
  ])));

  const exportSection = encodeSection(7, encodeVector(flatten([
    [...encodeString("next_iv"), 0x00, ...encodeLEB128(0)],
    [...encodeString("pack_frame"), 0x00, ...encodeLEB128(1)],
    [...encodeString("memory"), 0x02, ...encodeLEB128(0)],
  ])));

  const nextIvBody = flatten([
    ...encodeLEB128(0),
    OP_GLOBAL_GET, 0x00,
    OP_I32_WRAP_I64,
    OP_LOCAL_GET, 0x00,
    OP_I32_STORE8, 0x00, 0x00,
    OP_GLOBAL_GET, 0x00,
    OP_I32_WRAP_I64,
    OP_I32_CONST, ...encodeSignedLEB128(8),
    OP_I32_SHR_U,
    OP_LOCAL_GET, 0x00,
    OP_I32_CONST, ...encodeSignedLEB128(1),
    OP_I32_ADD,
    OP_I32_STORE8, 0x00, 0x00,
    OP_GLOBAL_GET, 0x00,
    OP_I32_WRAP_I64,
    OP_I32_CONST, ...encodeSignedLEB128(16),
    OP_I32_SHR_U,
    OP_LOCAL_GET, 0x00,
    OP_I32_CONST, ...encodeSignedLEB128(2),
    OP_I32_ADD,
    OP_I32_STORE8, 0x00, 0x00,
    OP_GLOBAL_GET, 0x00,
    OP_I32_WRAP_I64,
    OP_I32_CONST, ...encodeSignedLEB128(24),
    OP_I32_SHR_U,
    OP_LOCAL_GET, 0x00,
    OP_I32_CONST, ...encodeSignedLEB128(3),
    OP_I32_ADD,
    OP_I32_STORE8, 0x00, 0x00,
    OP_I64_CONST, ...encodeSignedLEB128(0),
    OP_LOCAL_GET, 0x00,
    OP_I32_CONST, ...encodeSignedLEB128(4),
    OP_I32_ADD,
    OP_I64_STORE, 0x00, 0x00,
    OP_GLOBAL_GET, 0x00,
    OP_I64_CONST, ...encodeSignedLEB128(1),
    OP_I64_ADD,
    OP_GLOBAL_SET, 0x00,
    OP_END,
  ]);

  const packFrameBody = flatten([
    ...encodeLEB128(0),
    OP_LOCAL_GET, 0x02,
    OP_LOCAL_GET, 0x00,
    OP_I32_CONST, ...encodeSignedLEB128(12),
    OP_I32_ADD,
    OP_LOCAL_GET, 0x01,
    OP_LOCAL_GET, 0x02,
    OP_MISC_PREFIX, OP_MEMORY_COPY, 0x00, 0x00,
    OP_END,
  ]);

  const codeSection = encodeSection(10, encodeVector(flatten([
    [...encodeLEB128(nextIvBody.length), ...nextIvBody],
    [...encodeLEB128(packFrameBody.length), ...packFrameBody],
  ])));

  const binary = new Uint8Array(flatten([
    [0x00, 0x61, 0x73, 0x6d],
    [0x01, 0x00, 0x00, 0x00],
    typeSection,
    funcSection,
    globalSection,
    memorySection,
    exportSection,
    codeSection,
  ]));

  return binary;
}

export interface WasmCryptoInstance {
  next_iv(ptr: number): void;
  pack_frame(iv_ptr: number, data_ptr: number, data_len: number, out_ptr: number): void;
  memory: WebAssembly.Memory;
}

let wasmInstance: WasmCryptoInstance | null = null;
let wasmInitPromise: Promise<WasmCryptoInstance> | null = null;

export async function initWasmCrypto(): Promise<WasmCryptoInstance> {
  if (wasmInstance) return wasmInstance;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    const binary = buildWasmModule();
    const module = await WebAssembly.compile(binary);
    const instance = await WebAssembly.instantiate(module);
    wasmInstance = instance.exports as unknown as WasmCryptoInstance;

    const nonce = new Uint8Array(8);
    crypto.getRandomValues(nonce);
    const dv = new DataView(nonce.buffer);
    const nonceLo = dv.getBigUint64(0, true);
    const memory = wasmInstance.memory;
    const memView = new DataView(memory.buffer);
    memView.setBigUint64(32, nonceLo, true);

    return wasmInstance;
  })();

  return wasmInitPromise;
}

class BufferPool {
  private pool: Map<number, ArrayBuffer[]> = new Map();
  private static readonly MAX_POOL_SIZE = 8;

  acquire(size: number): ArrayBuffer {
    const bucketKey = this.sizeToBucket(size);
    const bucket = this.pool.get(bucketKey);
    if (bucket && bucket.length > 0) {
      return bucket.pop()!;
    }
    return new ArrayBuffer(size);
  }

  release(buf: ArrayBuffer): void {
    const bucketKey = this.sizeToBucket(buf.byteLength);
    let bucket = this.pool.get(bucketKey);
    if (!bucket) {
      bucket = [];
      this.pool.set(bucketKey, bucket);
    }
    if (bucket.length < BufferPool.MAX_POOL_SIZE) {
      bucket.push(buf);
    }
  }

  private sizeToBucket(size: number): number {
    return Math.ceil(Math.log2(Math.max(size, 1)));
  }
}

const bufferPool = new BufferPool();

const IV_PTR = 0;
const DATA_PTR = 256;
const NONCE_OFFSET = 32;

export async function wasmEncrypt(
  data: ArrayBuffer,
  key: CryptoKey,
  wasm: WasmCryptoInstance
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(12);
  wasm.next_iv(IV_PTR);
  const wasmIv = new Uint8Array(wasm.memory.buffer, IV_PTR, 12);
  const wasmNonce = new Uint8Array(wasm.memory.buffer, NONCE_OFFSET, 8);
  iv.set(wasmIv);
  for (let i = 0; i < 8; i++) {
    iv[4 + i] = wasmNonce[i];
  }

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const encryptedBytes = new Uint8Array(encrypted);
  const totalLen = 12 + encryptedBytes.byteLength;

  const resultBuf = bufferPool.acquire(totalLen);
  const resultView = new Uint8Array(resultBuf);
  resultView.set(iv, 0);
  resultView.set(encryptedBytes, 12);

  const finalBuf = resultBuf.slice(0, totalLen);
  bufferPool.release(resultBuf);
  return finalBuf;
}

export async function wasmDecrypt(
  data: ArrayBuffer,
  key: CryptoKey,
  _wasm: WasmCryptoInstance
): Promise<ArrayBuffer> {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}
