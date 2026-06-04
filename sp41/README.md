# 智能手环健康仪表盘

一个完整的智能手环数据监控系统，支持实时数据采集、存储、分析和可视化展示。

## 功能特性

### 设备连接
- **WebUSB**: 通过USB接口直接连接智能手环
- **WebHID**: 通过HID协议连接智能手环
- **模拟模式**: 内置数据模拟器，方便测试和演示

### 数据采集
- 步数统计
- 心率监测
- 睡眠阶段分析（清醒、浅睡、深睡、REM）

### 数据可视化
- 最近7天步数趋势图（折线图）
- 心率区间分布图（柱状图）
- 睡眠阶段饼图

### 运动分析
- 基于年龄和体重的卡路里消耗预测
- 每日步数目标完成度追踪
- 目标达成率统计

### 数据导出
- 导出为CSV格式
- 生成PDF健康报告

## 技术栈

### 后端
- Node.js + Express
- InfluxDB 时序数据库
- PDFKit (PDF生成)
- json2csv (CSV导出)

### 前端
- React 18
- Recharts (图表库)
- Axios (HTTP客户端)
- WebUSB / WebHID API

## 项目结构

```
sp41/
├── backend/                 # 后端服务
│   ├── server.js           # 服务器入口
│   ├── package.json        # 依赖配置
│   ├── .env.example        # 环境变量示例
│   ├── config/
│   │   └── influxdb.js     # InfluxDB配置
│   ├── routes/
│   │   ├── data.js         # 数据API
│   │   ├── analysis.js     # 分析API
│   │   └── export.js       # 导出API
│   └── services/
│       ├── dataService.js  # 数据服务
│       └── exportService.js # 导出服务
└── frontend/               # 前端应用
    ├── package.json        # 依赖配置
    ├── public/
    │   └── index.html      # HTML入口
    └── src/
        ├── index.js        # React入口
        ├── App.js          # 主应用组件
        ├── styles.css      # 样式文件
        ├── api.js          # API客户端
        ├── services/
        │   └── bandService.js # 手环服务
        └── components/
            ├── BandConnector.js
            ├── RealTimeData.js
            ├── StepsTrendChart.js
            ├── HeartRateZonesChart.js
            ├── SleepPieChart.js
            ├── AnalysisPanel.js
            └── ExportPanel.js
```

## 快速开始

### 1. 启动InfluxDB

使用Docker快速启动InfluxDB：

```bash
docker-compose up -d
```

或者手动安装InfluxDB，然后访问 http://localhost:8086 进行初始配置。

### 2. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置InfluxDB连接信息
```

### 3. 安装后端依赖并启动

```bash
cd backend
npm install
npm start
```

后端服务将运行在 http://localhost:3001

### 4. 安装前端依赖并启动

```bash
cd frontend
npm install
npm start
```

前端应用将运行在 http://localhost:3000

## API 接口

### 数据接口
- `POST /api/data/steps` - 提交步数数据
- `POST /api/data/heartrate` - 提交心率数据
- `POST /api/data/sleep` - 提交睡眠数据
- `POST /api/data/batch` - 批量提交数据
- `GET /api/data/steps` - 查询步数数据
- `GET /api/data/heartrate` - 查询心率数据
- `GET /api/data/sleep` - 查询睡眠数据
- `GET /api/data/latest` - 获取最新数据

### 分析接口
- `POST /api/analysis/calories` - 计算卡路里消耗
- `POST /api/analysis/goal` - 目标完成度分析
- `GET /api/analysis/heartrate/zones` - 心率区间分布

### 导出接口
- `GET /api/export/csv` - 导出CSV
- `POST /api/export/pdf` - 生成PDF报告

## 使用说明

### 连接设备

1. 点击"模拟设备"按钮进入模拟模式（推荐首次使用）
2. 或使用WebUSB/WebHID连接真实手环设备
3. 连接成功后，数据将自动同步到后端

### 数据过滤设置 ✨

在连接设备前可以设置：
- **启用数据过滤**: 开启卡尔曼滤波和异常剔除
- **模拟异常数据**: 用于测试过滤功能（会生成300bpm等异常值）

### 历史数据同步 ✨

1. 在"历史数据同步"区域选择同步天数
2. 点击"同步7天"或"同步30天"
3. 系统将分页读取数据（每页7天），自动重试失败请求
4. 实时查看同步进度

### 生成模拟数据

如果不想使用设备连接模式，可以：
1. 点击首页的"生成模拟数据"按钮
2. 系统会自动生成最近7天的模拟数据
3. 所有图表和分析功能将立即生效

### 查看分析

1. 在左侧"运动分析"面板设置个人资料（年龄、体重、身高等）
2. 设置每日步数目标
3. 系统会自动计算：
   - 卡路里消耗
   - 目标完成进度
   - 达成率统计

### 导出数据

1. 在"数据导出"面板选择时间范围
2. 点击"导出CSV"下载原始数据
3. 点击"导出PDF报告"生成完整的健康分析报告（支持中文）

## 注意事项

1. **WebUSB/WebHID支持**: 需要使用支持这些API的浏览器（Chrome、Edge等）
2. **HTTPS要求**: 在生产环境中，WebUSB/WebHID需要HTTPS连接
3. **InfluxDB**: 确保InfluxDB服务正常运行并正确配置
4. **模拟数据**: 模拟模式下的数据每5秒更新一次
5. **PDF中文字体**: 如需PDF中文显示，请先安装Noto Sans SC字体
6. **数据过滤**: 心率数据正常范围为30-220 bpm，超出范围会被自动过滤
7. **分页同步**: 30天数据同步分4页完成，每页7天，避免超时

## 卡路里计算公式

系统使用以下公式估算卡路里消耗：

```
距离(km) = 步数 / 1300步/公里
时间(h) = 距离 / 5 km/h
卡路里(kcal) = MET * 体重(kg) * 时间(h)

其中 MET = 5（步行的代谢当量）
```

## 心率区间

| 区间 | 心率范围 | 说明 |
|------|---------|------|
| 休息 | < 60 bpm | 静息状态 |
| 轻度活动 | 60-100 bpm | 日常活动 |
| 中等强度 | 100-140 bpm | 有氧运动 |
| 高强度 | 140-170 bpm | 剧烈运动 |
| 极限 | > 170 bpm | 最大心率区间 |

## 许可证

MIT License
