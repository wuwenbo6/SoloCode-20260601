import { initWasmCrypto, wasmEncrypt, wasmDecrypt, type WasmCryptoInstance } from '../utils/wasm-crypto';

interface EncryptRequest {
  id: string;
  type: 'encrypt' | 'decrypt';
  data: ArrayBuffer;
  keyData: ArrayBuffer;
  keyUsages: KeyUsage[];
  keyAlgorithm: AlgorithmIdentifier;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

let wasmReady: WasmCryptoInstance | null = null;
const keyCache = new Map<string, CryptoKey>();

function getKeyHash(keyData: ArrayBuffer): string {
  const arr = new Uint8Array(keyData);
  let hash = 0;
  for (let i = 0; i < arr.length; i++) {
    hash = ((hash << 5) - hash + arr[i]) | 0;
  }
  return hash.toString(36);
}

async function importKey(keyData: ArrayBuffer, algorithm: AlgorithmIdentifier, usages: KeyUsage[]): Promise<CryptoKey> {
  const hash = getKeyHash(keyData);
  const cached = keyCache.get(hash);
  if (cached) return cached;
  const key = await crypto.subtle.importKey('raw', keyData, algorithm, false, usages);
  keyCache.set(hash, key);
  return key;
}

async function processRequest(request: EncryptRequest): Promise<WorkerResponse> {
  try {
    if (!wasmReady) {
      wasmReady = await initWasmCrypto();
    }

    const key = await importKey(request.keyData, request.keyAlgorithm, request.keyUsages);

    let result: ArrayBuffer;
    if (request.type === 'encrypt') {
      result = await wasmEncrypt(request.data, key, wasmReady);
    } else {
      result = await wasmDecrypt(request.data, key, wasmReady);
    }

    return { id: request.id, success: true, data: result };
  } catch (err) {
    return {
      id: request.id,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

self.onmessage = async (event: MessageEvent<EncryptRequest>) => {
  const response = await processRequest(event.data);
  (self as unknown as Worker).postMessage(response, response.data ? [response.data] : []);
};
