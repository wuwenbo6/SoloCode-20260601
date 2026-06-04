export type MessageType =
  | 'join_room'
  | 'leave_room'
  | 'room_list'
  | 'room_info'
  | 'start_publish'
  | 'stop_publish'
  | 'subscribe'
  | 'unsubscribe'
  | 'stats'
  | 'bitrate_change'
  | 'publisher_left'
  | 'pong'
  | 'request_keyframe'
  | 'frame_ack'
  | 'chat_message'
  | 'start_recording'
  | 'stop_recording'
  | 'recording_status'
  | 'text_overlay';

export interface Message {
  type: MessageType;
  room_id?: string;
  payload?: any;
}

export interface RoomInfo {
  id: string;
  name: string;
  client_count: number;
  publisher_ids: string[];
}

export interface JoinRoomPayload {
  room_id: string;
  room_name: string;
  client_id: string;
}

export interface SubscribePayload {
  publisher_id: string;
}

export interface RequestKeyframePayload {
  publisher_id: string;
  subscriber_id: string;
}

export interface FrameAckPayload {
  frame_id: number;
  chunk_index: number;
  total_chunks: number;
  received: boolean;
}

export interface ChatMessagePayload {
  client_id: string;
  client_name: string;
  message: string;
  timestamp: number;
}

export interface StartRecordingPayload {
  room_id: string;
  publisher_id: string;
}

export interface StopRecordingPayload {
  room_id: string;
  publisher_id: string;
}

export interface RecordingStatusPayload {
  room_id: string;
  publisher_id: string;
  is_recording: boolean;
  filename?: string;
  start_time?: number;
  duration?: number;
}

export interface TextOverlayPayload {
  publisher_id: string;
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  font_size: number;
  color: string;
  background_color: string;
  show: boolean;
}

export interface StatsPayload {
  rtt: number;
  loss_rate: number;
  bitrate: number;
  framerate: number;
  timestamp: number;
}

export interface EncodingConfig {
  bitrate: number;
  framerate: number;
  width: number;
  height: number;
}

export interface StreamStats {
  rtt: number;
  lossRate: number;
  bitrate: number;
  framerate: number;
  estimatedBandwidth: number;
}
