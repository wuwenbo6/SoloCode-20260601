# WebTransport 实时视频直播系统

基于 Go + WebTransport + WebCodecs H.264 + React 构建的低延迟实时视频直播系统。

## 功能特性

- **WebTransport 传输**: 基于 QUIC/HTTP3 的低延迟双向通信
- **WebCodecs H.264 编解码**: 浏览器原生硬编解码，高性能低延迟
- **动态码率调整**: 根据网络状况（RTT、丢包率）实时调整编码比特率和帧率
- **多路流房间**: 支持多房间，每个房间可同时有多个发布者和订阅者
- **实时统计面板**: 显示 RTT、丢包率、码率、帧率、带宽估算等指标
- **发布/订阅模式**: 支持一人发布多人订阅的直播场景

## 系统架构

```
┌──────────────┐   WebTransport    ┌──────────────┐   WebTransport    ┌──────────────┐
│  Publisher   │ ────────────────> │  Go Server   │ ────────────────> │  Subscriber  │
│  (浏览器)    │                    │  (流媒体中继) │                    │  (浏览器)    │
│ - 摄像头采集 │                    │  - 房间管理   │                    │ - H.264 解码  │
│ - H.264 编码 │                    │  - 流转发     │                    │ - Canvas渲染  │
│ - 带宽估算   │                    │  - 统计广播   │                    │ - 统计显示    │
└──────────────┘                    └──────────────┘                    └──────────────┘
```

## 项目结构

```
.
├── server/                          # Go 后端
│   ├── main.go                      # 服务器主程序
│   ├── cert/                        # TLS 证书
│   │   ├── server.crt
│   │   └── server.key
│   └── go.mod
└── client/                          # React 前端
    ├── src/
    │   ├── types.ts                 # 类型定义
    │   ├── WebTransportClient.ts    # WebTransport 客户端封装
    │   ├── H264VideoEncoder.ts      # WebCodecs H.264 编码器
    │   ├── H264VideoDecoder.ts      # WebCodecs H.264 解码器
    │   ├── VideoCapturer.ts         # 摄像头视频采集
    │   ├── BandwidthEstimator.ts    # 带宽估算与码率调整
    │   ├── StatsPanel.tsx           # 统计面板组件
    │   ├── RoomPanel.tsx            # 房间管理组件
    │   └── App.tsx                  # 主应用组件
    └── package.json
```

## 快速开始

### 1. 启动后端服务器

```bash
cd server
go build -o server .
./server
```

服务器将在 UDP 端口 4433 上监听 WebTransport 连接。

### 2. 启动前端开发服务器

```bash
cd client
npm run dev
```

前端将在 `http://localhost:3000` 启动。

### 3. 配置浏览器

由于使用自签名证书和 WebTransport，需要：

1. 访问 `chrome://flags/#webtransport` 确保 WebTransport 已启用（Chrome 94+ 默认已启用）
2. 访问 `chrome://flags/#insecure-localhost` 启用 "Allow invalid certificates for resources loaded from localhost"
3. 或者先访问 `https://localhost:4433/ws` 接受自签名证书

### 4. 使用流程

1. 打开浏览器访问 `http://localhost:3000`
2. 点击 **Connect** 建立 WebTransport 连接
3. 输入房间 ID（如 `test`），点击 **Join Room**
4. 点击 **Start Publishing** 开始分享摄像头（允许摄像头权限）
5. 在另一浏览器标签/设备重复步骤 1-3，加入同一个房间
6. 点击发布者旁边的 **+** 按钮订阅视频流
7. 观察统计面板查看实时 RTT、丢包率和动态码率调整

## 协议说明

### 控制消息格式

```typescript
interface Message {
  type: MessageType;
  room_id?: string;
  payload?: any;
}
```

### 消息类型

| 类型 | 说明 |
|------|------|
| `join_room` | 加入房间 |
| `leave_room` | 离开房间 |
| `room_list` | 请求/响应房间列表 |
| `room_info` | 房间信息更新 |
| `start_publish` | 开始发布 |
| `stop_publish` | 停止发布 |
| `subscribe` | 订阅发布者 |
| `unsubscribe` | 取消订阅 |
| `stats` | 统计数据 |
| `bitrate_change` | 码率变化通知 |
| `publisher_left` | 发布者离开通知 |
| `pong` | 心跳响应 |

### 视频数据帧格式

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Frame Type  |                 Timestamp (ms)                  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
|                    H.264 NALU Data                            |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Frame Type**: 0 = P 帧, 1 = 关键帧（I 帧）
- **Timestamp**: 32 位无符号整数，毫秒级时间戳
- **NALU Data**: H.264 编码数据，关键帧包含 SPS/PPS 头

## 动态码率调整算法

系统基于以下指标动态调整编码参数：

1. **RTT 阈值**:
   - < 100ms: 网络良好，可提升码率
   - 100-300ms: 网络一般，保持当前码率
   - > 300ms: 网络较差，降低码率

2. **丢包率阈值**:
   - < 1%: 网络良好，可提升码率
   - 1-5%: 网络一般，保持当前码率
   - > 5%: 网络较差，降低码率

3. **调整策略**:
   - 网络差时: 码率 × 0.7，帧率 -5~10fps
   - 网络好时: 码率 × 1.15，帧率 +5fps
   - 调整间隔: 至少 10% 码率变化才触发更新

## 浏览器兼容性

- Chrome 94+ ✅
- Edge 94+ ✅
- Safari 17+ ✅（部分支持）
- Firefox 119+ ✅（需手动启用）

## 已知限制

1. WebTransport 是新兴标准，浏览器支持可能有差异
2. 自签名证书需要手动信任或配置浏览器标志
3. H.264 编解码支持依赖浏览器和操作系统的硬件加速能力
4. 目前仅支持单视频流订阅，多路流需要额外的画布管理

## 开发说明

### 重新生成 TLS 证书

```bash
cd server/cert
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes -subj "/CN=localhost"
```

### 生产环境部署

1. 使用正规 CA 签名的证书
2. 配置适当的 CORS 策略
3. 考虑使用 CDN 分发前端资源
4. 服务器端增加认证和鉴权机制
5. 配置适当的流控和 QoS 策略
