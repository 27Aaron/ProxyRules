/* eslint-disable react-refresh/only-export-components */

import * as React from "react"

export type Locale = "zh" | "en" | "ja" | "ru"
type Vars = Record<string, string | number>

export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: "zh", label: "中文", short: "中" },
  { value: "en", label: "English", short: "EN" },
  { value: "ja", label: "日本語", short: "日" },
  { value: "ru", label: "Русский", short: "RU" },
]

const zh = {
  "header.reset": "恢复默认",
  "header.theme": "切换主题",
  "header.github": "GitHub 仓库",
  "header.openGithub": "打开 GitHub 仓库",
  "header.language": "界面语言",
  "toast.reset": "已恢复默认设置",
  "toast.duplicates": "已移除重复规则：{items}",
  "toast.included": "{id} 已经包含在当前策略组中",
  "toast.added": "已添加 {name}",
  "toast.clientSwitched": "已切换到 {client} 客户端配置",
  "toast.regionAdded": "已添加 {region} 地区",
  "toast.regionRemoved": "已移除 {region} 地区",
  "toast.groupAdded": "已添加 {group} 策略组",
  "toast.groupRemoved": "已移除 {group} 策略组",
  "step.client.title": "选择客户端",
  "step.client.description": "输出对应语法和文件后缀。",
  "step.region.title": "选择分流地区",
  "step.region.description":
    "未选地区不会写入配置；Other 永远排除六个已知地区。",
  "step.groups.title": "选择策略组",
  "step.groups.description": "常用组直接勾选，其余规则可从完整清单中搜索。",
  "step.groups.common": "常用策略组",
  "step.groups.search": "搜索更多规则",
  "step.groups.selected": "已选策略组名称",
  "step.groups.namesDescription": "名称会直接写入生成的配置。",
  "step.groups.rules": "{count} 条 · {kind}",
  "step.groups.nameLabel": "{id} 策略组名称",
  "step.groups.remove": "移除 {id}",
  "step.groups.removeRule": "移除规则",
  "step.settings.title": "调整通用设置",
  "step.settings.description": "只开放模板中已定义且适合可视化编辑的字段。",
  "step.settings.footer": "Proxies、Manual 与 Final 为基础策略组，始终保留。",
  "validation.title": "配置需要修正",
  "region.HKG": "香港",
  "region.JPN": "日本",
  "region.USA": "美国",
  "region.SGP": "新加坡",
  "region.TWN": "台湾",
  "region.KOR": "韩国",
  "region.Other": "其他",
  "group.ai": "Anthropic、Gemini、OpenAI 与 xAI",
  "group.google": "Google 相关服务",
  "group.apple": "Apple 与 Push 相关服务",
  "group.telegram": "Telegram 相关服务",
  "group.twitter": "X（Twitter）相关服务",
  "group.ip-attribution": "IP 归属与分流检测",
  "preview.copied": "配置已复制",
  "preview.copyFailed": "复制失败，请使用下载功能",
  "preview.downloaded": "已下载 {file}",
  "preview.description": "配置会随左侧选择实时更新。",
  "preview.lines": "{count} 行",
  "preview.copy": "复制",
  "preview.download": "下载",
  "settings.network": "网络与测试",
  "settings.rules": "规则行为",
  "settings.client": "客户端",
  "settings.ruleUrl": "规则地址",
  "settings.ruleUrlDescription": "所有远程 ruleset 的基础地址。",
  "settings.ruleInterval": "资源更新（秒）",
  "settings.ruleIntervalDescription": "更新远程规则或代理列表的间隔。",
  "settings.internetUrl": "联网测试地址",
  "settings.dnsServers": "DNS 服务器",
  "settings.dnsServersDescriptionMihomo":
    "引导 DNS；填写 IP 地址或支持的加密 DNS URI，多个值用英文逗号分隔。",
  "settings.dnsServersDescriptionSurge":
    "普通 DNS 服务器，多个地址使用英文逗号分隔。",
  "settings.dnsServersDescriptionLoon":
    "写入 dns-server，多个地址使用英文逗号分隔。",
  "settings.dnsServersDescriptionShadowrocket":
    "普通 DNS 服务器，与加密 DNS 分开填写。",
  "settings.encryptedDns": "加密 DNS",
  "settings.encryptedDnsDescription":
    "支持 https://、h3://、quic:// 与 tls://，多个地址使用英文逗号分隔。",
  "settings.encryptedDnsDescriptionLoon":
    "支持 https://、h3:// 与 quic://，多个地址使用英文逗号分隔。",
  "settings.includeSystemDns": "包含系统 DNS",
  "settings.includeSystemDnsDescription": "将 system 加入普通 DNS 列表。",
  "settings.fallbackDns": "备用 DNS",
  "settings.fallbackDnsDescription":
    "主 DNS 查询失败时使用；可填写 system 或服务器地址。",
  "settings.ipv6": "启用 IPv6",
  "settings.ipv6Description": "同步写入当前客户端的 IPv6 设置。",
  "settings.proxyUrl": "代理测速地址",
  "settings.groupInterval": "地区测速（秒）",
  "settings.groupTolerance": "测速容差（毫秒）",
  "settings.timeout": "超时（秒）",
  "settings.providerUrl": "代理提供者 URL",
  "settings.providerUrlDescription":
    "必填，URL 内容需兼容 Mihomo proxy-provider 格式。",
  "settings.proxyListUrl": "代理列表 URL",
  "settings.proxyListUrlDescription":
    "必填，内容需为 Surge 代理定义行，并通过 policy-path 加载。",
  "settings.subscriptionName": "订阅别名",
  "settings.subscriptionNameDescription": "用于 Remote Proxy 与节点筛选。",
  "settings.subscriptionUrl": "订阅 URL",
  "settings.subscriptionUrlDescription": "必填，写入 Loon Remote Proxy。",
  "settings.subscriptionNames": "App 内订阅名称",
  "settings.subscriptionNamesDescription":
    "可选；多个名称使用英文逗号分隔，留空则匹配全部节点。",
  "settings.builtin": "内置规则",
  "settings.builtinDescription":
    "这些规则构成基础分流，并始终排在 FINAL 之前。",
  "settings.blockAds": "拦截广告",
  "settings.blockAdsDescription": "使用 category-ads-all@ads。",
  "settings.directPrivate": "私有网络直连",
  "settings.directPrivateDescription": "避免局域网流量进入代理。",
  "settings.directChina": "中国大陆直连",
  "settings.directChinaDescription": "使用完整 cn ruleset。",
  "settings.mixedPort": "混合端口",
  "settings.logLevel": "日志级别",
  "settings.externalController": "外部控制器",
  "settings.apiSecret": "API 密钥",
  "settings.secretDescription": "回环地址可留空；非回环控制器必须设置密钥。",
  "settings.allowLan": "允许局域网连接",
  "settings.allowLanDescription": "允许局域网设备连接 Mihomo。",
  "settings.lanAllowedIps": "允许的局域网网段",
  "settings.lanAllowedIpsDescription": "多个 CIDR 使用英文逗号分隔。",
  "settings.tun": "启用 TUN",
  "settings.tunDescription": "接管系统流量并自动配置路由。",
  "settings.tunStack": "TUN 协议栈",
  "settings.strictRoute": "严格路由",
  "settings.strictRouteDescription": "限制未被 TUN 接管的连接。",
  "settings.respectDnsRules": "DNS 遵循分流规则",
  "settings.respectDnsRulesDescription": "按规则选择 DNS 查询的出站路径。",
  "settings.sniffer": "协议嗅探",
  "settings.snifferDescription": "从流量中还原域名以改善规则匹配。",
  "settings.encryptedDnsFollowOutbound": "加密 DNS 跟随出站模式",
  "settings.encryptedDnsFollowOutboundDescription":
    "让加密 DNS 请求使用当前出站策略。",
  "settings.udpPriority": "UDP 优先",
  "settings.udpPriorityDescription": "优先处理 UDP，适合对延迟敏感的场景。",
  "settings.evaluateBeforeUse": "使用前测速",
  "settings.evaluateBeforeUseDescription": "选择策略前先评估节点可用性。",
  "settings.interfaceMode": "接口模式",
  "settings.realIp": "真实 IP 域名",
  "settings.realIpDescription":
    "这些域名不使用 Fake IP；多个值用英文逗号分隔。",
  "settings.udpFallback": "UDP 不支持时",
  "settings.udpFallbackDescription": "选择直连或拒绝 UDP 请求。",
  "settings.hijackDns": "劫持 DNS",
  "settings.hijackDnsDescription": "接管发往常用 DNS 端口的查询。",
  "settings.disableStun": "禁用 STUN",
  "settings.disableStunDescription": "阻止 STUN 暴露直连地址。",
  "settings.excludeCgnat": "从 TUN 排除 CGNAT",
  "settings.excludeCgnatDescription":
    "排除 100.64.0.0/10；使用 Tailscale 时请保持关闭。",
  "search.title": "搜索规则",
  "search.description": "从 rules 分支的 manifest.json 中查找完整 ruleset。",
  "search.heading": "添加独立策略组",
  "search.help": "选中一条规则后，将自动创建同名策略组并接入完整 ruleset。",
  "search.placeholder": "搜索 Netflix、Spotify、YouTube…",
  "search.attributes": "显示属性子集",
  "search.attributesDescription": "包含带有 @ads、@cn 等属性的细分规则。",
  "search.loadFailed": "无法读取规则清单",
  "search.reload": "重新加载",
  "search.loading": "正在加载规则",
  "search.empty": "没有找到匹配的规则。",
  "search.results": "规则分类 · 显示 {count} 条",
  "search.included": "已包含",
  "kind.domain": "域名",
  "kind.ip": "IP",
  "kind.mixed": "域名 + IP",
} as const

export type TranslationKey = keyof typeof zh
type Key = TranslationKey

const en: Record<Key, string> = {
  "header.reset": "Reset to defaults",
  "header.theme": "Toggle theme",
  "header.github": "GitHub repository",
  "header.openGithub": "Open GitHub repository",
  "header.language": "Interface language",
  "toast.reset": "Defaults restored",
  "toast.duplicates": "Removed duplicate rules: {items}",
  "toast.included": "{id} is already included",
  "toast.added": "Added {name}",
  "toast.clientSwitched": "Switched to the {client} configuration",
  "toast.regionAdded": "Added the {region} region",
  "toast.regionRemoved": "Removed the {region} region",
  "toast.groupAdded": "Added the {group} policy group",
  "toast.groupRemoved": "Removed the {group} policy group",
  "step.client.title": "Choose client",
  "step.client.description": "Generate the matching syntax and file extension.",
  "step.region.title": "Choose routing regions",
  "step.region.description":
    "Unselected regions are omitted; Other always excludes the six known regions.",
  "step.groups.title": "Choose policy groups",
  "step.groups.description":
    "Select common groups or search the full rule catalog.",
  "step.groups.common": "Common policy groups",
  "step.groups.search": "Search more rules",
  "step.groups.selected": "Selected policy group names",
  "step.groups.namesDescription":
    "Names are written directly to the generated configuration.",
  "step.groups.rules": "{count} rules · {kind}",
  "step.groups.nameLabel": "{id} policy group name",
  "step.groups.remove": "Remove {id}",
  "step.groups.removeRule": "Remove rule",
  "step.settings.title": "General settings",
  "step.settings.description":
    "Only template fields suitable for visual editing are available.",
  "step.settings.footer":
    "Proxies, Manual, and Final are required base policy groups.",
  "validation.title": "Configuration needs attention",
  "region.HKG": "Hong Kong",
  "region.JPN": "Japan",
  "region.USA": "United States",
  "region.SGP": "Singapore",
  "region.TWN": "Taiwan",
  "region.KOR": "South Korea",
  "region.Other": "Other",
  "group.ai": "Anthropic, Gemini, OpenAI, and xAI",
  "group.google": "Google services",
  "group.apple": "Apple and Push services",
  "group.telegram": "Telegram services",
  "group.twitter": "X (Twitter) services",
  "group.ip-attribution": "IP attribution and routing",
  "preview.copied": "Configuration copied",
  "preview.copyFailed": "Copy failed. Please download the file instead.",
  "preview.downloaded": "Downloaded {file}",
  "preview.description": "The configuration updates as you change options.",
  "preview.lines": "{count} lines",
  "preview.copy": "Copy",
  "preview.download": "Download",
  "settings.network": "Network & testing",
  "settings.rules": "Rule behavior",
  "settings.client": "Client",
  "settings.ruleUrl": "Rule URL",
  "settings.ruleUrlDescription": "Base URL for all remote rulesets.",
  "settings.ruleInterval": "Resource update (seconds)",
  "settings.ruleIntervalDescription":
    "Update interval for remote rules or proxy lists.",
  "settings.internetUrl": "Internet test URL",
  "settings.dnsServers": "DNS servers",
  "settings.dnsServersDescriptionMihomo":
    "Bootstrap DNS; enter IP addresses or supported encrypted DNS URIs, separated with commas.",
  "settings.dnsServersDescriptionSurge":
    "Plain DNS servers, separated with commas.",
  "settings.dnsServersDescriptionLoon":
    "Written to dns-server; separate multiple addresses with commas.",
  "settings.dnsServersDescriptionShadowrocket":
    "Plain DNS servers, entered separately from encrypted DNS.",
  "settings.encryptedDns": "Encrypted DNS",
  "settings.encryptedDnsDescription":
    "Supports https://, h3://, quic://, and tls:// addresses, separated with commas.",
  "settings.encryptedDnsDescriptionLoon":
    "Supports https://, h3://, and quic:// addresses, separated with commas.",
  "settings.includeSystemDns": "Include system DNS",
  "settings.includeSystemDnsDescription": "Adds system to the plain DNS list.",
  "settings.fallbackDns": "Fallback DNS",
  "settings.fallbackDnsDescription":
    "Used when primary DNS fails; enter system or server addresses.",
  "settings.ipv6": "Enable IPv6",
  "settings.ipv6Description": "Writes the IPv6 setting for the current client.",
  "settings.proxyUrl": "Proxy test URL",
  "settings.groupInterval": "Region test (seconds)",
  "settings.groupTolerance": "Test tolerance (ms)",
  "settings.timeout": "Timeout (seconds)",
  "settings.providerUrl": "Proxy provider URL",
  "settings.providerUrlDescription":
    "Required. The URL must return Mihomo-compatible provider content.",
  "settings.proxyListUrl": "Proxy list URL",
  "settings.proxyListUrlDescription":
    "Required. Must contain Surge proxy definition lines for policy-path.",
  "settings.subscriptionName": "Subscription alias",
  "settings.subscriptionNameDescription":
    "Used by Remote Proxy and node filters.",
  "settings.subscriptionUrl": "Subscription URL",
  "settings.subscriptionUrlDescription":
    "Required. Written to Loon Remote Proxy.",
  "settings.subscriptionNames": "In-app subscription names",
  "settings.subscriptionNamesDescription":
    "Optional. Separate names with commas; leave blank to match all nodes.",
  "settings.builtin": "Built-in rules",
  "settings.builtinDescription":
    "These rules form the base routing set and always precede FINAL.",
  "settings.blockAds": "Block ads",
  "settings.blockAdsDescription": "Uses category-ads-all@ads.",
  "settings.directPrivate": "Direct private networks",
  "settings.directPrivateDescription":
    "Keeps local network traffic out of the proxy.",
  "settings.directChina": "Direct mainland China",
  "settings.directChinaDescription": "Uses the complete cn ruleset.",
  "settings.mixedPort": "Mixed port",
  "settings.logLevel": "Log level",
  "settings.externalController": "External controller",
  "settings.apiSecret": "API secret",
  "settings.secretDescription":
    "May be blank on loopback; a non-loopback controller requires a secret.",
  "settings.allowLan": "Allow LAN connections",
  "settings.allowLanDescription": "Lets LAN devices connect to Mihomo.",
  "settings.lanAllowedIps": "Allowed LAN networks",
  "settings.lanAllowedIpsDescription": "Separate CIDR ranges with commas.",
  "settings.tun": "Enable TUN",
  "settings.tunDescription": "Captures system traffic and configures routes.",
  "settings.tunStack": "TUN stack",
  "settings.strictRoute": "Strict routing",
  "settings.strictRouteDescription": "Restricts connections outside TUN.",
  "settings.respectDnsRules": "DNS follows routing rules",
  "settings.respectDnsRulesDescription":
    "Selects the DNS query path using routing rules.",
  "settings.sniffer": "Protocol sniffing",
  "settings.snifferDescription":
    "Recovers domain names from traffic for better rule matching.",
  "settings.encryptedDnsFollowOutbound": "Encrypted DNS follows outbound mode",
  "settings.encryptedDnsFollowOutboundDescription":
    "Routes encrypted DNS requests through the active outbound policy.",
  "settings.udpPriority": "Prioritize UDP",
  "settings.udpPriorityDescription":
    "Prioritizes UDP for latency-sensitive traffic.",
  "settings.evaluateBeforeUse": "Evaluate before use",
  "settings.evaluateBeforeUseDescription":
    "Checks node availability before selecting a policy.",
  "settings.interfaceMode": "Interface mode",
  "settings.realIp": "Real-IP domains",
  "settings.realIpDescription":
    "Disables Fake IP for these domains; separate values with commas.",
  "settings.udpFallback": "When UDP is unsupported",
  "settings.udpFallbackDescription": "Send UDP directly or reject it.",
  "settings.hijackDns": "Hijack DNS",
  "settings.hijackDnsDescription": "Captures queries sent to common DNS ports.",
  "settings.disableStun": "Disable STUN",
  "settings.disableStunDescription":
    "Prevents STUN from exposing the direct address.",
  "settings.excludeCgnat": "Exclude CGNAT from TUN",
  "settings.excludeCgnatDescription":
    "Excludes 100.64.0.0/10; keep off when using Tailscale.",
  "search.title": "Search rules",
  "search.description":
    "Find complete rulesets in manifest.json on the rules branch.",
  "search.heading": "Add a standalone policy group",
  "search.help":
    "Selecting a rule creates a matching policy group using the complete ruleset.",
  "search.placeholder": "Search Netflix, Spotify, YouTube…",
  "search.attributes": "Show attribute subsets",
  "search.attributesDescription":
    "Includes granular rules with attributes such as @ads and @cn.",
  "search.loadFailed": "Could not load rule catalog",
  "search.reload": "Reload",
  "search.loading": "Loading rules",
  "search.empty": "No matching rules found.",
  "search.results": "Rule categories · {count} shown",
  "search.included": "Included",
  "kind.domain": "Domain",
  "kind.ip": "IP",
  "kind.mixed": "Domain + IP",
}

const ja: Record<Key, string> = {
  ...en,
  "header.reset": "初期設定に戻す",
  "header.theme": "テーマを切り替え",
  "header.github": "GitHub リポジトリ",
  "header.openGithub": "GitHub リポジトリを開く",
  "header.language": "表示言語",
  "toast.reset": "初期設定に戻しました",
  "toast.duplicates": "重複ルールを削除しました：{items}",
  "toast.included": "{id} はすでに含まれています",
  "toast.added": "{name} を追加しました",
  "toast.clientSwitched": "{client} の設定に切り替えました",
  "toast.regionAdded": "{region} 地域を追加しました",
  "toast.regionRemoved": "{region} 地域を削除しました",
  "toast.groupAdded": "{group} ポリシーグループを追加しました",
  "toast.groupRemoved": "{group} ポリシーグループを削除しました",
  "step.client.title": "クライアントを選択",
  "step.client.description": "対応する構文と拡張子で出力します。",
  "step.region.title": "振り分け地域を選択",
  "step.region.description":
    "未選択の地域は設定に含まれません。Other は既知の6地域を常に除外します。",
  "step.groups.title": "ポリシーグループを選択",
  "step.groups.description":
    "よく使うグループを選ぶか、ルール一覧を検索します。",
  "step.groups.common": "よく使うポリシーグループ",
  "step.groups.search": "ルールをさらに検索",
  "step.groups.selected": "選択済みグループ名",
  "step.groups.namesDescription":
    "名前は生成される設定にそのまま書き込まれます。",
  "step.groups.rules": "{count} 件 · {kind}",
  "step.groups.nameLabel": "{id} ポリシーグループ名",
  "step.groups.remove": "{id} を削除",
  "step.groups.removeRule": "ルールを削除",
  "step.settings.title": "共通設定",
  "step.settings.description":
    "テンプレートで定義された編集可能な項目のみ表示します。",
  "step.settings.footer": "Proxies、Manual、Final は必須の基本グループです。",
  "validation.title": "設定を修正してください",
  "region.HKG": "香港",
  "region.JPN": "日本",
  "region.USA": "アメリカ",
  "region.SGP": "シンガポール",
  "region.TWN": "台湾",
  "region.KOR": "韓国",
  "region.Other": "その他",
  "group.ai": "Anthropic、Gemini、OpenAI、xAI",
  "group.google": "Google 関連サービス",
  "group.apple": "Apple・Push 関連サービス",
  "group.telegram": "Telegram 関連サービス",
  "group.twitter": "X（Twitter）関連サービス",
  "group.ip-attribution": "IP 帰属と振り分け判定",
  "preview.copied": "設定をコピーしました",
  "preview.copyFailed": "コピーできませんでした。ダウンロードしてください。",
  "preview.downloaded": "{file} をダウンロードしました",
  "preview.description": "左側の選択に合わせて設定が更新されます。",
  "preview.lines": "{count} 行",
  "preview.copy": "コピー",
  "preview.download": "ダウンロード",
  "settings.network": "ネットワークとテスト",
  "settings.rules": "ルール動作",
  "settings.client": "クライアント",
  "settings.ruleUrl": "ルール URL",
  "settings.ruleUrlDescription": "すべてのリモート ruleset のベース URL。",
  "settings.ruleInterval": "リソース更新（秒）",
  "settings.ruleIntervalDescription":
    "リモートルールまたはプロキシリストの更新間隔です。",
  "settings.internetUrl": "接続テスト URL",
  "settings.dnsServers": "DNS サーバー",
  "settings.dnsServersDescriptionMihomo":
    "ブートストラップ DNS です。IP アドレスまたは対応する暗号化 DNS URI をカンマ区切りで入力します。",
  "settings.dnsServersDescriptionSurge":
    "通常の DNS サーバーをカンマ区切りで入力します。",
  "settings.dnsServersDescriptionLoon":
    "dns-server に書き込みます。複数のアドレスはカンマで区切ります。",
  "settings.dnsServersDescriptionShadowrocket":
    "通常の DNS サーバーを暗号化 DNS とは別に入力します。",
  "settings.encryptedDns": "暗号化 DNS",
  "settings.encryptedDnsDescription":
    "https://、h3://、quic://、tls:// に対応します。複数のアドレスはカンマで区切ります。",
  "settings.encryptedDnsDescriptionLoon":
    "https://、h3://、quic:// に対応します。複数のアドレスはカンマで区切ります。",
  "settings.includeSystemDns": "システム DNS を含める",
  "settings.includeSystemDnsDescription":
    "通常の DNS リストに system を追加します。",
  "settings.fallbackDns": "フォールバック DNS",
  "settings.fallbackDnsDescription":
    "プライマリ DNS の失敗時に使用します。system またはサーバーアドレスを入力します。",
  "settings.ipv6": "IPv6 を有効化",
  "settings.ipv6Description": "現在のクライアントに IPv6 設定を書き込みます。",
  "settings.proxyUrl": "プロキシテスト URL",
  "settings.groupInterval": "地域テスト（秒）",
  "settings.groupTolerance": "テスト許容値（ms）",
  "settings.timeout": "タイムアウト（秒）",
  "settings.providerUrl": "プロキシプロバイダー URL",
  "settings.providerUrlDescription":
    "必須。Mihomo 互換のプロバイダー内容を返す URL を指定します。",
  "settings.proxyListUrl": "プロキシリスト URL",
  "settings.proxyListUrlDescription":
    "必須。policy-path 用の Surge プロキシ定義行を含めます。",
  "settings.subscriptionName": "サブスクリプション別名",
  "settings.subscriptionNameDescription":
    "Remote Proxy とノードフィルターで使用します。",
  "settings.subscriptionUrl": "サブスクリプション URL",
  "settings.subscriptionUrlDescription":
    "必須。Loon の Remote Proxy に書き込みます。",
  "settings.subscriptionNames": "App 内のサブスクリプション名",
  "settings.subscriptionNamesDescription":
    "任意。複数の名前はカンマで区切り、空欄の場合は全ノードに一致します。",
  "settings.builtin": "組み込みルール",
  "settings.builtinDescription":
    "基本ルーティングを構成し、常に FINAL より前に配置されます。",
  "settings.blockAds": "広告をブロック",
  "settings.blockAdsDescription": "category-ads-all@ads を使用します。",
  "settings.directPrivate": "プライベートネットワークを直結",
  "settings.directPrivateDescription":
    "LAN トラフィックをプロキシから除外します。",
  "settings.directChina": "中国本土を直結",
  "settings.directChinaDescription": "完全な cn ruleset を使用します。",
  "settings.mixedPort": "Mixed ポート",
  "settings.logLevel": "ログレベル",
  "settings.externalController": "外部コントローラー",
  "settings.apiSecret": "API シークレット",
  "settings.secretDescription":
    "ループバックでは空欄にできます。外部公開する場合はシークレットが必須です。",
  "settings.allowLan": "LAN 接続を許可",
  "settings.allowLanDescription":
    "LAN デバイスから Mihomo への接続を許可します。",
  "settings.lanAllowedIps": "許可する LAN ネットワーク",
  "settings.lanAllowedIpsDescription": "CIDR はカンマで区切ります。",
  "settings.tun": "TUN を有効化",
  "settings.tunDescription":
    "システムトラフィックを取得し、ルートを設定します。",
  "settings.tunStack": "TUN スタック",
  "settings.strictRoute": "厳格なルーティング",
  "settings.strictRouteDescription": "TUN 外の接続を制限します。",
  "settings.respectDnsRules": "DNS を振り分けルールに従わせる",
  "settings.respectDnsRulesDescription":
    "振り分けルールで DNS クエリの経路を選択します。",
  "settings.sniffer": "プロトコルスニッフィング",
  "settings.snifferDescription":
    "トラフィックからドメイン名を復元してルール判定を改善します。",
  "settings.encryptedDnsFollowOutbound": "暗号化 DNS を送信モードに従わせる",
  "settings.encryptedDnsFollowOutboundDescription":
    "暗号化 DNS リクエストを現在の送信ポリシーで処理します。",
  "settings.udpPriority": "UDP を優先",
  "settings.udpPriorityDescription": "遅延に敏感な通信で UDP を優先します。",
  "settings.evaluateBeforeUse": "使用前に評価",
  "settings.evaluateBeforeUseDescription":
    "ポリシー選択前にノードの可用性を確認します。",
  "settings.interfaceMode": "インターフェースモード",
  "settings.realIp": "Real-IP ドメイン",
  "settings.realIpDescription":
    "これらのドメインでは Fake IP を無効にします。値はカンマで区切ります。",
  "settings.udpFallback": "UDP 非対応時",
  "settings.udpFallbackDescription": "UDP を直結または拒否します。",
  "settings.hijackDns": "DNS をハイジャック",
  "settings.hijackDnsDescription":
    "一般的な DNS ポートへの問い合わせを取得します。",
  "settings.disableStun": "STUN を無効化",
  "settings.disableStunDescription":
    "STUN による直接アドレスの露出を防ぎます。",
  "settings.excludeCgnat": "CGNAT を TUN から除外",
  "settings.excludeCgnatDescription":
    "100.64.0.0/10 を除外します。Tailscale 使用時はオフにしてください。",
  "search.title": "ルールを検索",
  "search.description":
    "rules ブランチの manifest.json から ruleset を検索します。",
  "search.heading": "独立ポリシーグループを追加",
  "search.help":
    "ルールを選択すると、同名のグループが完全な ruleset で作成されます。",
  "search.placeholder": "Netflix、Spotify、YouTube を検索…",
  "search.attributes": "属性サブセットを表示",
  "search.attributesDescription": "@ads、@cn などの属性付きルールを含めます。",
  "search.loadFailed": "ルール一覧を読み込めません",
  "search.reload": "再読み込み",
  "search.loading": "ルールを読み込み中",
  "search.empty": "一致するルールはありません。",
  "search.results": "ルールカテゴリ · {count} 件表示",
  "search.included": "追加済み",
  "kind.domain": "ドメイン",
  "kind.ip": "IP",
  "kind.mixed": "ドメイン + IP",
}

const ru: Record<Key, string> = {
  ...en,
  "header.reset": "Сбросить настройки",
  "header.theme": "Сменить тему",
  "header.github": "Репозиторий GitHub",
  "header.openGithub": "Открыть репозиторий GitHub",
  "header.language": "Язык интерфейса",
  "toast.reset": "Настройки восстановлены",
  "toast.duplicates": "Удалены повторяющиеся правила: {items}",
  "toast.included": "{id} уже добавлено",
  "toast.added": "Добавлено: {name}",
  "toast.clientSwitched": "Выбрана конфигурация {client}",
  "toast.regionAdded": "Добавлен регион: {region}",
  "toast.regionRemoved": "Удалён регион: {region}",
  "toast.groupAdded": "Добавлена группа: {group}",
  "toast.groupRemoved": "Удалена группа: {group}",
  "step.client.title": "Выберите клиент",
  "step.client.description":
    "Создание файла с подходящим синтаксисом и расширением.",
  "step.region.title": "Выберите регионы",
  "step.region.description":
    "Невыбранные регионы не добавляются; Other всегда исключает шесть известных регионов.",
  "step.groups.title": "Выберите группы политик",
  "step.groups.description":
    "Выберите популярные группы или найдите правила в полном каталоге.",
  "step.groups.common": "Популярные группы политик",
  "step.groups.search": "Найти другие правила",
  "step.groups.selected": "Имена выбранных групп",
  "step.groups.namesDescription":
    "Имена записываются прямо в создаваемую конфигурацию.",
  "step.groups.rules": "{count} правил · {kind}",
  "step.groups.nameLabel": "Имя группы {id}",
  "step.groups.remove": "Удалить {id}",
  "step.groups.removeRule": "Удалить правило",
  "step.settings.title": "Общие настройки",
  "step.settings.description":
    "Доступны только подходящие для визуального редактирования поля шаблона.",
  "step.settings.footer":
    "Proxies, Manual и Final — обязательные базовые группы.",
  "validation.title": "Исправьте конфигурацию",
  "region.HKG": "Гонконг",
  "region.JPN": "Япония",
  "region.USA": "США",
  "region.SGP": "Сингапур",
  "region.TWN": "Тайвань",
  "region.KOR": "Южная Корея",
  "region.Other": "Другие",
  "group.ai": "Anthropic, Gemini, OpenAI и xAI",
  "group.google": "Сервисы Google",
  "group.apple": "Сервисы Apple и Push",
  "group.telegram": "Сервисы Telegram",
  "group.twitter": "Сервисы X (Twitter)",
  "group.ip-attribution": "Определение IP и маршрутизация",
  "preview.copied": "Конфигурация скопирована",
  "preview.copyFailed": "Не удалось скопировать. Скачайте файл.",
  "preview.downloaded": "Скачан файл {file}",
  "preview.description": "Конфигурация обновляется при изменении параметров.",
  "preview.lines": "Строк: {count}",
  "preview.copy": "Копировать",
  "preview.download": "Скачать",
  "settings.network": "Сеть и тесты",
  "settings.rules": "Поведение правил",
  "settings.client": "Клиент",
  "settings.ruleUrl": "Адрес правил",
  "settings.ruleUrlDescription": "Базовый URL для всех удалённых ruleset.",
  "settings.ruleInterval": "Обновление ресурсов (сек.)",
  "settings.ruleIntervalDescription":
    "Интервал обновления удалённых правил или списков прокси.",
  "settings.internetUrl": "URL проверки интернета",
  "settings.dnsServers": "DNS-серверы",
  "settings.dnsServersDescriptionMihomo":
    "Начальный DNS: укажите IP-адреса или поддерживаемые URI зашифрованного DNS через запятую.",
  "settings.dnsServersDescriptionSurge":
    "Обычные DNS-серверы, разделённые запятыми.",
  "settings.dnsServersDescriptionLoon":
    "Записываются в dns-server; разделяйте адреса запятыми.",
  "settings.dnsServersDescriptionShadowrocket":
    "Обычные DNS-серверы, отдельно от зашифрованного DNS.",
  "settings.encryptedDns": "Зашифрованный DNS",
  "settings.encryptedDnsDescription":
    "Поддерживает адреса https://, h3://, quic:// и tls://, разделённые запятыми.",
  "settings.encryptedDnsDescriptionLoon":
    "Поддерживает адреса https://, h3:// и quic://, разделённые запятыми.",
  "settings.includeSystemDns": "Добавить системный DNS",
  "settings.includeSystemDnsDescription":
    "Добавляет system в список обычных DNS.",
  "settings.fallbackDns": "Резервный DNS",
  "settings.fallbackDnsDescription":
    "Используется при сбое основного DNS; укажите system или адреса серверов.",
  "settings.ipv6": "Включить IPv6",
  "settings.ipv6Description": "Добавляет настройку IPv6 для текущего клиента.",
  "settings.proxyUrl": "URL проверки прокси",
  "settings.groupInterval": "Проверка регионов (сек.)",
  "settings.groupTolerance": "Допуск теста (мс)",
  "settings.timeout": "Тайм-аут (сек.)",
  "settings.providerUrl": "URL провайдера прокси",
  "settings.providerUrlDescription":
    "Обязательно. URL должен возвращать совместимый с Mihomo провайдер.",
  "settings.proxyListUrl": "URL списка прокси",
  "settings.proxyListUrlDescription":
    "Обязательно. Должен содержать строки прокси Surge для policy-path.",
  "settings.subscriptionName": "Псевдоним подписки",
  "settings.subscriptionNameDescription":
    "Используется в Remote Proxy и фильтрах узлов.",
  "settings.subscriptionUrl": "URL подписки",
  "settings.subscriptionUrlDescription":
    "Обязательно. Записывается в Remote Proxy Loon.",
  "settings.subscriptionNames": "Имена подписок в приложении",
  "settings.subscriptionNamesDescription":
    "Необязательно. Разделяйте имена запятыми; пустое поле выбирает все узлы.",
  "settings.builtin": "Встроенные правила",
  "settings.builtinDescription":
    "Эти правила образуют базовую маршрутизацию и всегда идут до FINAL.",
  "settings.blockAds": "Блокировать рекламу",
  "settings.blockAdsDescription": "Используется category-ads-all@ads.",
  "settings.directPrivate": "Прямой доступ к локальной сети",
  "settings.directPrivateDescription":
    "Локальный трафик не направляется через прокси.",
  "settings.directChina": "Прямой доступ к материковому Китаю",
  "settings.directChinaDescription": "Используется полный cn ruleset.",
  "settings.mixedPort": "Смешанный порт",
  "settings.logLevel": "Уровень журнала",
  "settings.externalController": "Внешний контроллер",
  "settings.apiSecret": "Секрет API",
  "settings.secretDescription":
    "На loopback можно оставить пустым; внешний контроллер требует секрет.",
  "settings.allowLan": "Разрешить подключения LAN",
  "settings.allowLanDescription":
    "Разрешает устройствам LAN подключаться к Mihomo.",
  "settings.lanAllowedIps": "Разрешённые сети LAN",
  "settings.lanAllowedIpsDescription": "Разделяйте диапазоны CIDR запятыми.",
  "settings.tun": "Включить TUN",
  "settings.tunDescription":
    "Перехватывает системный трафик и настраивает маршруты.",
  "settings.tunStack": "Стек TUN",
  "settings.strictRoute": "Строгая маршрутизация",
  "settings.strictRouteDescription": "Ограничивает подключения вне TUN.",
  "settings.respectDnsRules": "DNS следует правилам маршрутизации",
  "settings.respectDnsRulesDescription":
    "Выбирает путь DNS-запросов по правилам маршрутизации.",
  "settings.sniffer": "Анализ протоколов",
  "settings.snifferDescription":
    "Восстанавливает домены из трафика для точного сопоставления правил.",
  "settings.encryptedDnsFollowOutbound":
    "Зашифрованный DNS следует исходящему режиму",
  "settings.encryptedDnsFollowOutboundDescription":
    "Направляет зашифрованные DNS-запросы по активной исходящей политике.",
  "settings.udpPriority": "Приоритет UDP",
  "settings.udpPriorityDescription":
    "Даёт приоритет UDP для чувствительного к задержкам трафика.",
  "settings.evaluateBeforeUse": "Проверять перед использованием",
  "settings.evaluateBeforeUseDescription":
    "Проверяет доступность узлов перед выбором политики.",
  "settings.interfaceMode": "Режим интерфейса",
  "settings.realIp": "Домены Real-IP",
  "settings.realIpDescription":
    "Отключает Fake IP для этих доменов; разделяйте значения запятыми.",
  "settings.udpFallback": "Если UDP не поддерживается",
  "settings.udpFallbackDescription": "Отправить UDP напрямую или отклонить.",
  "settings.hijackDns": "Перехватывать DNS",
  "settings.hijackDnsDescription":
    "Перехватывает запросы на стандартные DNS-порты.",
  "settings.disableStun": "Отключить STUN",
  "settings.disableStunDescription": "Не позволяет STUN раскрыть прямой адрес.",
  "settings.excludeCgnat": "Исключить CGNAT из TUN",
  "settings.excludeCgnatDescription":
    "Исключает 100.64.0.0/10; оставьте выключенным при использовании Tailscale.",
  "search.title": "Поиск правил",
  "search.description": "Поиск полных ruleset в manifest.json ветки rules.",
  "search.heading": "Добавить отдельную группу",
  "search.help":
    "Выбранное правило создаст одноимённую группу с полным ruleset.",
  "search.placeholder": "Поиск Netflix, Spotify, YouTube…",
  "search.attributes": "Показывать поднаборы атрибутов",
  "search.attributesDescription":
    "Включает правила с атрибутами @ads, @cn и другими.",
  "search.loadFailed": "Не удалось загрузить каталог",
  "search.reload": "Повторить",
  "search.loading": "Загрузка правил",
  "search.empty": "Подходящие правила не найдены.",
  "search.results": "Категории правил · показано {count}",
  "search.included": "Добавлено",
  "kind.domain": "Домен",
  "kind.ip": "IP",
  "kind.mixed": "Домен + IP",
}

const dictionaries: Record<Locale, Record<Key, string>> = { zh, en, ja, ru }

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: Key, vars?: Vars) => string
}

const I18nContext = React.createContext<I18nValue | null>(null)

function initialLocale(): Locale {
  const saved = localStorage.getItem("proxyrules-locale")
  if (saved === "zh" || saved === "en" || saved === "ja" || saved === "ru")
    return saved
  return "zh"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale)
  const setLocale = React.useCallback((next: Locale) => {
    localStorage.setItem("proxyrules-locale", next)
    setLocaleState(next)
  }, [])

  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = React.useCallback(
    (key: Key, vars: Vars = {}) => {
      return Object.entries(vars).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        dictionaries[locale][key]
      )
    },
    [locale]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const value = React.useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used within I18nProvider")
  return value
}
