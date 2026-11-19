# Custom Rules

Manually maintained rules for direct subscription by proxy clients. Each
directory holds one rule list with a single purpose:

- `anthropic/` — Anthropic and Claude domains
- `openai/` — OpenAI service endpoints
- `apple-push/` — Apple Push Notification service (APNs)
- `googlefcm/` — Google Firebase Cloud Messaging (FCM) endpoints
- `ip-attribution/` — endpoints that determine or display an account's IP
  location on Chinese platforms

Rule lists use Surge syntax, which Clash (classical rulesets), Surge, Loon,
Egern, and Shadowrocket can all consume directly, for example:

```text
https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/ip-attribution/ip-attribution.list
```

## Rule Syntax

Supported rule types:

```text
DOMAIN
DOMAIN-SUFFIX
DOMAIN-KEYWORD
DOMAIN-REGEX
IP-CIDR
IP-CIDR6
```

Add `no-resolve` to IP rules:

```text
IP-CIDR,192.0.2.0/24,no-resolve
IP-CIDR6,2001:db8::/32,no-resolve
```

Optional actions:

```text
DOMAIN-SUFFIX,example.com,DIRECT
IP-CIDR,192.0.2.0/24,REJECT,no-resolve
```

Rules without an action follow the policy bound to the rule set in the
client configuration.

## Adding a Service

Create one directory with one `.list` file per service. Keep
`ip-attribution.list` as a single file: its rules depend on internal
ordering, where `DIRECT` and `REJECT` entries must precede the proxy rules
for the same suffixes.
