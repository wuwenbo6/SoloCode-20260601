# IoT 智能家居控制系统

基于 FastAPI + MQTT + Vue3 的智能家居物联网系统，包含设备模拟、实时监控、规则引擎和历史数据图表。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vue3)                       │
│  • 实时温度显示                                              │
│  • 温度历史图表 (Chart.js)                                   │
│  • 空调控制面板 (开关 + 温度调节)                             │
│  • 灯光控制面板 (开关 + 亮度调节)                             │
│  • 自动化规则管理                                            │
│  • WebSocket 实时更新                                        │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  • REST API 端点                                             │
│  • WebSocket 实时推送                                        │
│  • MQTT 订阅/发布                                            │
│  • 规则引擎 (APScheduler 每分钟扫描)                          │
│  • PostgreSQL 数据持久化                                     │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ▼                            ▼
┌──────────────────────┐     ┌──────────────────────────┐
│  MQTT Broker         │     │  PostgreSQL              │
│  (Eclipse Mosquitto) │     │  • 温度历史数据          │
│                      │     │  • 设备状态              │
│  Topics:             │     │  • 自动化规则            │
│  • sensor/temp       │     │                          │
│  • ac/status         │     └──────────────────────────┘
│  • ac/control        │
│  • light/status      │
│  • light/control     │
└───────────┬──────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Device Simulators                               │
│  • 温度传感器 (每5秒随机生成 20-40°C)                        │
│  • 空调 (开关 + 目标温度)                                    │
│  • 灯光 (开关 + 亮度 0-100)                                  │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
sp16/
├── backend/
│   ├── app/
│   │   ├── core/              # 配置和数据库
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/            # SQLAlchemy 模型
│   │   │   ├── device.py
│   │   │   └── rule.py
│   │   ├── schemas/           # Pydantic 模式
│   │   │   ├── device.py
│   │   │   └── rule.py
│   │   ├── crud/              # 数据库操作
│   │   │   ├── device.py
│   │   │   └── rule.py
│   │   ├── mqtt/              # MQTT 客户端和订阅
│   │   │   ├── client.py
│   │   │   └── subscriber.py
│   │   ├── devices/           # 设备模拟器
│   │   │   └── simulator.py
│   │   ├── rules/             # 规则引擎
│   │   │   └── engine.py
│   │   ├── routers/           # API 路由
│   │   │   ├── devices.py
│   │   │   └── rules.py
│   │   ├── websocket/         # WebSocket 管理
│   │   │   └── manager.py
│   │   └── main.py            # FastAPI 应用入口
│   ├── Dockerfile
│   ├── Dockerfile.simulator
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TemperatureDisplay.vue
│   │   │   ├── TemperatureChart.vue
│   │   │   ├── ACControl.vue
│   │   │   ├── LightControl.vue
│   │   │   └── RulesManagement.vue
│   │   ├── stores/
│   │   │   └── iotStore.js    # Pinia 状态管理
│   │   ├── App.vue
│   │   └── main.js
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
├── mosquitto/
│   └── mosquitto.conf
├── docker-compose.yml
└── .env.example
```

## 核心功能

### 1. 设备模拟

| 设备 | 功能 | MQTT 主题 | 发布频率 |
|------|------|-----------|----------|
| 温度传感器 | 随机生成 20-40°C | `devices/sensor/temperature` | 每 5 秒 |
| 空调 | 开关 + 目标温度 | `devices/ac/status` | 每 10 秒 |
| 灯光 | 开关 + 亮度 0-100 | `devices/light/status` | 每 10 秒 |

### 2. 实时监控

- 当前温度实时显示（WebSocket 推送）
- 温度状态标签（寒冷/舒适/温暖/炎热）
- 温度历史曲线图（Chart.js）
- 设备状态实时同步

### 3. 手动控制

**空调控制：**
- 开/关切换
- 目标温度调节（16-30°C）
- 快捷温度按钮（22/24/26°C）

**灯光控制：**
- 开/关切换
- 亮度调节（0-100%）
- 快捷亮度按钮（25/50/75/100%）

### 4. 规则引擎

**条件类型：**
- **温度条件**：支持操作符 `>`, `>=`, `<`, `<=`, `==`, `!=`
  - 示例：温度 > 30°C
- **时间条件**：时间区间（支持跨夜）
  - 示例：22:00 - 06:00

**动作类型：**
- `ac_on` - 开启空调
- `ac_off` - 关闭空调
- `ac_set_temp` - 设置空调温度（需指定温度值）
- `light_on` - 开启灯光
- `light_off` - 关闭灯光
- `light_set_brightness` - 设置灯光亮度（需指定亮度值）

**规则评估：**
- 后台进程每分钟自动扫描一次
- 支持手动触发评估

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 启动所有服务
docker compose up -d

# 2. 查看服务状态
docker compose ps

# 3. 查看日志
docker compose logs -f backend
docker compose logs -f simulator
docker compose logs -f frontend

# 4. 停止服务
docker compose down
```

**访问地址：**
- 前端: http://localhost:8080
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs
- MQTT Broker: localhost:1883
- PostgreSQL: localhost:5432

### 方式二：本地开发

**后端：**
```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 需要本地启动 PostgreSQL 和 Mosquitto
# 然后运行
export POSTGRES_HOST=localhost
export MQTT_HOST=localhost
uvicorn app.main:app --reload

# 另一个终端运行设备模拟器
python -m app.devices.simulator
```

**前端：**
```bash
cd frontend

# 安装依赖
npm install --legacy-peer-deps

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## API 文档

### 设备相关

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/devices/temperature/current` | 获取当前温度 |
| GET | `/api/devices/temperature/history` | 获取温度历史（?hours=24） |
| GET | `/api/devices/status` | 获取所有设备状态 |
| GET | `/api/devices/status/{type}` | 获取指定设备状态 |
| POST | `/api/devices/ac/control` | 控制空调 |
| POST | `/api/devices/light/control` | 控制灯光 |

### 规则相关

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/rules` | 获取所有规则 |
| POST | `/api/rules` | 创建规则 |
| GET | `/api/rules/{id}` | 获取规则详情 |
| PUT | `/api/rules/{id}` | 更新规则 |
| DELETE | `/api/rules/{id}` | 删除规则 |
| POST | `/api/rules/evaluate` | 手动评估规则 |

### WebSocket

- 连接：`ws://localhost:8000/ws`
- 消息格式：
  ```json
  {
    "type": "temperature_update",
    "data": { "temperature": 25.5 }
  }
  ```
  ```json
  {
    "type": "device_update",
    "data": { "device_type": "ac", "is_on": true, "target_temperature": 24 }
  }
  ```

## MQTT 主题

| 主题 | 方向 | 说明 |
|------|------|------|
| `devices/sensor/temperature` | 设备 → 后端 | 温度传感器数据 |
| `devices/ac/status` | 设备 → 后端 | 空调状态 |
| `devices/light/status` | 设备 → 后端 | 灯光状态 |
| `devices/ac/control` | 后端 → 设备 | 空调控制指令 |
| `devices/light/control` | 后端 → 设备 | 灯光控制指令 |

## 数据库表

### temperature_history
- `id` (PK)
- `temperature` (float)
- `timestamp` (datetime)

### device_status
- `id` (PK)
- `device_type` (varchar, unique)
- `is_on` (boolean)
- `target_temperature` (float, nullable)
- `brightness` (int, nullable)
- `last_updated` (datetime)

### rules
- `id` (PK)
- `name` (varchar)
- `description` (varchar)
- `enabled` (boolean)
- `condition_type` (varchar)
- `condition_operator` (varchar)
- `condition_value` (float)
- `time_start` (varchar)
- `time_end` (varchar)
- `action_type` (varchar)
- `action_value` (float)
- `last_triggered` (datetime)
- `created_at` (datetime)

## 示例规则

### 规则1：高温自动开空调
```json
{
  "name": "高温开空调",
  "description": "温度超过30度自动开空调",
  "enabled": true,
  "condition_type": "temperature",
  "condition_operator": ">",
  "condition_value": 30,
  "action_type": "ac_set_temp",
  "action_value": 24
}
```

### 规则2：晚上自动关灯
```json
{
  "name": "晚上关灯",
  "description": "晚上11点后自动关灯",
  "enabled": true,
  "condition_type": "time",
  "time_start": "23:00",
  "time_end": "06:00",
  "action_type": "light_off"
}
```

### 规则3：低温自动关灯
```json
{
  "name": "低温关空调",
  "description": "温度低于22度自动关空调",
  "enabled": true,
  "condition_type": "temperature",
  "condition_operator": "<",
  "condition_value": 22,
  "action_type": "ac_off"
}
```

## 技术栈

**后端：**
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- PostgreSQL 15
- Paho MQTT 1.6.1
- APScheduler 3.10.4
- Pydantic 2.5.0

**前端：**
- Vue 3.4
- Pinia 2.1
- Element Plus 2.5
- Chart.js 4.4 + vue-chartjs 5.3
- Axios 1.6
- Vite 5.0

**中间件：**
- Eclipse Mosquitto 2.0.18
- Nginx (前端部署)

## 故障排除

### Docker 服务启动失败
```bash
# 查看详细日志
docker compose logs <service_name>

# 重建服务
docker compose up -d --build <service_name>

# 清理并重新启动
docker compose down -v
docker compose up -d
```

### MQTT 连接失败
- 确认 mosquitto 容器正在运行
- 检查端口 1883 是否被占用
- 查看 mosquitto 日志：`docker compose logs mosquitto`

### 数据库连接失败
- 确认 postgres 容器健康检查通过
- 检查环境变量配置是否正确
- 查看 backend 日志确认数据库连接信息

## 后端代码测试验证

✅ 所有模块导入测试通过  
✅ Pydantic 模式验证测试通过  
✅ 规则引擎条件评估逻辑测试通过  
✅ 温度传感器生成范围测试通过  
✅ 循环依赖问题已修复  
