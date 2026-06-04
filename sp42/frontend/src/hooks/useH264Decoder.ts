import { useRef, useCallback, useEffect, useState } from 'react';

interface UseH264DecoderReturn {
  configure: (config: VideoDecoderConfig) => void;
  decode: (chunk: EncodedVideoChunkInit) => void;
  onFrame: ((frame: VideoFrame) => void) | null;
  setOnFrame: (cb: ((frame: VideoFrame) => void) | null) => void;
  configured: boolean;
  error: string | null;
}

function isAnnexBStartCode(data: Uint8Array, offset: number): boolean {
  if (offset + 3 >= data.length) return false;
  if (
    data[offset] === 0x00 &&
    data[offset + 1] === 0x00 &&
    data[offset + 2] === 0x00 &&
    data[offset + 3] === 0x01
  )
    return true;
  if (
    data[offset] === 0x00 &&
    data[offset + 1] === 0x00 &&
    data[offset + 2] === 0x01
  )
    return true;
  return false;
}

function parseNalType(data: Uint8Array, offset: number): number {
  let startLen = 4;
  if (
    data[offset] === 0x00 &&
    data[offset + 1] === 0x00 &&
    data[offset + 2] === 0x01
  ) {
    startLen = 3;
  }
  return data[offset + startLen] & 0x1f;
}

export function splitNals(data: Uint8Array): Uint8Array[] {
  const nals: Uint8Array[] = [];
  const starts: number[] = [];

  for (let i = 0; i <= data.length - 4; i++) {
    if (
      (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) ||
      (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01)
    ) {
      starts.push(i);
    }
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const nalEnd = i + 1 < starts.length ? starts[i + 1] : data.length;
    nals.push(data.slice(start, nalEnd));
  }

  return nals;
}

export function isH264StartCode(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return isAnnexBStartCode(data, 0);
}

export function isRawRGBAFrame(data: Uint8Array): boolean {
  return !isH264StartCode(data) && data.length > 8;
}

export function parseRawRGBAHeader(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } | null {
  if (data.length < 4) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint16(0, false);
  const height = view.getUint16(2, false);
  const pixels = data.slice(4);
  return { width, height, pixels };
}

const NAL_TYPE_SPS = 7;
const NAL_TYPE_PPS = 8;
const NAL_TYPE_IDR = 5;

export function isKeyframeNal(nalData: Uint8Array): boolean {
  for (let i = 0; i <= nalData.length - 4; i++) {
    if (isAnnexBStartCode(nalData, i)) {
      const nalType = parseNalType(nalData, i);
      return nalType === NAL_TYPE_IDR;
    }
  }
  const nalType = nalData[0] & 0x1f;
  return nalType === NAL_TYPE_IDR;
}

export function useH264Decoder(): UseH264DecoderReturn {
  const decoderRef = useRef<VideoDecoder | null>(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFrameRef = useRef<((frame: VideoFrame) => void) | null>(null);
  const spsRef = useRef<Uint8Array | null>(null);
  const ppsRef = useRef<Uint8Array | null>(null);

  const setOnFrame = useCallback((cb: ((frame: VideoFrame) => void) | null) => {
    onFrameRef.current = cb;
  }, []);

  const ensureDecoder = useCallback(() => {
    if (decoderRef.current) return;
    if (typeof VideoDecoder === 'undefined') {
      setError('WebCodecs VideoDecoder not supported');
      return;
    }
    decoderRef.current = new VideoDecoder({
      output: (frame: VideoFrame) => {
        onFrameRef.current?.(frame);
      },
      error: (e: Error) => {
        console.error('[H264Decoder] Decode error:', e);
        setError(e.message);
      },
    });
  }, []);

  const configure = useCallback(
    (config: VideoDecoderConfig) => {
      ensureDecoder();
      if (!decoderRef.current) return;
      try {
        const desc = config.description as Uint8Array | undefined;
        decoderRef.current.configure({
          codec: config.codec || 'avc1.64001F',
          optimizeForLatency: true,
          ...(desc ? { description: desc } : {}),
        });
        setConfigured(true);
        setError(null);
      } catch (e) {
        console.error('[H264Decoder] Configure error:', e);
        setError(String(e));
      }
    },
    [ensureDecoder],
  );

  const buildAVCC = useCallback((sps: Uint8Array, pps: Uint8Array): Uint8Array => {
    const spsNal = sps[0] === 0 ? sps.slice(sps.indexOf(1, sps.indexOf(1) + 1) + 1) : sps;
    const ppsNal = pps[0] === 0 ? pps.slice(pps.indexOf(1, pps.indexOf(1) + 1) + 1) : pps;

    const result = new Uint8Array(11 + spsNal.length + ppsNal.length);
    let offset = 0;
    result[offset++] = 0x01;
    result[offset++] = spsNal[1];
    result[offset++] = spsNal[2];
    result[offset++] = spsNal[3];
    result[offset++] = 0xff;
    result[offset++] = 0xe1;
    result[offset++] = (spsNal.length >> 8) & 0xff;
    result[offset++] = spsNal.length & 0xff;
    result.set(spsNal, offset);
    offset += spsNal.length;
    result[offset++] = 0x01;
    result[offset++] = (ppsNal.length >> 8) & 0xff;
    result[offset++] = ppsNal.length & 0xff;
    result.set(ppsNal, offset);

    return result;
  }, []);

  const feedNalUnit = useCallback(
    (nalData: Uint8Array) => {
      ensureDecoder();
      if (!decoderRef.current) return;

      const nals = splitNals(nalData);
      for (const nal of nals) {
        let nalType: number;
        if (nal[0] === 0 && nal[1] === 0) {
          nalType = parseNalType(nal, 0);
        } else {
          nalType = nal[0] & 0x1f;
        }

        if (nalType === NAL_TYPE_SPS) {
          spsRef.current = nal;
        } else if (nalType === NAL_TYPE_PPS) {
          ppsRef.current = nal;
        }

        if (nalType === NAL_TYPE_IDR && spsRef.current && ppsRef.current && !configured) {
          const avcc = buildAVCC(spsRef.current, ppsRef.current);
          configure({
            codec: 'avc1.64001F',
            description: avcc,
          });
        }

        if (configured || decoderRef.current.state === 'configured') {
          let nalBody: Uint8Array;
          if (nal[0] === 0 && nal[1] === 0 && nal[2] === 0 && nal[3] === 1) {
            nalBody = nal.slice(4);
          } else if (nal[0] === 0 && nal[1] === 0 && nal[2] === 1) {
            nalBody = nal.slice(3);
          } else {
            nalBody = nal;
          }

          const isKey = nalType === NAL_TYPE_IDR || nalType === NAL_TYPE_SPS || nalType === NAL_TYPE_PPS;
          try {
            decoderRef.current.decode(
              new EncodedVideoChunk({
                type: isKey ? 'key' : 'delta',
                timestamp: performance.now() * 1000,
                data: nalBody,
              }),
            );
          } catch (e) {
            console.error('[H264Decoder] Feed error:', e);
          }
        }
      }
    },
    [ensureDecoder, configure, configured, buildAVCC],
  );

  const decode = useCallback(
    (chunk: EncodedVideoChunkInit) => {
      ensureDecoder();
      if (!decoderRef.current) return;

      if (!configured) {
        const data =
          chunk.data instanceof ArrayBuffer
            ? new Uint8Array(chunk.data)
            : new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
        feedNalUnit(data);
        return;
      }

      try {
        decoderRef.current.decode(new EncodedVideoChunk(chunk));
      } catch (e) {
        console.error('[H264Decoder] Decode error:', e);
      }
    },
    [ensureDecoder, configured, feedNalUnit],
  );

  useEffect(() => {
    return () => {
      if (decoderRef.current) {
        decoderRef.current.close();
        decoderRef.current = null;
      }
    };
  }, []);

  return {
    configure,
    decode,
    onFrame: onFrameRef.current,
    setOnFrame,
    configured,
    error,
  };
}
