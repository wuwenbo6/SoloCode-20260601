# 🎮 Gamepad Controller - 游戏手柄控制器

一个功能完整的游戏手柄控制器应用，使用 WebHID API 连接 USB 游戏手柄，支持按键映射、宏编程和云端同步。

## ✨ 功能特性

### 🔌 手柄连接与输入监控
- 使用 WebHID API 连接任意 USB 游戏手柄
- 实时读取输入报告（摇杆轴、按钮状态）
- 可视化显示摇杆位置和按钮状态
- 显示原始 HID 数据十六进制值

### 🔗 按键映射
- 将手柄按钮映射到键盘按键
- 支持组合键映射（如 Ctrl+C、Shift+Alt+A）
- 本地存储配置，即时生效

### ⏺️ 宏编程
- 录制手柄操作序列（按键 + 时间间隔）
- 保存、编辑和管理宏
- 播放录制的宏操作

### 📳 震动控制
- 调用 HID 输出报告触发手柄震动
- 可调节震动强度（弱/强马达）
- 可调节震动持续时间

### ☁️ 云端同步
- 用户注册/登录系统
- 将配置方案上传到云端
- 跨设备同步配置
- 支持设置默认配置

## 🛠️ 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **SQLite** - 数据库
- **JWT** - 用户认证
- **bcryptjs** - 密码加密

### 前端
- **React 18** - UI 框架
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Axios** - HTTP 客户端
- **Tailwind CSS** - 样式框架
- **WebHID API** - 手柄通信

## 📦 快速开始

### 环境要求
- Node.js >= 16.x
- Chrome / Edge 浏览器（支持 WebHID API）

### 安装与运行

#### 1. 启动后端服务
```bash
cd backend
npm install
npm start
```
后端服务将在 `http://localhost:5000` 启动

#### 2. 启动前端服务
```bash
cd frontend
npm install
npm run dev
```
前端服务将在 `http://localhost:3000` 启动

### 使用说明

1. **注册账号**：访问 `http://localhost:3000/register` 创建账号
2. **连接手柄**：
   - 点击「连接手柄」按钮
   - 在浏览器弹出的设备选择框中选择您的游戏手柄
   - 点击「连接」
3. **开始使用**：
   - 在「输入监控」查看实时手柄输入
   - 在「按键映射」配置按钮映射
   - 在「宏编程」录制操作序列
   - 在「云端同步」保存配置到服务器

## 📁 项目结构

```
sp31/
├── backend/                 # 后端服务
│   ├── database/           # 数据库相关
│   │   └── db.js           # SQLite 数据库初始化
│   ├── middleware/         # 中间件
│   │   └── auth.js         # JWT 认证中间件
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 用户认证 API
│   │   ├── configs.js      # 配置管理 API
│   │   └── macros.js       # 宏管理 API
│   ├── .env                # 环境变量
│   ├── package.json        # 依赖配置
│   └── server.js           # 服务器入口
└── frontend/               # 前端应用
    ├── src/
    │   ├── contexts/       # React Context
    │   │   ├── AuthContext.jsx    # 用户认证状态
    │   │   └── GamepadContext.jsx # 手柄状态管理
    │   ├── pages/          # 页面组件
    │   │   ├── Login.jsx          # 登录页
    │   │   ├── Register.jsx       # 注册页
    │   │   ├── Dashboard.jsx      # 仪表盘
    │   │   ├── GamepadMonitor.jsx # 输入监控
    │   │   ├── MappingConfig.jsx  # 按键映射
    │   │   ├── MacroEditor.jsx    # 宏编程
    │   │   └── SyncSettings.jsx   # 云端同步
    │   ├── components/     # 通用组件
    │   │   └── Navbar.jsx         # 导航栏
    │   ├── App.jsx         # 应用主组件
    │   ├── main.jsx        # 应用入口
    │   └── index.css       # 全局样式
    ├── index.html          # HTML 模板
    ├── vite.config.js      # Vite 配置
    ├── tailwind.config.js  # Tailwind 配置
    └── package.json        # 依赖配置
```

## 🔌 API 接口文档

### 用户认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 配置管理
- `GET /api/configs` - 获取配置列表
- `GET /api/configs/:id` - 获取指定配置
- `POST /api/configs` - 创建配置
- `PUT /api/configs/:id` - 更新配置
- `DELETE /api/configs/:id` - 删除配置
- `GET /api/configs/sync/default` - 获取默认配置

### 宏管理
- `GET /api/macros` - 获取宏列表
- `GET /api/macros/:id` - 获取指定宏
- `POST /api/macros` - 创建宏
- `PUT /api/macros/:id` - 更新宏
- `DELETE /api/macros/:id` - 删除宏

## ⚠️ 注意事项

1. **浏览器支持**：WebHID API 目前仅支持 Chrome 和 Edge 浏览器
2. **HTTPS 要求**：生产环境需要 HTTPS（localhost 除外）
3. **手柄兼容性**：不同手柄的 HID 报告格式可能不同，可能需要根据具体手柄调整解析逻辑
4. **安全警告**：演示用的 JWT_SECRET 请在生产环境中替换为安全的随机字符串

## 🚀 未来改进

- [ ] 支持更多类型的游戏手柄
- [ ] 实现真正的键盘输入模拟（需要浏览器扩展或原生应用）
- [ ] 支持蓝牙手柄
- [ ] 添加更多的宏编辑功能
- [ ] 配置分享功能

## 📄 许可证

MIT License
