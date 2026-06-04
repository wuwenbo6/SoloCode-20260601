import { useRef, useCallback, useEffect, useState } from 'react';

interface UseWebTransportOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

interface UseWebTransportReturn {
  connected: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  sendDatagram: (data: Uint8Array) => void;
  sendOnStream: (data: Uint8Array) => Promise<void>;
  incomingStreams: ReadableStream<WebTransportReceiveStream> | null;
  datagrams: { readable: ReadableStream; writable: WritableStream } | null;
}

export function useWebTransport({
  url,
  autoReconnect = true,
  reconnectDelay = 3000,
}: UseWebTransportOptions): UseWebTransportReturn {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [incomingStreams, setIncomingStreams] = useState<ReadableStream<WebTransportReceiveStream> | null>(null);
  const [datagrams, setDatagrams] = useState<{ readable: ReadableStream; writable: WritableStream } | null>(null);
  const transportRef = useRef<WebTransport | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const bidirectionalStreamRef = useRef<WebTransportBidirectionalStream | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    transportRef.current = null;
    bidirectionalStreamRef.current = null;
    setConnected(false);
    setConnecting(false);
    setIncomingStreams(null);
    setDatagrams(null);
  }, []);

  const connect = useCallback(() => {
    if (transportRef.current) return;
    intentionalCloseRef.current = false;
    setConnecting(true);

    try {
      const transport = new WebTransport(url);
      transportRef.current = transport;

      transport.ready
        .then(() => {
          setConnected(true);
          setConnecting(false);
          setIncomingStreams(transport.incomingUnidirectionalStreams);
          setDatagrams(transport.datagrams);
        })
        .catch((err) => {
          console.error('[WebTransport] Connection failed:', err);
          cleanup();
          if (autoReconnect && !intentionalCloseRef.current) {
            reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
          }
        });

      transport.closed
        .then(() => {
          cleanup();
          if (autoReconnect && !intentionalCloseRef.current) {
            reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
          }
        })
        .catch((err) => {
          console.error('[WebTransport] Closed with error:', err);
          cleanup();
          if (autoReconnect && !intentionalCloseRef.current) {
            reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
          }
        });
    } catch (err) {
      console.error('[WebTransport] Create failed:', err);
      cleanup();
      if (autoReconnect) {
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
      }
    }
  }, [url, autoReconnect, reconnectDelay, cleanup]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (transportRef.current) {
      transportRef.current.close();
    }
    cleanup();
  }, [cleanup]);

  const sendDatagram = useCallback((data: Uint8Array) => {
    if (!transportRef.current) return;
    const writer = transportRef.current.datagrams.writable.getWriter();
    writer.write(data).then(() => writer.releaseLock()).catch(() => writer.releaseLock());
  }, []);

  const sendOnStream = useCallback(async (data: Uint8Array) => {
    if (!transportRef.current) return;
    if (!bidirectionalStreamRef.current) {
      bidirectionalStreamRef.current =
        await transportRef.current.createBidirectionalStream();
    }
    const writer = bidirectionalStreamRef.current.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
  }, []);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (transportRef.current) {
        transportRef.current.close();
      }
    };
  }, []);

  return {
    connected,
    connecting,
    connect,
    disconnect,
    sendDatagram,
    sendOnStream,
    incomingStreams,
    datagrams,
  };
}
