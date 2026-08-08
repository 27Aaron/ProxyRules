# ProxyRules Config Studio

基于 React、TypeScript、Vite 与 shadcn/ui 的纯前端配置生成器。

## 功能

- 生成 Mihomo、Surge、Loon 和 Shadowrocket 配置
- 按需选择 HKG、JPN、USA、SGP、TWN、KOR 与 Other 地区
- 组合常用策略组，或从 `rules` 分支的 `manifest.json` 搜索完整 ruleset
- 在浏览器内预览、复制和下载配置
- 将选择保存在浏览器本地，不上传订阅或配置

## 本地开发

```bash
npm ci
npm run dev
```

提交前运行：

```bash
npm test
npm run lint
npm run build
```

`webui` 分支更新后，GitHub Actions 会完成验证与构建，并将产物以单提交方式发布到 `gh-pages` 分支。首次启用时，在仓库 Pages 设置中选择 `gh-pages` 分支的根目录即可。
