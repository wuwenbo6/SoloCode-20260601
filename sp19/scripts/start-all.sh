#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "= = = = = = = = = = = = = = = = = = = ="
echo "  推荐系统微服务 - 启动脚本"
echo "= = = = = = = = = = = = = = = = = = = ="

echo ""
echo "[1/3] 启动基础设施 (MySQL + Redis)..."
docker-compose up -d

echo ""
echo "等待MySQL就绪..."
for i in {1..30}; do
    if docker exec recsys-mysql mysqladmin ping -h localhost -uroot -ppassword --silent 2>/dev/null; then
        echo "MySQL 已就绪!"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "等待Redis就绪..."
for i in {1..10}; do
    if docker exec recsys-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "Redis 已就绪!"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "[2/3] 初始化数据库..."
sleep 3

echo ""
echo "[3/3] 启动微服务..."
echo ""

echo "启动 User Service (端口:50051)..."
go run ./cmd/user &
USER_PID=$!
sleep 2

echo "启动 Product Service (端口:50052)..."
go run ./cmd/product &
PRODUCT_PID=$!
sleep 2

echo "启动 AB Test Service (端口:50054)..."
go run ./cmd/abtest &
ABTEST_PID=$!
sleep 2

echo "启动 Recommendation Service (端口:50053)..."
go run ./cmd/recommendation &
REC_PID=$!
sleep 2

echo "启动 gRPC Gateway (端口:8080)..."
go run ./cmd/gateway &
GATEWAY_PID=$!
sleep 2

echo ""
echo "= = = = = = = = = = = = = = = = = = = ="
echo "  所有服务已启动!"
echo "= = = = = = = = = = = = = = = = = = = ="
echo ""
echo "服务端口:"
echo "  - User Service:         :50051 (gRPC)"
echo "  - Product Service:      :50052 (gRPC)"
echo "  - Recommendation Service: :50053 (gRPC)"
echo "  - AB Test Service:      :50054 (gRPC)"
echo "  - gRPC Gateway:         :8080 (HTTP/REST)"
echo ""
echo "REST API 端点:"
echo "  GET    /v1/users/{id}                - 获取用户"
echo "  POST   /v1/users                     - 创建用户"
echo "  PUT    /v1/users/{id}                - 更新用户"
echo "  DELETE /v1/users/{id}                - 删除用户"
echo "  GET    /v1/users/{id}/browse         - 获取浏览历史"
echo "  POST   /v1/users/{id}/browse         - 记录浏览历史"
echo ""
echo "  GET    /v1/products/{id}             - 获取商品"
echo "  POST   /v1/products                  - 创建商品"
echo "  GET    /v1/products                  - 商品列表"
echo "  GET    /v1/products/hot              - 热门商品"
echo ""
echo "  GET    /v1/recommendations/{user_id} - 获取推荐"
echo "  POST   /v1/recommendations/{user_id}/click - 记录点击"
echo ""
echo "  GET    /v1/abtest/experiments/{id}   - 获取实验"
echo "  GET    /v1/abtest/experiments/{id}/stats - 获取实验统计"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $USER_PID $PRODUCT_PID $REC_PID $ABTEST_PID $GATEWAY_PID 2>/dev/null || true
    wait 2>/dev/null
    echo "所有服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
