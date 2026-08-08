# ProxyRules Config Studio

此分支维护 ProxyRules 的可视化配置生成器。源码位于 [`web`](./web)，规则数据动态读取自 `rules` 分支。

WebUI 支持 Mihomo、Surge、Loon 与 Shadowrocket，可按需选择地区、策略组和完整 ruleset，并在浏览器内复制或下载生成结果。

## Branches

- `main`：四款客户端的配置、模块与脚本
- `custom`：人工维护的自定义规则
- `rules`：Action 自动生成的规则与 `manifest.json`
- `webui`：WebUI 源码
- `gh-pages`：WebUI 构建产物，由 Action 保持为单个提交
