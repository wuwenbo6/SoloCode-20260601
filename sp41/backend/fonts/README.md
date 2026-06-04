# 中文字体安装说明

为了在PDF报告中正确显示中文字符，需要安装 Noto Sans SC 字体。

## 字体下载

### 方法一：手动下载

1. 访问 Google Fonts 下载 Noto Sans SC:
   - https://fonts.google.com/noto/specimen/Noto+Sans+SC

2. 下载以下字体文件并放置在此目录:
   - `NotoSansSC-Regular.ttf`
   - `NotoSansSC-Bold.ttf`

### 方法二：使用下载脚本（需要 curl）

运行以下命令下载字体:

```bash
cd backend/fonts
curl -L -o NotoSansSC-Regular.ttf "https://github.com/notofonts/noto-cn/raw/main/Sans/TTF/NotoSansSC-Regular.ttf"
curl -L -o NotoSansSC-Bold.ttf "https://github.com/notofonts/noto-cn/raw/main/Sans/TTF/NotoSansSC-Bold.ttf"
```

### 方法三：使用 npm 包

```bash
cd backend
npm install typeface-noto-sans-sc --save
```

然后修改 `services/exportService.js` 中的字体路径。

## 验证字体安装

放置字体文件后，启动后端服务，导出PDF报告。如果字体正确加载，将显示完整中文内容；否则将显示英文内容并提示安装字体。

## 支持的字体

系统会自动检测以下字体文件:
- NotoSansSC-Regular.ttf (常规)
- NotoSansSC-Bold.ttf (粗体)

字体文件放置在此目录后会自动生效，无需重启服务（PDF导出时动态检测）。
