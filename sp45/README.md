# 3D Printer Control System

一个完整的3D打印机监控与控制系统，后端使用Go语言，前端使用React + TypeScript。

## 功能特性

### 核心功能
- **WebUSB连接**：通过WebUSB协议直接连接3D打印机
- **Marlin固件模拟器**：内置Marlin固件模拟器，支持60+ G-code命令
- **实时状态监控**：喷嘴温度、热床温度、Z轴高度、打印进度
- **温度曲线图**：实时显示温度变化曲线
- **远程控制**：暂停/恢复/停止打印，移动X/Y/Z轴
- **固件升级**：支持HEX文件上传，通过Bootloader协议升级
- **视频监控**：WebSocket实时视频流传输
- **打印历史**：SQLite数据库存储打印历史记录

### 技术栈
**后端**
- Go 1.21+
- Gin Web框架
- GORM + SQLite
- Gorilla WebSocket
- Google UUID

**前端**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts (图表)
- Lucide React (图标)
- Axios (HTTP客户端)

## 项目结构

```
sp45/
├── backend/                    # Go后端
│   ├── cmd/
│   │   └── server/
│   │       └── main.go        # 应用入口
│   ├── internal/
│   │   ├── api/               # API处理器
│   │   ├── database/          # 数据库层
│   │   ├── models/            # 数据模型
│   │   ├── printer/           # 打印机相关
│   │   │   ├── simulator.go   # Marlin固件模拟器
│   │   │   ├── manager.go     # 打印机管理器
│   │   │   └── bootloader.go  # 固件升级协议
│   │   └── transport/         # WebTransport视频服务器
│   ├── pkg/
│   │   └── gcode/             # G-code解析器
│   ├── go.mod
│   └── server                 # 编译后的二进制
└── frontend/                   # React前端
    ├── src/
    │   ├── components/        # UI组件
    │   ├── hooks/             # 自定义Hooks
    │   ├── services/          # API服务
    │   ├── types/             # TypeScript类型
    │   ├── utils/             # 工具函数
    │   ├── App.tsx            # 主应用
    │   ├── main.tsx           # 入口文件
    │   └── index.css          # 全局样式
    └── package.json
```

## 快速开始

### 启动后端服务

```bash
cd backend

# 安装依赖
go mod download

# 构建
go build -o server ./cmd/server

# 运行
./server
```

后端服务将在 `http://localhost:8080` 启动。

### 启动前端开发服务器

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器将在 `http://localhost:5173` 启动。

### 生产构建

```bash
cd frontend
npm run build
```

## API 接口

### 状态接口
- `GET /api/status` - 获取打印机状态
- `GET /api/ws/status` - WebSocket实时状态推送

### 控制接口
- `POST /api/control/pause` - 暂停打印
- `POST /api/control/resume` - 恢复打印
- `POST /api/control/stop` - 停止打印
- `POST /api/control/move` - 移动轴
- `POST /api/control/home` - 回零
- `POST /api/control/temperature` - 设置温度

### 视频接口
- `GET /api/video/ws` - WebSocket视频流

### 固件接口
- `POST /api/firmware/upload` - 上传HEX文件
- `POST /api/firmware/start` - 开始升级
- `GET /api/firmware/progress` - 获取升级进度
- `POST /api/firmware/cancel` - 取消升级

### 历史记录接口
- `GET /api/history` - 获取打印历史（支持分页）
- `GET /api/history/:id` - 获取单条记录
- `DELETE /api/history/:id` - 删除记录

## WebSocket协议

### 状态推送 (ws://localhost:8080/api/ws/status)
服务器每500ms推送一次打印机状态：

```json
{
  "nozzleTemp": 215.5,
  "nozzleTarget": 220.0,
  "bedTemp": 60.2,
  "bedTarget": 60.0,
  "zHeight": 1.25,
  "progress": 35.5,
  "state": "printing",
  "fileName": "test.gcode",
  "printTime": 1234,
  "timeLeft": 2456
}
```

### 视频流 (ws://localhost:8080/api/video/ws)
二进制帧格式：
- 0-3字节: 宽度 (uint32, big-endian)
- 4-7字节: 高度 (uint32, big-endian)
- 8-11字节: 时间戳 (uint32, big-endian)
- 12+字节: RGB24像素数据 (width * height * 3)

## G-code支持

模拟器支持以下常用G-code命令：

**移动命令**: G0, G1, G2, G3, G4, G10, G11, G20, G21, G28, G90, G91, G92

**温度命令**: M104, M105, M106, M107, M109, M140, M141, M190, M302, M303

**控制命令**: M0, M1, M17, M18, M24, M25, M26, M27, M30, M82, M83, M84, M108, M110, M111, M112, M114, M115, M117, M118, M119, M120, M121, M122, M200, M201, M202, M203, M204, M205, M206, M211, M220, M221, M280, M300, M400, M410, M500, M501, M502, M503, M524, M999

## Bootloader固件升级

实现了标准的AVR Bootloader协议：
1. 解析Intel HEX格式文件
2. 按页写入Flash（默认128字节/页）
3. 校验和验证
4. 支持扩展地址记录

## 使用说明

### 1. 启动模拟模式
点击右上角连接面板中的"启动模拟器"按钮，系统将启动内置的Marlin固件模拟器。

### 2. 查看实时状态
在"打印控制"页面可以查看：
- 喷嘴和热床温度（实时曲线图）
- Z轴高度
- 打印进度
- 打印时间和剩余时间

### 3. 控制打印机
- **打印控制**：开始/暂停/恢复/停止打印
- **轴移动**：选择移动距离（0.1/1/10/50mm），点击方向按钮移动X/Y/Z轴
- **温度控制**：设置喷嘴和热床温度，支持PLA/ABS预设

### 4. 视频监控
点击视频监控组件中的"开始视频流"按钮查看实时视频。

### 5. 固件升级
1. 切换到"固件升级"标签页
2. 拖拽或选择HEX格式的固件文件
3. 点击"开始升级"
4. 等待升级完成（进度条显示升级进度）

### 6. 查看历史记录
切换到"历史记录"标签页查看所有打印任务记录，支持分页浏览和详情查看。

## WebUSB连接

### 系统要求
- Chrome/Edge 61+ 浏览器
- 打印机USB连接到电脑
- 正确的USB VID/PID

### 支持的设备
默认支持以下厂商ID：
- 0x2341 (Arduino)
- 0x1A86 (WCH)
- 0x0403 (FTDI)
- 0x10C4 (Silicon Labs)
- 0x2E8A (Raspberry Pi)

## 浏览器兼容性

| 功能 | Chrome | Edge | Firefox | Safari |
|------|--------|------|---------|--------|
| WebUSB | ✅ 61+ | ✅ 79+ | ❌ | ❌ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| Canvas 2D | ✅ | ✅ | ✅ | ✅ |

## 开发

### 添加新的G-code命令
在 `backend/internal/printer/simulator.go` 的 `commandHandlers` map中添加新的处理函数：

```go
sim.commandHandlers["GXXX"] = func(sim *MarlinSimulator, cmd *gcode.Command) string {
    // 处理逻辑
    return "ok"
}
```

### 前端API扩展
在 `frontend/src/services/api.ts` 中添加新的API调用：

```typescript
export const printerAPI = {
  // ... 现有方法
  newFeature: async (data: SomeType) => {
    const res = await axios.post('/api/control/new-feature', data);
    return res.data;
  }
};
```

## License

MIT
