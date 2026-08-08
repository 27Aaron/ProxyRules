# ProxyRules Config Studio

基于 Astro、React、TypeScript 与 shadcn/ui 的静态配置生成器。Astro 负责页面、构建与静态输出，高交互配置器作为 React Island 在浏览器中运行。

## 功能

- 生成 Mihomo、Surge、Loon 和 Shadowrocket 配置
- 按需选择 HKG、JPN、USA、SGP、TWN、KOR 与 Other 地区
- 组合常用策略组，或从 `rules` 分支的 `manifest.json` 搜索完整 ruleset
- 在浏览器内预览、复制和下载配置
- 将选择保存在浏览器本地，不上传订阅或配置

## 本地开发

需要 Node.js 22.13 或更高版本，以及 pnpm 11.20.0。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认在 `/ProxyRules/` 提供页面。生产环境可通过 `ASTRO_BASE_PATH` 覆盖部署路径。

提交前运行：

```bash
pnpm test
pnpm lint
pnpm build
```

`webui` 分支更新后，GitHub Actions 会完成验证与构建，并将产物以单提交方式发布到 `gh-pages` 分支。首次启用时，在仓库 Pages 设置中选择 `gh-pages` 分支的根目录即可。
