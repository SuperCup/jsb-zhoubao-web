# 嘉士伯淘京周报数据看板

这是一个可部署的网页数据看板，用于承接嘉士伯淘宝闪购与京东秒送周报。看板支持平台筛选、周期切换、BU/区域下钻，以及渠道、品牌、商户、商品维度查看。

## 数据来源

默认读取本机源目录：

```text
/Users/luffy/Desktop/Project/A_即时零售交付新路线探索/嘉士伯周报数据源
```

数据整理脚本会读取：

- 各周期全量数据明细 CSV
- 各周期账单数据明细 CSV
- `目标GMV.xlsx`
- `分BU预算金额.xlsx`

取数逻辑见 [docs/取数逻辑说明.md](/Users/luffy/Documents/即时零售BI看板%202/docs/取数逻辑说明.md)。

## 常用命令

```bash
npm install
npm run build:data
npm run dev
npm run lint
npm run build
```

更新数据时，先替换源目录下的 CSV/XLSX，再运行：

```bash
npm run build:data
npm run build
```

## 本地预览

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

打开：

```text
http://127.0.0.1:3000/
```

## 部署

项目使用 Sites 托管，部署配置位于 `.openai/hosting.json`。当前站点 ID 已写入该配置文件。发布前需要先通过 `npm run build` 验证构建产物。
