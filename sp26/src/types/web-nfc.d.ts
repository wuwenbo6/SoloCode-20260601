interface NDEFRecordInit {
  recordType: 'text' | 'url' | 'mime' | 'absolute-url' | 'empty' | 'unknown' | 'smart-poster';
  mediaType?: string;
  id?: string;
  data?: string | number[] | ArrayBuffer | DataView;
  lang?: string;
}

interface NDEFRecord {
  readonly recordType: string;
  readonly mediaType?: string;
  readonly id?: string;
  readonly data: DataView;
  readonly encoding?: string;
  readonly lang?: string;

  toRecords?(): NDEFRecord[];
}

interface NDEFMessage {
  readonly records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  readonly serialNumber?: string;
  readonly message: NDEFMessage;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

declare class NDEFReader extends EventTarget {
  constructor();

  onreading: ((this: NDEFReader, ev: NDEFReadingEvent) => unknown) | null;
  onreadingerror: ((this: NDEFReader, ev: Event) => unknown) | null;

  scan(options?: NDEFScanOptions): Promise<void>;
  write(message: NDEFRecordInit | NDEFRecordInit[], options?: NDEFWriteOptions): Promise<void>;
  makeReadOnly(options?: NDEFWriteOptions): Promise<void>;
}

declare class NDEFWriter {
  constructor();

  write(message: NDEFRecordInit | NDEFRecordInit[], options?: NDEFWriteOptions): Promise<void>;
  makeReadOnly(options?: NDEFWriteOptions): Promise<void>;
}

interface Navigator {
  readonly nfc?: {
    NDEFReader: typeof NDEFReader;
    NDEFWriter: typeof NDEFWriter;
  };
}
