#!/bin/bash

GATEWAY_URL="http://localhost:8080"

echo "= = = = = = = = = = = = = = = = = = = ="
echo "  API 测试脚本"
echo "= = = = = = = = = = = = = = = = = = = ="
echo ""

check_gateway() {
    curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/v1/products/hot?limit=3" 2>/dev/null
}

echo "等待Gateway是否在 $GATEWAY_URL ..."
for i in {1..10}; do
    status=$(check_gateway)
    if [ "$status" = "200" ]; then
        echo "Gateway 已就绪!"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "[1/5] 获取热门商品..."
curl -s "$GATEWAY_URL/v1/products/hot?limit=3" | head -c 500
echo ""
echo ""

echo "[2/5] 获取用户信息..."
curl -s "$GATEWAY_URL/v1/users/1"
echo ""
echo ""

echo "[3/5] 获取推荐列表 (用户ID=1)..."
curl -s "$GATEWAY_URL/v1/recommendations/1?limit=5"
echo ""
echo ""

echo "[4/5] 获取AB测试实验信息..."
curl -s "$GATEWAY_URL/v1/abtest/experiments/recommendation_algo"
echo ""
echo ""

echo "[5/5] 获取AB测试统计..."
curl -s "$GATEWAY_URL/v1/abtest/experiments/recommendation_algo/stats"
echo ""
echo ""

echo "= = = = = = = = = = = = = = = = = = = ="
echo "  测试完成!"
echo "= = = = = = = = = = = = = = = = = = = ="
