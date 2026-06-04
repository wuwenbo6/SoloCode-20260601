#!/bin/bash

echo "正在下载 Noto Sans SC 中文字体..."

mkdir -p "$(dirname "$0")"
cd "$(dirname "$0")"

echo "下载常规字体..."
curl -L -o NotoSansSC-Regular.ttf "https://github.com/notofonts/noto-cn/raw/main/Sans/TTF/NotoSansSC-Regular.ttf" 2>/dev/null || {
    echo "尝试备用下载链接..."
    curl -L -o NotoSansSC-Regular.ttf "https://cdn.jsdelivr.net/npm/@notofonts/noto-sans-sc@13.0.7/fonts/NotoSansSC-Regular.ttf"
}

echo "下载粗体字体..."
curl -L -o NotoSansSC-Bold.ttf "https://github.com/notofonts/noto-cn/raw/main/Sans/TTF/NotoSansSC-Bold.ttf" 2>/dev/null || {
    echo "尝试备用下载链接..."
    curl -L -o NotoSansSC-Bold.ttf "https://cdn.jsdelivr.net/npm/@notofonts/noto-sans-sc@13.0.7/fonts/NotoSansSC-Bold.ttf"
}

if [ -f "NotoSansSC-Regular.ttf" ] && [ -f "NotoSansSC-Bold.ttf" ]; then
    echo ""
    echo "✓ 字体下载成功！"
    ls -lh *.ttf
else
    echo ""
    echo "✗ 字体下载失败，请手动下载："
    echo "  1. 访问 https://fonts.google.com/noto/specimen/Noto+Sans+SC"
    echo "  2. 下载 NotoSansSC-Regular.ttf 和 NotoSansSC-Bold.ttf"
    echo "  3. 放置在 backend/fonts/ 目录下"
fi
