import { useCallback, useRef, useEffect } from 'react';
import { useMeetingStore } from '@/store/meetingStore';
import { initWasmCrypto, wasmEncrypt, wasmDecrypt, type WasmCryptoInstance } from '@/utils/wasm-crypto';

type WorkerRequest = {
  id: string;
  type: 'encrypt' | 'decrypt';
  data: ArrayBuffer;
  keyData: ArrayBuffer;
  keyUsages: KeyUsage[];
  keyAlgorithm: AesKeyAlgorithm;
};

type WorkerResponse = {
  id: string;
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
};

export function useEncryption() {
  const { sharedKeys, encryptionKeys, setEncryptionKeys, setIsEncrypted } = useMeetingStore();
  const wasmRef = useRef<WasmCryptoInstance | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (data: ArrayBuffer) => void; reject: (err: Error) => void }>>(new Map());
  const counterRef = useRef<Uint8Array>(new Uint8Array(12));
  const nonceRef = useRef<Uint8Array | null>(null);
  const ivCounterRef = useRef<number>(0);
  const bufPoolRef = useRef<Map<number, ArrayBuffer[]>>(new Map());

  useEffect(() => {
    initWasmCrypto().then((wasm) => {
      wasmRef.current = wasm;
    });

    try {
      const workerCode = `
        let wasmReady = null;
        const keyCache = new Map();

        function getKeyHash(keyData) {
          const arr = new Uint8Array(keyData);
          let hash = 0;
          for (let i = 0; i < arr.length; i++) {
            hash = ((hash << 5) - hash + arr[i]) | 0;
          }
          return hash.toString(36);
        }

        async function importKey(keyData, algorithm, usages) {
          const hash = getKeyHash(keyData);
          const cached = keyCache.get(hash);
          if (cached) return cached;
          const key = await crypto.subtle.importKey('raw', keyData, algorithm, false, usages);
          keyCache.set(hash, key);
          return key;
        }

        let ivCounter = 0;
        const nonce = new Uint8Array(8);

        function initNonce() {
          crypto.getRandomValues(nonce);
        }
        initNonce();

        function generateCounterIV() {
          const iv = new Uint8Array(12);
          const view = new DataView(iv.buffer);
          view.setUint32(0, ivCounter, true);
          ivCounter++;
          for (let i = 0; i < 8; i++) {
            iv[4 + i] = nonce[i];
          }
          return iv;
        }

        self.onmessage = async function(event) {
          const { id, type, data, keyData, keyAlgorithm, keyUsages } = event.data;
          try {
            const key = await importKey(keyData, keyAlgorithm, keyUsages);
            let result;
            if (type === 'encrypt') {
              const iv = generateCounterIV();
              const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
              const output = new Uint8Array(12 + encrypted.byteLength);
              output.set(iv, 0);
              output.set(new Uint8Array(encrypted), 12);
              result = output.buffer;
            } else {
              const iv = data.slice(0, 12);
              const ciphertext = data.slice(12);
              result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            }
            self.postMessage({ id, success: true, data: result }, [result]);
          } catch (err) {
            self.postMessage({ id, success: false, error: err.message || 'Unknown error' });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, success, data, error } = event.data;
        const pending = pendingRef.current.get(id);
        if (!pending) return;
        pendingRef.current.delete(id);
        if (success && data) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || 'Encryption failed'));
        }
      };

      return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };
    } catch {}
  }, []);

  const generateCounterIV = useCallback((): Uint8Array => {
    const iv = new Uint8Array(12);
    const view = new DataView(iv.buffer);
    view.setUint32(0, ivCounterRef.current, true);
    ivCounterRef.current++;
    if (!nonceRef.current) {
      nonceRef.current = new Uint8Array(8);
      crypto.getRandomValues(nonceRef.current);
    }
    for (let i = 0; i < 8; i++) {
      iv[4 + i] = nonceRef.current[i];
    }
    return iv;
  }, []);

  const acquireBuffer = useCallback((size: number): ArrayBuffer => {
    const bucketKey = Math.ceil(Math.log2(Math.max(size, 1)));
    const bucket = bufPoolRef.current.get(bucketKey);
    if (bucket && bucket.length > 0) {
      return bucket.pop()!;
    }
    return new ArrayBuffer(size);
  }, []);

  const releaseBuffer = useCallback((buf: ArrayBuffer): void => {
    const bucketKey = Math.ceil(Math.log2(Math.max(buf.byteLength, 1)));
    let bucket = bufPoolRef.current.get(bucketKey);
    if (!bucket) {
      bucket = [];
      bufPoolRef.current.set(bucketKey, bucket);
    }
    if (bucket.length < 8) {
      bucket.push(buf);
    }
  }, []);

  const generateKeyPair = useCallback(async (): Promise<CryptoKeyPair> => {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey'],
    );
    setEncryptionKeys(keyPair);
    return keyPair;
  }, [setEncryptionKeys]);

  const encryptWorker = useCallback(async (data: ArrayBuffer, peerId: string): Promise<ArrayBuffer | null> => {
    const key = sharedKeys.get(peerId);
    if (!key) return null;

    const worker = workerRef.current;
    if (worker) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingRef.current.set(id, { resolve, reject });

        crypto.subtle.exportKey('raw', key).then((keyData) => {
          const request: WorkerRequest = {
            id,
            type: 'encrypt',
            data,
            keyData,
            keyUsages: ['encrypt'],
            keyAlgorithm: { name: 'AES-GCM', length: 256 },
          };
          worker.postMessage(request, [data]);

          setTimeout(() => {
            if (pendingRef.current.has(id)) {
              pendingRef.current.delete(id);
              reject(new Error('Encryption timeout'));
            }
          }, 5000);
        }).catch(reject);
      });
    }

    return encryptSync(data, peerId);
  }, [sharedKeys]);

  const encryptSync = useCallback(async (data: ArrayBuffer, peerId: string): Promise<ArrayBuffer | null> => {
    const key = sharedKeys.get(peerId);
    if (!key) return null;

    const wasm = wasmRef.current;
    if (wasm) {
      try {
        return await wasmEncrypt(data, key, wasm);
      } catch {}
    }

    const iv = generateCounterIV();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const totalLen = 12 + encrypted.byteLength;
    const resultBuf = acquireBuffer(totalLen);
    const result = new Uint8Array(resultBuf);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), 12);
    const finalBuf = resultBuf.slice(0, totalLen);
    releaseBuffer(resultBuf);
    return finalBuf;
  }, [sharedKeys, generateCounterIV, acquireBuffer, releaseBuffer]);

  const encrypt = useCallback(async (data: ArrayBuffer, peerId: string): Promise<ArrayBuffer | null> => {
    return encryptWorker(data, peerId);
  }, [encryptWorker]);

  const decrypt = useCallback(async (data: ArrayBuffer, peerId: string): Promise<ArrayBuffer | null> => {
    const key = sharedKeys.get(peerId);
    if (!key) return null;

    const worker = workerRef.current;
    if (worker) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingRef.current.set(id, { resolve, reject });

        crypto.subtle.exportKey('raw', key).then((keyData) => {
          const request: WorkerRequest = {
            id,
            type: 'decrypt',
            data,
            keyData,
            keyUsages: ['decrypt'],
            keyAlgorithm: { name: 'AES-GCM', length: 256 },
          };
          worker.postMessage(request, [data]);

          setTimeout(() => {
            if (pendingRef.current.has(id)) {
              pendingRef.current.delete(id);
              reject(new Error('Decryption timeout'));
            }
          }, 5000);
        }).catch(reject);
      });
    }

    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  }, [sharedKeys]);

  const getKeyFingerprint = useCallback(async (): Promise<string> => {
    if (!encryptionKeys) return '';
    const exported = await window.crypto.subtle.exportKey('raw', encryptionKeys.publicKey);
    const hash = await window.crypto.subtle.digest('SHA-256', exported);
    const arr = new Uint8Array(hash);
    return Array.from(arr.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':');
  }, [encryptionKeys]);

  return { generateKeyPair, encrypt, decrypt, getKeyFingerprint };
}
