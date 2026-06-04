## 1. 架构设计

```mermaid
graph TB
    subgraph "前端 React"
        "WebTransport客户端" --> "控制命令发送"
        "WebTransport客户端" --> "视频流接收"
        "WebTransport客户端" --> "传感器数据接收"
        "WebTransport客户端" --> "力矩数据接收"
        "视频流接收" --> "H.264解码Canvas"
        "传感器数据接收" --> "传感器面板"
        "力矩数据接收" --> "力反馈引擎"
        "控制命令发送" --> "控制面板"
        "传感器数据接收" --> "Zustand Store"
        "力矩数据接收" --> "Zustand Store"
        "Zustand Store" --> "Three.js 3D模型"
        "力反馈引擎" --> "Gamepad API"
    end

    subgraph "后端 Go"
        "WebTransport服务器" --> "命令解析器"
        "命令解析器" --> "机器人模拟器"
        "机器人模拟器" --> "视频编码器"
        "机器人模拟器" --> "传感器模拟器"
        "机器人模拟器" --> "力矩计算器"
        "视频编码器" --> "WebTransport服务器"
        "传感器模拟器" --> "WebTransport服务器"
        "力矩计算器" --> "WebTransport服务器"
    end

    "前端 React" <--WebTransport--> "后端 Go"
```

## 2. 技术说明

- 前端：React@18 + TypeScript + TailwindCSS@3 + Vite
- 3D渲染：Three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing
- 状态管理：Zustand
- 初始化工具：vite-init（react-ts模板）
- 后端：Go 1.22+ + WebTransport（基于quic-go）
- 通信协议：WebTransport（双向流 + 数据报）
- 视频编解码：H.264 NAL单元 + WebCodecs API（前端解码）
- 力反馈：Gamepad API Vibration Actuator

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 控制台主页，包含3D视图、视频流、传感器、控制面板 |

## 4. 通信协议定义

### 4.1 前端→后端 控制命令（通过WebTransport双向流发送）

```typescript
interface ControlCommand {
  type: "control"
  timestamp: number
  wheels: {
    leftSpeed: number    // -1.0 ~ 1.0
    rightSpeed: number   // -1.0 ~ 1.0
  }
  arm: {
    joints: number[]     // 6个关节角度(弧度)
  }
  force: {
    desiredTorques: number[]  // 6个关节期望力矩(N·m)
  }
}
```

### 4.2 后端→前端 视频帧（通过WebTransport数据报发送）

```typescript
interface VideoFrame {
  type: "video"
  timestamp: number
  sequence: number
  isKeyframe: boolean
  data: Uint8Array      // H.264 NAL单元数据
}
```

### 4.3 后端→前端 传感器数据（通过WebTransport双向流发送）

```typescript
interface SensorData {
  type: "sensor"
  timestamp: number
  imu: {
    accel: { x: number; y: number; z: number }    // m/s²
    gyro: { x: number; y: number; z: number }     // rad/s
    orientation: { roll: number; pitch: number; yaw: number }  // rad
  }
  battery: {
    voltage: number     // V
    percentage: number  // 0~100
    current: number     // A
  }
  actualTorques: number[]  // 6个关节实际力矩(N·m)
}
```

### 4.4 连接状态

```typescript
interface ConnectionState {
  status: "connecting" | "connected" | "disconnected" | "error"
  latency: number      // ms
  throughput: number    // bytes/s
}
```

## 5. 后端架构图

```mermaid
graph LR
    "WebTransport Handler" --> "Command Dispatcher"
    "Command Dispatcher" --> "Wheel Controller"
    "Command Dispatcher" --> "Arm Controller"
    "Command Dispatcher" --> "Force Controller"
    "Wheel Controller" --> "Robot Simulator"
    "Arm Controller" --> "Robot Simulator"
    "Force Controller" --> "Robot Simulator"
    "Robot Simulator" --> "Video Encoder"
    "Robot Simulator" --> "Sensor Generator"
    "Robot Simulator" --> "Torque Calculator"
    "Video Encoder" --> "Datagram Sender"
    "Sensor Generator" --> "Stream Sender"
    "Torque Calculator" --> "Stream Sender"
```

## 6. 项目目录结构

```
sp40/
├── frontend/                # React前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Robot3D.tsx          # Three.js机器人3D模型
│   │   │   ├── VideoPlayer.tsx      # H.264视频播放
│   │   │   ├── SensorPanel.tsx      # 传感器数据面板
│   │   │   ├── ControlPanel.tsx     # 控制命令面板
│   │   │   ├── ForceFeedback.tsx    # 力反馈面板
│   │   │   └── ConnectionStatus.tsx # 连接状态
│   │   ├── hooks/
│   │   │   └── useWebTransport.ts   # WebTransport通信Hook
│   │   ├── store/
│   │   │   └── robotStore.ts        # Zustand状态管理
│   │   ├── utils/
│   │   │   └── h264Decoder.ts       # H.264解码工具
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                 # Go后端
│   ├── main.go              # 入口
│   ├── go.mod
│   ├── server/
│   │   └── webtransport.go  # WebTransport服务器
│   ├── robot/
│   │   ├── simulator.go     # 机器人模拟器
│   │   ├── arm.go           # 机械臂模拟
│   │   ├── wheels.go        # 轮子模拟
│   │   ├── sensors.go       # 传感器模拟
│   │   └── video.go         # 视频生成
│   └── protocol/
│       └── messages.go      # 通信协议定义
└── .trae/
    └── documents/
```
