import type { 
  Message, 
  MessageType, 
  RoomInfo, 
  StatsPayload, 
  RequestKeyframePayload, 
  FrameAckPayload,
  ChatMessagePayload,
  RecordingStatusPayload,
  TextOverlayPayload,
  StartRecordingPayload,
  StopRecordingPayload
} from './types';

export interface WebTransportClientOptions {
  url: string;
  onMessage?: (msg: Message) => void;
  onRoomInfo?: (info: RoomInfo) => void;
  onStats?: (stats: StatsPayload) => void;
  onPublisherLeft?: (publisherId: string) => void;
  onStreamData?: (publisherId: string, data: Uint8Array, timestamp: number, frameType: number) => void;
  onRequestKeyFrame?: (subscriberId: string) => void;
  onChatMessage?: (chat: ChatMessagePayload) => void;
  onRecordingStatus?: (status: RecordingStatusPayload) => void;
  onTextOverlay?: (overlay: TextOverlayPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface PendingFrame {
  frameId: number;
  frameType: number;
  timestamp: number;
  data: Uint8Array;
  totalChunks: number;
  sentAt: number;
  retryCount: number;
  acknowledged: Set<number>;
}

interface ReceivedFrame {
  frameId: number;
  frameType: number;
  timestamp: number;
  totalChunks: number;
  chunks: Map<number, Uint8Array>;
  receivedAt: number;
}

const MAX_CHUNK_SIZE = 1200;
const HEADER_SIZE = 13;
const MAX_PAYLOAD_SIZE = MAX_CHUNK_SIZE - HEADER_SIZE;
const RETRY_TIMEOUT = 500;
const MAX_RETRIES = 3;
const FRAME_RECEIVE_TIMEOUT = 1000;
const MAX_PENDING_FRAMES = 50;

export class WebTransportClient {
  private transport: WebTransport | null = null;
  private options: WebTransportClientOptions;
  private clientId: string;
  private currentRoomId: string | null = null;
  private isConnected = false;
  private outgoingStream: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private bidirectionalStream: WebTransportBidirectionalStream | null = null;

  private rttMeasurements: number[] = [];
  private packetSent = 0;
  private packetLost = 0;
  private bytesSent = 0;
  private bytesReceived = 0;
  private lastStatsTime = Date.now();
  private lastBitrate = 0;

  private pendingFrames: Map<number, PendingFrame> = new Map();
  private receivedFrames: Map<number, ReceivedFrame> = new Map();
  private retryIntervalId: number | null = null;
  private cleanupIntervalId: number | null = null;
  private consecutiveFrameLosses = 0;
  private readonly MAX_CONSECUTIVE_LOSSES = 5;

  constructor(options: WebTransportClientOptions) {
    this.options = options;
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getClientId(): string {
    return this.clientId;
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  connected(): boolean {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    try {
      console.log(`[WT] Connecting to ${this.options.url}`);
      this.transport = new WebTransport(this.options.url, {
        serverCertificateHashes: [],
      });

      this.transport.closed.then(() => {
        console.log('[WT] Connection closed');
        this.isConnected = false;
        this.stopRetryLoop();
        this.stopCleanupLoop();
        this.options.onDisconnected?.();
      }).catch((err) => {
        console.error('[WT] Connection error:', err);
        this.isConnected = false;
        this.stopRetryLoop();
        this.stopCleanupLoop();
        this.options.onDisconnected?.();
      });

      await this.transport.ready;
      this.isConnected = true;
      console.log('[WT] Connection established');

      this.acceptIncomingStreams();
      this.startRTTMeasurement();
      this.startRetryLoop();
      this.startCleanupLoop();
      this.options.onConnected?.();

    } catch (err) {
      console.error('[WT] Failed to connect:', err);
      throw err;
    }
  }

  private startRetryLoop(): void {
    this.retryIntervalId = window.setInterval(() => {
      this.retryPendingFrames();
    }, 100);
  }

  private stopRetryLoop(): void {
    if (this.retryIntervalId !== null) {
      clearInterval(this.retryIntervalId);
      this.retryIntervalId = null;
    }
  }

  private startCleanupLoop(): void {
    this.cleanupIntervalId = window.setInterval(() => {
      this.cleanupStaleFrames();
    }, 500);
  }

  private stopCleanupLoop(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  private retryPendingFrames(): void {
    const now = Date.now();

    for (const [frameId, frame] of this.pendingFrames) {
      if (now - frame.sentAt > RETRY_TIMEOUT) {
        if (frame.retryCount >= MAX_RETRIES) {
          console.warn(`[WT] Frame ${frameId} exceeded max retries (${MAX_RETRIES}), dropping`);
          this.pendingFrames.delete(frameId);
          this.packetLost++;
          this.consecutiveFrameLosses++;

          if (this.consecutiveFrameLosses >= this.MAX_CONSECUTIVE_LOSSES) {
            console.warn('[WT] Too many consecutive frame losses, requesting key frame');
            this.requestKeyFrameFromPublisher();
            this.consecutiveFrameLosses = 0;
          }
          continue;
        }

        frame.retryCount++;
        frame.sentAt = now;

        for (let i = 0; i < frame.totalChunks; i++) {
          if (!frame.acknowledged.has(i)) {
            this.sendChunk(frame, i);
          }
        }

        console.debug(`[WT] Retrying frame ${frameId}, attempt ${frame.retryCount}`);
      }
    }
  }

  private cleanupStaleFrames(): void {
    const now = Date.now();

    for (const [frameId, frame] of this.receivedFrames) {
      if (now - frame.receivedAt > FRAME_RECEIVE_TIMEOUT) {
        console.warn(`[WT] Frame ${frameId} timed out, received ${frame.chunks.size}/${frame.totalChunks} chunks`);
        this.receivedFrames.delete(frameId);
        this.consecutiveFrameLosses++;

        if (this.consecutiveFrameLosses >= this.MAX_CONSECUTIVE_LOSSES) {
          console.warn('[WT] Too many incomplete frames, requesting key frame');
          this.requestKeyFrameFromPublisher();
          this.consecutiveFrameLosses = 0;
        }
      }
    }
  }

  private async acceptIncomingStreams(): Promise<void> {
    if (!this.transport) return;

    try {
      const reader = this.transport.incomingUnidirectionalStreams.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        this.handleIncomingStream(value);
      }
    } catch (err) {
      console.error('[WT] Error accepting incoming streams:', err);
    }
  }

  private async handleIncomingStream(stream: WebTransportReceiveStream): Promise<void> {
    try {
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      if (totalLength === 0) return;

      const data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }

      this.bytesReceived += data.length;

      if (totalLength >= HEADER_SIZE) {
        const frameType = data[0];

        if (frameType === 0 || frameType === 1) {
          this.handleVideoChunk(data);
        } else {
          try {
            const text = new TextDecoder().decode(data);
            const msg = JSON.parse(text);
            this.handleMessage(msg);
          } catch {
            console.warn('[WT] Could not parse control message');
          }
        }
      } else {
        try {
          const text = new TextDecoder().decode(data);
          const msg = JSON.parse(text);
          this.handleMessage(msg);
        } catch {
          console.warn('[WT] Could not parse control message');
        }
      }
    } catch (err) {
      console.error('[WT] Error handling incoming stream:', err);
    }
  }

  private handleVideoChunk(data: Uint8Array): void {
    if (data.length < HEADER_SIZE) return;

    const view = new DataView(data.buffer, data.byteOffset);
    const frameType = data[0];
    const timestamp = view.getUint32(1, false);
    const frameId = view.getUint32(5, false);
    const chunkIndex = view.getUint16(9, false);
    const totalChunks = view.getUint16(11, false);
    const payload = data.slice(HEADER_SIZE);

    this.sendFrameAck(frameId, chunkIndex, totalChunks, true);

    let receivedFrame = this.receivedFrames.get(frameId);
    if (!receivedFrame) {
      receivedFrame = {
        frameId,
        frameType,
        timestamp,
        totalChunks,
        chunks: new Map(),
        receivedAt: Date.now(),
      };
      this.receivedFrames.set(frameId, receivedFrame);
    }

    receivedFrame.chunks.set(chunkIndex, payload);

    if (receivedFrame.chunks.size === totalChunks) {
      this.assembleAndDeliverFrame(receivedFrame);
    }
  }

  private assembleAndDeliverFrame(frame: ReceivedFrame): void {
    this.receivedFrames.delete(frame.frameId);
    this.consecutiveFrameLosses = 0;

    let totalSize = 0;
    for (let i = 0; i < frame.totalChunks; i++) {
      const chunk = frame.chunks.get(i);
      if (chunk) {
        totalSize += chunk.length;
      }
    }

    const assembled = new Uint8Array(totalSize);
    let offset = 0;
    for (let i = 0; i < frame.totalChunks; i++) {
      const chunk = frame.chunks.get(i);
      if (chunk) {
        assembled.set(chunk, offset);
        offset += chunk.length;
      }
    }

    this.packetSent++;
    this.options.onStreamData?.(this.currentRoomId || '', assembled, frame.timestamp, frame.frameType);

    if (frame.frameType === 1) {
      console.debug(`[WT] Received key frame ${frame.frameId}, size: ${totalSize} bytes`);
    }
  }

  private sendFrameAck(frameId: number, chunkIndex: number, totalChunks: number, received: boolean): void {
    const payload: FrameAckPayload = {
      frame_id: frameId,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
      received,
    };
    this.sendMessage('frame_ack', payload).catch(() => {});
  }

  private handleMessage(msg: Message): void {
    this.options.onMessage?.(msg);

    switch (msg.type) {
      case 'room_info':
        this.options.onRoomInfo?.(msg.payload as RoomInfo);
        break;
      case 'stats':
        this.options.onStats?.(msg.payload as StatsPayload);
        break;
      case 'publisher_left':
        this.options.onPublisherLeft?.(msg.payload.publisher_id);
        break;
      case 'request_keyframe':
        this.options.onRequestKeyFrame?.((msg.payload as RequestKeyframePayload).subscriber_id);
        break;
      case 'frame_ack':
        this.handleFrameAck(msg.payload as FrameAckPayload);
        break;
      case 'chat_message':
        this.options.onChatMessage?.(msg.payload as ChatMessagePayload);
        break;
      case 'recording_status':
        this.options.onRecordingStatus?.(msg.payload as RecordingStatusPayload);
        break;
      case 'text_overlay':
        this.options.onTextOverlay?.(msg.payload as TextOverlayPayload);
        break;
    }
  }

  private handleFrameAck(ack: FrameAckPayload): void {
    const frame = this.pendingFrames.get(ack.frame_id);
    if (frame && ack.received) {
      frame.acknowledged.add(ack.chunk_index);

      if (frame.acknowledged.size === frame.totalChunks) {
        this.pendingFrames.delete(ack.frame_id);
        this.consecutiveFrameLosses = 0;
      }
    }
  }

  async requestKeyFrameFromPublisher(): Promise<void> {
    const payload: RequestKeyframePayload = {
      publisher_id: this.currentRoomId || '',
      subscriber_id: this.clientId,
    };
    await this.sendMessage('request_keyframe', payload);
    console.log('[WT] Requested key frame from publisher');
  }

  async sendChatMessage(message: string, clientName: string = 'User'): Promise<void> {
    const payload: ChatMessagePayload = {
      client_id: this.clientId,
      client_name: clientName,
      message,
      timestamp: Date.now(),
    };
    await this.sendMessage('chat_message', payload);
    console.log('[WT] Sent chat message:', message);
  }

  async startRecording(roomId: string, publisherId: string): Promise<void> {
    const payload: StartRecordingPayload = {
      room_id: roomId,
      publisher_id: publisherId,
    };
    await this.sendMessage('start_recording', payload);
    console.log('[WT] Requested start recording for publisher:', publisherId);
  }

  async stopRecording(roomId: string, publisherId: string): Promise<void> {
    const payload: StopRecordingPayload = {
      room_id: roomId,
      publisher_id: publisherId,
    };
    await this.sendMessage('stop_recording', payload);
    console.log('[WT] Requested stop recording for publisher:', publisherId);
  }

  async sendTextOverlay(
    text: string,
    show: boolean = true,
    position: TextOverlayPayload['position'] = 'top-left',
    fontSize: number = 24,
    color: string = '#ffffff',
    backgroundColor: string = 'rgba(0,0,0,0.6)'
  ): Promise<void> {
    const payload: TextOverlayPayload = {
      publisher_id: this.clientId,
      text,
      position,
      font_size: fontSize,
      color,
      background_color: backgroundColor,
      show,
    };
    await this.sendMessage('text_overlay', payload);
    console.log('[WT] Sent text overlay:', text);
  }

  private async startRTTMeasurement(): Promise<void> {
    while (this.isConnected && this.transport) {
      try {
        const startTime = performance.now();
        await this.sendMessage('pong', {});
        const rtt = performance.now() - startTime;

        this.rttMeasurements.push(rtt);
        if (this.rttMeasurements.length > 30) {
          this.rttMeasurements.shift();
        }
      } catch {
      }
      await this.sleep(1000);
    }
  }

  getRTT(): number {
    if (this.rttMeasurements.length === 0) return 0;
    const sorted = [...this.rttMeasurements].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)]);
  }

  getLossRate(): number {
    if (this.packetSent === 0) return 0;
    return (this.packetLost / this.packetSent) * 100;
  }

  getCurrentBitrate(): number {
    const now = Date.now();
    const elapsed = (now - this.lastStatsTime) / 1000;
    if (elapsed < 0.5) return this.lastBitrate;

    const bitrate = (this.bytesSent * 8) / elapsed;
    this.lastBitrate = bitrate;
    this.bytesSent = 0;
    this.lastStatsTime = now;
    return bitrate;
  }

  reportPacketLoss(count: number): void {
    this.packetLost += count;
  }

  async sendMessage(type: MessageType, payload: any): Promise<void> {
    if (!this.isConnected || !this.transport) {
      throw new Error('Not connected');
    }

    const msg: Message = { type, payload };
    const data = new TextEncoder().encode(JSON.stringify(msg));

    try {
      const stream = await this.transport.createUnidirectionalStream();
      const writer = stream.getWriter();
      await writer.write(data);
      await writer.close();
      this.bytesSent += data.length;
    } catch (err) {
      console.error('[WT] Failed to send message:', err);
      throw err;
    }
  }

  async sendVideoData(data: Uint8Array, timestamp: number, frameType: number, frameId: number): Promise<void> {
    if (!this.isConnected || !this.transport) {
      throw new Error('Not connected');
    }

    if (this.pendingFrames.size >= MAX_PENDING_FRAMES) {
      console.warn(`[WT] Too many pending frames (${MAX_PENDING_FRAMES}), dropping frame ${frameId}`);
      this.packetLost++;
      return;
    }

    const totalChunks = Math.ceil(data.length / MAX_PAYLOAD_SIZE);

    const pendingFrame: PendingFrame = {
      frameId,
      frameType,
      timestamp,
      data,
      totalChunks,
      sentAt: Date.now(),
      retryCount: 0,
      acknowledged: new Set(),
    };

    this.pendingFrames.set(frameId, pendingFrame);

    for (let i = 0; i < totalChunks; i++) {
      this.sendChunk(pendingFrame, i);
    }

    if (frameType === 1) {
      console.debug(`[WT] Sent key frame ${frameId}, ${totalChunks} chunks, size: ${data.length} bytes`);
    }
  }

  private async sendChunk(frame: PendingFrame, chunkIndex: number): Promise<void> {
    if (!this.isConnected || !this.transport) return;

    const start = chunkIndex * MAX_PAYLOAD_SIZE;
    const end = Math.min(start + MAX_PAYLOAD_SIZE, frame.data.length);
    const payload = frame.data.slice(start, end);

    const header = new Uint8Array(HEADER_SIZE);
    header[0] = frame.frameType;
    const view = new DataView(header.buffer);
    view.setUint32(1, frame.timestamp, false);
    view.setUint32(5, frame.frameId, false);
    view.setUint16(9, chunkIndex, false);
    view.setUint16(11, frame.totalChunks, false);

    const packet = new Uint8Array(header.length + payload.length);
    packet.set(header);
    packet.set(payload, header.length);

    try {
      if (!this.bidirectionalStream) {
        this.bidirectionalStream = await this.transport.createBidirectionalStream();
        this.outgoingStream = this.bidirectionalStream.writable.getWriter();
      }

      if (this.outgoingStream) {
        await this.outgoingStream.write(packet);
        this.bytesSent += packet.length;
      }
    } catch (err) {
      console.error(`[WT] Failed to send chunk ${chunkIndex} of frame ${frame.frameId}:`, err);
      this.bidirectionalStream = null;
      this.outgoingStream = null;
    }
  }

  async joinRoom(roomId: string, roomName: string): Promise<void> {
    await this.sendMessage('join_room', {
      room_id: roomId,
      room_name: roomName,
      client_id: this.clientId,
    });
    this.currentRoomId = roomId;

    this.receivedFrames.clear();
    this.pendingFrames.clear();
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoomId) {
      await this.sendMessage('leave_room', {
        room_id: this.currentRoomId,
      });
      this.currentRoomId = null;
    }

    this.receivedFrames.clear();
    this.pendingFrames.clear();
  }

  async startPublish(): Promise<void> {
    this.receivedFrames.clear();
    this.pendingFrames.clear();
    await this.sendMessage('start_publish', {});
  }

  async stopPublish(): Promise<void> {
    await this.sendMessage('stop_publish', {});
  }

  async subscribe(publisherId: string): Promise<void> {
    this.receivedFrames.clear();
    await this.sendMessage('subscribe', {
      publisher_id: publisherId,
    });

    await this.sleep(100);
    await this.requestKeyFrameFromPublisher();
  }

  async unsubscribe(publisherId: string): Promise<void> {
    await this.sendMessage('unsubscribe', {
      publisher_id: publisherId,
    });
    this.receivedFrames.clear();
  }

  async sendStats(stats: StatsPayload): Promise<void> {
    await this.sendMessage('stats', stats);
  }

  async sendBitrateChange(bitrate: number, framerate: number): Promise<void> {
    await this.sendMessage('bitrate_change', {
      bitrate,
      framerate,
    });
  }

  async requestRoomList(): Promise<void> {
    await this.sendMessage('room_list', {});
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  close(): void {
    this.stopRetryLoop();
    this.stopCleanupLoop();

    if (this.outgoingStream) {
      this.outgoingStream.close().catch(() => {});
      this.outgoingStream = null;
    }
    if (this.bidirectionalStream) {
      this.bidirectionalStream = null;
    }
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.isConnected = false;

    this.pendingFrames.clear();
    this.receivedFrames.clear();
  }
}
