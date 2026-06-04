## 1. 架构设计

```mermaid
flowchart TD
    subgraph "主线程 (Main Thread)"
        A["React UI 组件"] --> B["WebRTC 摄像头管理"]
        B --> C["WebCodecs 帧解码"]
        C --> D["帧数据传输 (Transferable Objects)"]
        E["Canvas 合成渲染"] --> F["预览显示"]
        E --> G["MediaRecorder 录制"]
        H["状态管理 (Zustand)"] --> A
        H --> I["设置参数管理"]
    end

    subgraph "Web Worker (Segmentation Worker)"
        D --> J["消息队列"]
        J --> K["TensorFlow.js 模型加载"]
        K --> L["BodyPix / MediaPipe 分割推理"]
        L --> M["掩码后处理 (平滑、阈值)"]
        M --> N["分割结果回传"]
    end

    subgraph "外部资源"
        O["摄像头设备"] --> B
        P["用户本地文件"] --> Q["背景图片/视频加载"]
        Q --> E
        R["CDN 模型文件"] --> K
        S["用户下载"] --> G
    end

    N --> E

    style "主线程 (Main Thread)" fill:#0F172A,stroke:#06B6D4,stroke-width:2px,color:#fff
    style "Web Worker (Segmentation Worker)" fill:#1E293B,stroke:#8B5CF6,stroke-width:2px,color:#fff
    style "外部资源" fill:#334155,stroke:#10B981,stroke-width:2px,color:#fff
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript + Vite@5
- **状态管理**: Zustand
- **样式方案**: TailwindCSS@3 + CSS Variables
- **图标库**: lucide-react
- **视频处理**:
  - WebRTC (`navigator.mediaDevices.getUserMedia`) - 摄像头流获取
  - WebCodecs API (`VideoDecoder`) - 视频帧硬件加速解码
  - Canvas 2D API - 实时图像合成
- **AI 分割**:
  - TensorFlow.js (`@tensorflow/tfjs`) - 机器学习推理引擎
  - `@tensorflow-models/body-pix` - 人像分割模型
  - 备选: `@mediapipe/selfie_segmentation` - 更轻量的分割方案
- **性能优化**:
  - Web Worker - 模型推理与分割处理完全在Worker线程
  - `Transferable Objects` (`ArrayBuffer` / `ImageBitmap`) - 零拷贝数据传输
  - `OffscreenCanvas` - Worker端可选的离屏渲染
- **录制功能**: MediaRecorder API - 录制Canvas输出流
- **初始化工具**: vite-init

## 3. 核心目录结构

```
src/
├── components/
│   ├── VideoPreview.tsx        # 视频预览组件
│   ├── ControlPanel.tsx        # 控制面板
│   ├── BackgroundSelector.tsx  # 背景选择器
│   ├── SettingsModal.tsx       # 设置弹窗
│   └── StatusBar.tsx           # 状态栏
├── hooks/
│   ├── useCameraStream.ts      # WebRTC摄像头管理
│   ├── useWebCodecsDecoder.ts  # WebCodecs帧解码
│   ├── useSegmentationWorker.ts# Worker通信管理
│   ├── useCanvasComposer.ts    # Canvas合成逻辑
│   └── useMediaRecorder.ts     # 录制功能
├── workers/
│   └── segmentation.worker.ts  # 分割Web Worker
├── utils/
│   ├── videoUtils.ts           # 视频处理工具
│   ├── canvasUtils.ts          # Canvas操作工具
│   └── modelUtils.ts           # 模型相关工具
├── store/
│   └── useAppStore.ts          # Zustand全局状态
├── types/
│   └── index.ts                # 类型定义
├── App.tsx                     # 主应用组件
└── main.tsx                    # 入口文件
```

## 4. 关键技术实现

### 4.1 帧处理流水线

| 阶段 | 线程 | 技术 | 数据格式 | 目标 |
|------|------|------|----------|------|
| 采集 | 主线程 | WebRTC | `MediaStream` | 获取摄像头原始视频流 |
| 解码 | 主线程 | WebCodecs `VideoDecoder` | `VideoFrame` | 硬解码获取原始帧数据 |
| 传输 | 跨线程 | Transferable Objects | `ArrayBuffer` + metadata | 零拷贝发送到Worker |
| 分割 | Worker | TensorFlow.js + BodyPix | `Tensor` + `ImageData` | 生成人像分割掩码 |
| 后处理 | Worker | Canvas 2D / TF.js ops | `Uint8ClampedArray` | 掩码平滑、阈值处理 |
| 回传 | 跨线程 | Transferable Objects | `ArrayBuffer` | 零拷贝回传掩码 |
| 合成 | 主线程 | Canvas 2D API | `ImageBitmap` + Canvas | 背景替换、alpha混合 |
| 输出 | 主线程 | Canvas + MediaRecorder | `MediaStream` | 预览 + 录制 |

### 4.2 Web Worker 消息协议

```typescript
// Worker 消息类型
type WorkerMessage =
  | { type: 'LOAD_MODEL'; config: ModelConfig }
  | { type: 'PROCESS_FRAME'; frame: FrameData; transfer: Transferable[] }
  | { type: 'UPDATE_CONFIG'; config: SegmentationConfig }
  | { type: 'UNLOAD_MODEL' };

// 主线程消息类型
type MainThreadMessage =
  | { type: 'MODEL_LOADED' }
  | { type: 'MODEL_LOAD_ERROR'; error: string }
  | { type: 'FRAME_PROCESSED'; mask: MaskData; transfer: Transferable[] }
  | { type: 'PROCESS_ERROR'; error: string }
  | { type: 'FPS_UPDATE'; fps: number };
```

### 4.3 性能优化策略

1. **帧跳过机制**: 根据Worker负载动态调整处理帧率，保持UI流畅
2. **内存池复用**: 预分配`ArrayBuffer`池，避免频繁GC
3. **分辨率降级**: 在性能不足时自动降低分割处理分辨率
4. **WebGL 加速**: TensorFlow.js使用WebGL后端加速推理
5. **节流控制**: 维持目标FPS（默认30fps），避免过度处理

### 4.4 数据模型定义

```typescript
// 应用配置
interface AppConfig {
  camera: {
    resolution: '720p' | '1080p' | '480p';
    frameRate: number;
    facingMode: 'user' | 'environment';
  };
  segmentation: {
    model: 'bodypix' | 'mediapipe';
    accuracy: 'low' | 'medium' | 'high';
    edgeSmoothing: number; // 0-10
    foregroundThreshold: number; // 0-1
  };
  recording: {
    format: 'webm' | 'mp4';
    bitrate: number;
    includeAudio: boolean;
  };
}

// 背景类型
type BackgroundType = 'image' | 'video' | 'blur' | 'transparent' | 'color';

interface Background {
  id: string;
  type: BackgroundType;
  source: string | HTMLImageElement | HTMLVideoElement;
  thumbnail?: string;
  blurAmount?: number;
  color?: string;
}

// 帧数据
interface FrameData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
  format: 'RGBA' | 'RGB';
}

// 分割掩码
interface MaskData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  timestamp: number;
}
```

## 5. 依赖清单

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.17.0",
    "@tensorflow-models/body-pix": "^2.2.1",
    "@mediapipe/selfie_segmentation": "^0.1.1675465747",
    "lucide-react": "^0.344.0",
    "zustand": "^4.5.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@types/dom-mediacapture-record": "^1.0.19",
    "@types/dom-webcodecs": "^0.1.11",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}
```

## 6. 路由定义

| 路由 | 页面 | 组件 | 功能 |
|------|------|------|------|
| `/` | 主页 | `VideoPreview` + `ControlPanel` + `BackgroundSelector` | 主应用界面，实时预览与操作 |

## 7. 浏览器兼容性

- Chrome/Edge 94+ (WebCodecs 完整支持)
- Firefox 113+ (WebCodecs 部分支持)
- Safari 16.4+ (WebCodecs 实验性支持)
- 功能降级: 不支持WebCodecs时回退到`CanvasRenderingContext2D.drawImage` + `getImageData`
