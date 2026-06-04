## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端 (React)"
        A["游戏大厅页"] --> B["游戏串流页"]
        B --> C["Canvas视频渲染器<br/>(含FEC解码器)"]
        B --> D["输入捕获层<br/>(含输入预测)"]
        B --> E["触控Overlay<br/>(事件穿透)"]
        B --> F["码率自适应模块<br/>(选择性重传请求)"]
    end

    subgraph "通信层"
        G["WebRTC DataChannel<br/>unreliable模式, 顺序传递"]
        H["WebTransport<br/>单向高吞吐视频流, QUIC丢包重传"]
    end

    subgraph "后端 (Node.js Express)"
        I["信令服务器<br/>WebRTC SDP/ICE交换"]
        J["WebTransport服务器<br/>FEC编码, 帧缓冲"]
        K["游戏实例管理器<br/>模拟Unity WebGL"]
        L["视频编码器<br/>H.264关键帧/差帧"]
        M["码率控制器<br/>自适应码率调整"]
        N["选择性重传模块<br/>帧缓冲池, 按需重传"]
    end

    D -->|"输入事件(带sequence)"| G
    D -->|"本地预测(dead reckoning)"| C
    G -->|"输入事件"| K
    K -->|"画面帧"| L
    L -->|"编码帧"| M
    M -->|"视频帧"| J
    J -->|"FEC冗余帧"| H
    H -->|"视频帧/FEC包"| C
    F -->|"码率反馈"| G
    G -->|"码率调整"| M
    F -->|"NACK重传请求<br/>(选择性帧ID)"| G
    G -->|"NACK请求"| N
    N -->|"重传指定帧"| J
    E -->|"触控事件"| D
```

## 2. 技术说明

- 前端：React@18 + tailwindcss@3 + vite + zustand
- 初始化工具：vite-init (react-express-ts模板)
- 后端：Express@4 + Node.js WebTransport API
- 数据库：无（纯实时通信，无持久化需求）
- 通信协议：WebRTC (SCTP) + WebTransport (QUIC)
  - WebRTC DataChannel: `maxRetransmits: 0` (unreliable), `ordered: true` (顺序传递)
  - WebTransport: 单通道推流, QUIC内置重传 + 应用层FEC
- 视频编解码：前端 Canvas 2D 渲染 GameObject, 后端模拟编码
- 游戏模拟：Canvas 2D 渲染替代Unity WebGL，服务器端运行游戏逻辑
- 抗丢包：
  - FEC（前向纠错）：XOR编码, 每4帧插入1个冗余包
  - 选择性重传（NACK）：客户端检测到丢包后只请求缺失的特定帧
  - 帧缓冲池：服务器缓存最近60帧用于重传
- 输入延迟优化：
  - WebRTC DataChannel unreliable模式，减少ACK等待时间
  - Dead Reckoning输入预测：客户端在等待服务器确认前先本地预测玩家移动
  - 基于RTT的预测平滑：根据网络RTT动态调整预测幅度
- 触控优化：
  - 触控Overlay按区域划分事件捕获和穿透
  - 游戏UI区域（分数、波次、Game Over）自动穿透触控事件
  - 边缘拖拽区域用于操控，中央区域用于查看

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 游戏大厅页，展示游戏列表和连接入口 |
| /play/:gameId | 游戏串流页，全屏视频流+输入捕获+触控overlay |

## 4. API定义

### 4.1 WebSocket信令API

```typescript
interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'start-game' | 'stop-game';
  payload: any;
}

interface RTCOfferPayload {
  sdp: string;
  gameId: string;
}

interface RTCAnswerPayload {
  sdp: string;
}

interface ICECandidatePayload {
  candidate: RTCIceCandidateInit;
}
```

### 4.2 WebRTC DataChannel 输入协议

```typescript
interface InputEvent {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'keydown' | 'keyup' | 'touchstart' | 'touchmove' | 'touchend';
  timestamp: number;
  data: {
    x?: number;
    y?: number;
    button?: number;
    key?: string;
    touches?: Array<{ id: number; x: number; y: number }>;
  };
}

interface BitrateFeedback {
  type: 'bitrate-feedback';
  timestamp: number;
  data: {
    targetBitrate: number;
    packetLoss: number;
    rtt: number;
  };
}

interface KeyframeRequest {
  type: 'keyframe-request';
  timestamp: number;
  data: {
    frameId: number;
  };
}
```

### 4.3 WebTransport 视频帧协议

```typescript
interface VideoFrame {
  frameId: number;
  isKeyframe: boolean;
  timestamp: number;
  width: number;
  height: number;
  bitrate: number;
  data: ArrayBuffer;
}
```

### 4.4 HTTP API

```typescript
GET /api/games
Response: Array<{ id: string; name: string; description: string; thumbnail: string; }>

POST /api/signal
Body: SignalingMessage
Response: SignalingMessage
```

## 5. 服务器架构图

```mermaid
flowchart LR
    A["Express Router"] --> B["信令控制器"]
    A --> C["游戏API控制器"]
    B --> D["WebRTC管理器"]
    D --> E["DataChannel处理器"]
    D --> F["ICE/SDP交换"]
    E --> G["输入事件分发"]
    G --> H["游戏实例管理器"]
    H --> I["视频编码器"]
    I --> J["码率控制器"]
    I --> K["关键帧管理器"]
    J --> L["WebTransport推送器"]
    K --> L
```

## 6. 数据模型（不适用）

本项目为纯实时通信系统，不使用数据库。游戏列表为静态配置，会话状态保存在内存中。
