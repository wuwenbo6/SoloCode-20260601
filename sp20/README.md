# 3D 虚拟展厅项目

基于 Three.js + React 的 3D 虚拟展厅应用，支持第一人称漫游、热点交互和自动路径导航。

## 功能特性

### 前端功能
- **3D 展厅场景**: 使用 Three.js 渲染虚拟展厅环境
- **第一人称控制**: WASD 移动，鼠标环顾四周
- **热点系统**: 点击热点弹出展品信息面板
- **信息面板**: 展示展品图片、名称、年代、来源和详细描述
- **小地图**: 右下角显示实时小地图，显示玩家位置和热点
- **自动导航**: 点击小地图任意位置，使用 A* 算法自动寻路
- **碰撞检测**: 防止玩家穿墙和超出边界

### 后端功能
- **RESTful API**: Express 服务器提供数据接口
- **数据存储**: JSON 文件存储展厅配置、展品、热点和导航网格数据
- **CRUD 操作**: 支持展品和热点的增删改查

## 技术栈

### 前端
- React 18
- Three.js
- @react-three/fiber
- @react-three/drei
- Vite
- Axios

### 后端
- Node.js
- Express
- CORS

## 项目结构

```
sp20/
├── client/                 # 前端项目
│   ├── src/
│   │   ├── components/     # React 组件
│   │   │   ├── App.jsx
│   │   │   ├── Scene.jsx
│   │   │   ├── FirstPersonControls.jsx
│   │   │   ├── ExhibitionHall.jsx
│   │   │   ├── Hotspot.jsx
│   │   │   ├── InfoPanel.jsx
│   │   │   └── MiniMap.jsx
│   │   ├── utils/          # 工具函数
│   │   │   ├── api.js
│   │   │   └── pathfinding.js
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── server/                 # 后端项目
    ├── data/               # 数据文件
    │   ├── config.json
    │   ├── exhibits.json
    │   ├── hotspots.json
    │   └── navmesh.json
    ├── server.js
    └── package.json
```

## 安装和运行

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 启动后端服务器

```bash
cd server
npm start
# 服务器运行在 http://localhost:5001
```

### 3. 启动前端开发服务器

```bash
cd client
npm run dev
# 前端运行在 http://localhost:3000
```

### 4. 访问应用

打开浏览器访问 http://localhost:3000

## 操作说明

- **点击画面**: 锁定鼠标进行第一人称控制
- **W/A/S/D**: 前后左右移动
- **鼠标移动**: 环顾四周
- **ESC**: 解锁鼠标
- **点击热点**: 查看展品详情
- **点击小地图**: 自动导航到目标位置

## API 接口

### 展厅配置
- `GET /api/config` - 获取展厅配置
- `PUT /api/config` - 更新展厅配置

### 展品
- `GET /api/exhibits` - 获取所有展品
- `POST /api/exhibits` - 创建展品
- `PUT /api/exhibits/:id` - 更新展品
- `DELETE /api/exhibits/:id` - 删除展品

### 热点
- `GET /api/hotspots` - 获取所有热点
- `POST /api/hotspots` - 创建热点
- `DELETE /api/hotspots/:id` - 删除热点

### 导航网格
- `GET /api/navmesh` - 获取导航网格
- `PUT /api/navmesh` - 更新导航网格

## 数据格式

### 展品 (Exhibit)
```json
{
  "id": 1,
  "name": "展品名称",
  "description": "详细描述",
  "image": "图片URL",
  "year": "年代",
  "origin": "来源地"
}
```

### 热点 (Hotspot)
```json
{
  "id": 1,
  "position": { "x": 0, "y": 1.5, "z": 0 },
  "exhibitId": 1,
  "label": "标签"
}
```

### 导航网格 (NavMesh)
```json
{
  "nodes": [
    { "id": 0, "x": 0, "z": 0 }
  ],
  "edges": [
    [0, 1], [1, 2]
  ]
}
```

## 路径规划算法

项目使用 A* (A-Star) 寻路算法，基于预定义的导航网格节点计算最短路径。路径计算后会进行平滑处理，使移动更加自然。

## 自定义扩展

### 添加自定义 glTF 模型
1. 将 .glb 或 .gltf 文件放入 `client/public/models/` 目录
2. 修改 `server/data/config.json` 中的 `modelUrl` 字段
3. 更新 `ExhibitionHall.jsx` 组件以加载自定义模型

### 添加新展品
1. 使用 API `POST /api/exhibits` 创建展品
2. 使用 API `POST /api/hotspots` 创建对应热点
3. 或直接编辑 `server/data/` 下的 JSON 文件

### 自定义导航网格
编辑 `server/data/navmesh.json` 添加更多节点和连接边，以支持更复杂的路径规划。
