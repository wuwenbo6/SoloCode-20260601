interface WebTransportReceiveStream extends ReadableStream<Uint8Array> {}

interface WebTransport {
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  readonly datagrams: WebTransportDatagramDuplexStream;
  readonly incomingUnidirectionalStreams: ReadableStream<WebTransportReceiveStream>;
  createBidirectionalStream(): Promise<WebTransportBidirectionalStream>;
  close(): void;
}

interface WebTransportDatagramDuplexStream {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
}

interface WebTransportBidirectionalStream {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
}

declare const WebTransport: {
  prototype: WebTransport;
  new (url: string): WebTransport;
};
