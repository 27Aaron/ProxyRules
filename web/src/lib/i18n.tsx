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
  "group.ai": "Apple Intelligence、Claude、Copilot、Gemini、OpenAI 与 xAI",
  "group.google": "Google 服务及其 IP 地址段",
  "group.apple": "Apple 服务与 Apple Push 自定义补充规则",
  "group.telegram": "Telegram 域名及 IP 地址段",
  "group.twitter": "X（Twitter）域名及 IP 地址段",
  "group.ip-attribution": "按拦截、直连、代理顺序处理 IP 归属检测",
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
  "settings.internetUrl": "联网测试地址",
  "settings.proxyUrl": "代理测速地址",
  "settings.ruleInterval": "规则更新（秒）",
  "settings.groupInterval": "地区测速（秒）",
  "settings.timeout": "超时（秒）",
  "settings.builtin": "内置规则",
  "settings.builtinDescription":
    "这些规则构成基础分流，并始终排在 FINAL 之前。",
  "settings.blockAds": "拦截广告",
  "settings.blockAdsDescription": "使用 category-ads-all@ads。",
  "settings.directPrivate": "私有网络直连",
  "settings.directPrivateDescription": "避免局域网流量进入代理。",
  "settings.directChina": "中国大陆直连",
  "settings.directChinaDescription": "使用完整 cn ruleset。",
  "settings.ipv6": "启用 IPv6",
  "settings.ipv6Description": "同步写入当前客户端的 IPv6 设置。",
  "settings.logLevel": "日志级别",
  "settings.secretDescription": "留空则不设置控制器密码。",
  "settings.allowLan": "允许局域网连接",
  "settings.tun": "启用 TUN",
  "settings.bypassSystem": "绕过系统服务",
  "settings.bypassSystemDescription": "写入 bypass-system。",
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
  "group.ai": "Apple Intelligence, Claude, Copilot, Gemini, OpenAI, and xAI",
  "group.google": "Google services and IP ranges",
  "group.apple": "Apple services and custom Apple Push rules",
  "group.telegram": "Telegram domains and IP ranges",
  "group.twitter": "X (Twitter) domains and IP ranges",
  "group.ip-attribution":
    "Process IP attribution in reject, direct, then proxy order",
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
  "settings.internetUrl": "Internet test URL",
  "settings.proxyUrl": "Proxy test URL",
  "settings.ruleInterval": "Rule update (seconds)",
  "settings.groupInterval": "Region test (seconds)",
  "settings.timeout": "Timeout (seconds)",
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
  "settings.ipv6": "Enable IPv6",
  "settings.ipv6Description": "Writes the IPv6 setting for the current client.",
  "settings.logLevel": "Log level",
  "settings.secretDescription": "Leave blank to omit the controller password.",
  "settings.allowLan": "Allow LAN connections",
  "settings.tun": "Enable TUN",
  "settings.bypassSystem": "Bypass system services",
  "settings.bypassSystemDescription": "Writes bypass-system.",
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
  "group.ai": "Apple Intelligence、Claude、Copilot、Gemini、OpenAI、xAI",
  "group.google": "Google サービスと IP アドレス範囲",
  "group.apple": "Apple サービスと Apple Push の追加ルール",
  "group.telegram": "Telegram のドメインと IP アドレス範囲",
  "group.twitter": "X（Twitter）のドメインと IP アドレス範囲",
  "group.ip-attribution": "遮断、直結、プロキシの順で IP 所属判定を処理",
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
  "settings.internetUrl": "接続テスト URL",
  "settings.proxyUrl": "プロキシテスト URL",
  "settings.ruleInterval": "ルール更新（秒）",
  "settings.groupInterval": "地域テスト（秒）",
  "settings.timeout": "タイムアウト（秒）",
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
  "settings.ipv6": "IPv6 を有効化",
  "settings.ipv6Description": "現在のクライアントに IPv6 設定を書き込みます。",
  "settings.logLevel": "ログレベル",
  "settings.secretDescription":
    "空欄の場合、コントローラーパスワードを設定しません。",
  "settings.allowLan": "LAN 接続を許可",
  "settings.tun": "TUN を有効化",
  "settings.bypassSystem": "システムサービスを除外",
  "settings.bypassSystemDescription": "bypass-system を書き込みます。",
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
  "group.ai": "Apple Intelligence, Claude, Copilot, Gemini, OpenAI и xAI",
  "group.google": "Сервисы Google и диапазоны IP-адресов",
  "group.apple": "Сервисы Apple и дополнительные правила Apple Push",
  "group.telegram": "Домены и диапазоны IP-адресов Telegram",
  "group.twitter": "Домены и диапазоны IP-адресов X (Twitter)",
  "group.ip-attribution":
    "Проверка принадлежности IP в порядке: блокировка, прямое соединение, прокси",
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
  "settings.internetUrl": "URL проверки интернета",
  "settings.proxyUrl": "URL проверки прокси",
  "settings.ruleInterval": "Обновление правил (сек.)",
  "settings.groupInterval": "Проверка регионов (сек.)",
  "settings.timeout": "Тайм-аут (сек.)",
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
  "settings.ipv6": "Включить IPv6",
  "settings.ipv6Description": "Добавляет настройку IPv6 для текущего клиента.",
  "settings.logLevel": "Уровень журнала",
  "settings.secretDescription":
    "Оставьте пустым, чтобы не задавать пароль контроллера.",
  "settings.allowLan": "Разрешить подключения LAN",
  "settings.tun": "Включить TUN",
  "settings.bypassSystem": "Обходить системные службы",
  "settings.bypassSystemDescription": "Добавляет bypass-system.",
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
