# 配置管理服务 (Config Server)

基于 Go + Gin + Redis + etcd 的分布式配置管理系统。

## 功能特性

- **RESTful API**: 配置的增删改查
- **多格式支持**: JSON/YAML 格式输出
- **长轮询监听**: 30秒超时的长轮询机制
- **实时推送**: 基于 etcd watch 的配置变更实时推送
- **版本管理**: 保留最近10个版本，支持回滚
- **缓存加速**: Redis 缓存提升读取性能

## 技术栈

- **Go 1.25+**
- **Gin Web Framework**
- **etcd v3** - 配置存储和 watch 机制
- **Redis** - 缓存层

## 快速开始

### 1. 启动依赖服务

```bash
# 启动 etcd
docker run -d --name etcd -p 2379:2379 bitnami/etcd:latest

# 启动 Redis
docker run -d --name redis -p 6379:6379 redis:latest
```

### 2. 启动服务端

```bash
go run main.go
```

服务默认运行在 `http://localhost:8080`

### 3. 使用 Python SDK

```bash
cd client_sdk
pip install -r requirements.txt
python config_client.py
```

## API 文档

### 基础路径: `/api/v1`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/configs` | 创建配置 |
| GET | `/configs` | 列出所有配置 |
| GET | `/configs/:key` | 获取配置 |
| PUT | `/configs/:key` | 更新配置 |
| DELETE | `/configs/:key` | 删除配置 |
| GET | `/configs/:key/versions` | 获取版本历史 |
| POST | `/configs/:key/rollback` | 版本回滚 |
| GET | `/long-poll` | 长轮询监听 |
| GET | `/watch/:key` | SSE 实时推送 |

### API 示例

#### 创建配置
```bash
curl -X POST http://localhost:8080/api/v1/configs \
  -H "Content-Type: application/json" \
  -d '{
    "key": "app.settings",
    "value": {
      "debug": true,
      "port": 8000
    }
  }'
```

#### 获取配置 (JSON格式)
```bash
curl http://localhost:8080/api/v1/configs/app.settings
```

#### 获取配置 (YAML格式)
```bash
curl http://localhost:8080/api/v1/configs/app.settings?format=yaml
```

#### 长轮询监听配置变更
```bash
curl "http://localhost:8080/api/v1/long-poll?key=app.settings&current_version=1&timeout=30"
```

#### 版本回滚
```bash
curl -X POST http://localhost:8080/api/v1/configs/app.settings/rollback \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

## Python SDK 使用示例

```python
from config_client import ConfigClient, ConfigWatcher

# 初始化客户端
client = ConfigClient(base_url="http://localhost:8080/api/v1")

# 创建配置
client.create_config("app.settings", {
    "debug": True,
    "port": 8000
})

# 获取配置
config = client.get_config("app.settings")

# 监听配置变更 (长轮询方式)
def on_change(new_config):
    print(f"Config changed: {new_config}")

watcher = ConfigWatcher(client, "app.settings")
watcher.add_callback(on_change)
watcher.start()
```

## 项目结构

```
.
├── main.go                 # 主入口
├── internal/
│   ├── config/            # 配置定义
│   ├── etcd/              # etcd 存储层
│   ├── redis/             # Redis 缓存层
│   ├── handler/           # HTTP 处理器
│   └── model/             # 数据模型
├── pkg/
│   └── utils/             # 工具函数
└── client_sdk/            # Python 客户端 SDK
    ├── config_client.py
    └── requirements.txt
```

## 架构说明

### 数据存储结构 (etcd)

```
/configs/data/{key}          # 当前配置
/configs/versions/{key}/{version}  # 历史版本
```

### 缓存策略

- 读取: 先查 Redis，命中直接返回，未命中查 etcd 并缓存
- 写入/更新: 更新 etcd，删除 Redis 缓存
- 缓存 TTL: 5分钟

### 长轮询流程

1. 客户端发送请求，携带当前版本号
2. 服务端比较版本，如不同立即返回新配置
3. 如版本相同，订阅 etcd watch
4. 30秒内有变更则推送，超时返回当前版本
