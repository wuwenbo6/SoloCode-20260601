# 推荐系统微服务 (Go + gRPC)

基于Go和gRPC构建的分布式推荐系统微服务架构，包含用户服务、商品服务、推荐服务和AB测试服务。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        gRPC Gateway (8080)                  │
│                   RESTful API + HTTP                        │
└─────────────┬───────────────────┬───────────────────┬───────┘
              │                   │                   │
┌─────────────▼──────┐ ┌─────────▼─────────┐ ┌──────▼──────────┐
│  User Service      │ │ Product Service   │ │ AB Test Service │
│  (gRPC :50051)     │ │ (gRPC :50052)     │ │ (gRPC :50054)   │
└─────────────┬──────┘ └─────────┬─────────┘ └──────┬──────────┘
              │                   │                   │
└─────────────▼───────────────────▼───────────────────▼───────┐
│              Recommendation Service (gRPC :50053)            │
│        - 协同过滤推荐算法 (实验组)                            │
│        - 热门商品推荐算法 (对照组)                            │
│        - AB测试路由                                          │
└───────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 用户服务 (User Service)
- 用户CRUD操作
- 浏览历史记录
- 本地LRU缓存 + Redis二级缓存

### 2. 商品服务 (Product Service)
- 商品CRUD操作
- 热门分计算（浏览量 + 时间衰减）
- 热门商品列表

### 3. 推荐服务 (Recommendation Service)
- **基于协同过滤的推荐**：基于用户历史浏览记录
- **基于热门分的推荐**：按商品热度排序
- AB测试路由：根据用户分桶自动选择算法

### 4. AB测试服务 (AB Test Service)
- 用户分桶（SHA256哈希 + user_id）
- 实验配置管理
- 实时点击率(CTR)统计
- Redis缓存 + MySQL持久化

### 5. 多级缓存
- 一级缓存：本地LRU缓存（内存）
- 二级缓存：Redis（分布式）
- 缓存更新广播：Redis Pub/Sub

### 6. gRPC Gateway
- 自动将gRPC转换为RESTful API
- CORS支持
- 统一HTTP入口

## 技术栈

- **语言**: Go 1.21+
- **RPC框架**: gRPC
- **API Gateway**: grpc-gateway
- **数据库**: MySQL 8.0
- **缓存**: Redis 7 + LRU
- **ORM**: GORM
- **容器化**: Docker + Docker Compose

## 快速开始

### 前置要求

- Docker & Docker Compose
- Go 1.21+
- protoc (Protocol Buffers 编译器)

### 1. 启动基础设施

```bash
docker-compose up -d
```

等待MySQL和Redis启动完成：
```bash
docker-compose ps
```

### 2. 生成gRPC代码

```bash
./scripts/gen-proto.sh
```

### 3. 下载依赖

```bash
go mod tidy
go mod download
```

### 4. 启动所有服务

```bash
./scripts/start-all.sh
```

或者分别启动：
```bash
# 终端1 - 用户服务
go run ./cmd/user

# 终端2 - 商品服务
go run ./cmd/product

# 终端3 - AB测试服务
go run ./cmd/abtest

# 终端4 - 推荐服务
go run ./cmd/recommendation

# 终端5 - API网关
go run ./cmd/gateway
```

## API 示例

### REST API (通过Gateway :8080)

#### 获取推荐列表
```bash
curl "http://localhost:8080/v1/recommendations/1?limit=10"
```

响应示例：
```json
{
  "products": [...],
  "algorithm_used": "collaborative",
  "experiment_group": "Experiment Group",
  "request_id": "1"
}
```

#### 记录点击
```bash
curl -X POST "http://localhost:8080/v1/recommendations/1/click" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "request_id": 1}'
```

#### 获取热门商品
```bash
curl "http://localhost:8080/v1/products/hot?limit=10"
```

#### 获取用户信息
```bash
curl "http://localhost:8080/v1/users/1"
```

#### 创建用户
```bash
curl -X POST "http://localhost:8080/v1/users" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com"}'
```

#### 查看AB测试统计
```bash
curl "http://localhost:8080/v1/abtest/experiments/recommendation_algo/stats"
```

### gRPC 调用

使用grpcurl或其他gRPC客户端：

```bash
# 获取推荐
grpcurl -d '{"user_id": 1, "limit": 10}' \
  localhost:50053 recommendation.RecommendationService/GetRecommendations
```

## 项目结构

```
.
├── api/proto/              # Protocol Buffers 定义
│   ├── user.proto         # 用户服务
│   ├── product.proto      # 商品服务
│   ├── recommendation.proto # 推荐服务
│   ├── abtest.proto       # AB测试服务
│   └── broadcast.proto    # 缓存广播
├── cmd/                   # 服务入口
│   ├── user/             # 用户服务
│   ├── product/          # 商品服务
│   ├── recommendation/   # 推荐服务
│   ├── abtest/           # AB测试服务
│   └── gateway/          # gRPC Gateway
├── internal/              # 业务逻辑
│   ├── user/
│   ├── product/
│   ├── recommendation/
│   └── abtest/
├── pkg/                   # 公共库
│   ├── cache/            # Redis客户端
│   ├── lru/              # LRU本地缓存
│   ├── database/         # MySQL连接
│   ├── broadcast/        # 缓存广播
│   └── config/           # 配置
├── scripts/              # 脚本
│   ├── gen-proto.sh      # 生成gRPC代码
│   └── start-all.sh      # 启动所有服务
├── sql/                  # SQL初始化脚本
└── docker-compose.yml    # 基础设施配置
```

## 推荐算法说明

### 1. 协同过滤算法 (Collaborative Filtering)

简化版本的基于物品的协同过滤：
- 获取用户历史浏览记录
- 计算商品间的相似度
- 推荐与用户浏览过的商品最相似的商品
- 排除用户已浏览过的商品

### 2. 热门商品推荐 (Hot Score)

基于热度分排序：
- `hot_score = view_count * decay_factor`
- `decay_factor = 0.95^(days_since_creation)`
- 时间衰减因子确保新商品有机会被推荐

## AB测试流程

1. **用户分桶**：`hash(user_id + experiment_id) % 100`
2. **流量分配**：控制组50%，实验组50%
3. **算法路由**：
   - 控制组：使用热门商品推荐
   - 实验组：使用协同过滤推荐
4. **数据收集**：记录曝光(impression)和点击(click)
5. **指标计算**：CTR = clicks / impressions

## 缓存策略

| 层级 | 实现 | TTL | 更新机制 |
|------|------|-----|----------|
| L1 | 本地LRU缓存 | 5分钟 | gRPC广播失效 |
| L2 | Redis | 1-5分钟 | 写时失效 + 广播 |

缓存更新流程：
1. 数据写入时删除本地缓存
2. 通过Redis Pub/Sub广播缓存失效消息
3. 所有服务接收消息并删除本地缓存

## 配置

通过环境变量配置：

```bash
# MySQL
MYSQL_DSN="root:password@tcp(127.0.0.1:3306)/recommendation?charset=utf8mb4&parseTime=True&loc=Local"

# Redis
REDIS_ADDR="127.0.0.1:6379"
REDIS_PASSWORD=""
REDIS_DB=0

# 服务端口
USER_SERVICE_PORT=":50051"
PRODUCT_SERVICE_PORT=":50052"
RECOMMENDATION_SERVICE_PORT=":50053"
ABTEST_SERVICE_PORT=":50054"
GATEWAY_PORT=":8080"
```

## 停止服务

```bash
# 停止基础设施
docker-compose down

# 停止服务进程
pkill -f "go run ./cmd"
```

## 注意事项

1. **生产环境**：请使用TLS加密gRPC通信
2. **性能**：根据实际QPS调整缓存大小和数据库连接池
3. **监控**：建议添加Prometheus监控和链路追踪
4. **一致性**：缓存更新广播采用best-effort模式，不保证强一致
