# Custom Rules

Hand-maintained rules subscribed directly by proxy clients. Sources live in
`Sources/`, subscription-ready files are generated into `Rules/`:

```
Sources/<service>/<service>.list          hand-maintained, the single source
Rules/<service>/<service>.list            clean copy with stats header
Rules/<service>/<service>.yaml            Clash rule-provider (behavior: classical)
Rules/<service>/<service>.egern.yaml      Egern rule set
```

Services:

- `Anthropic/` — Anthropic and Claude domains
- `OpenAI/` — OpenAI service endpoints
- `ApplePush/` — Apple Push Notification service (APNs)
- `GoogleFCM/` — Google Firebase Cloud Messaging (FCM) endpoints

## Maintaining

1. Edit `Sources/<service>/<service>.list` (rule syntax below) — never edit anything under `Rules/`
2. Regenerate the subscription files:

   ```bash
   python3 scripts/convert.py
   ```

3. Commit everything together

The converter fails loudly on unknown rule types or options instead of
skipping them, so a typo cannot slip through silently. Re-running it without
changes produces no diff.

Generated files start with a stats header:

```text
# NAME: Anthropic
# AUTHOR: 27Aaron
# REPO: https://github.com/27Aaron/ProxyRules
# UPDATED: 2025-06-06 09:20:01
# DOMAIN: 1
# DOMAIN-SUFFIX: 2
# TOTAL: 3
```

Rule lists carry no policy component — the policy is chosen by whatever
references the file, so one source file serves every client layout.

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

Inline policies and other options are not allowed in these lists; the
converter rejects them.

## Referencing

Raw base URL: `https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/Rules/`

Surge (`[Rule]`) and Shadowrocket (rule set):

```text
RULE-SET,https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/Rules/Anthropic/Anthropic.list,Proxy
```

Loon (`[Remote Rule]`):

```text
https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/Rules/Anthropic/Anthropic.list, policy=Proxy, tag=Anthropic
```

Clash / mihomo (`rule-providers`):

```yaml
rule-providers:
  anthropic:
    type: http
    behavior: classical
    format: yaml
    url: https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/Rules/Anthropic/Anthropic.yaml
    interval: 86400
    path: ./rules/Anthropic.yaml

rules:
  - RULE-SET,anthropic,Proxy
```

Egern (`rules`):

```yaml
rules:
  - rule_set:
      match: "https://raw.githubusercontent.com/27Aaron/ProxyRules/custom/Rules/Anthropic/Anthropic.egern.yaml"
      policy: Proxy
      update_interval: 86400
```

## Adding a Service

1. Create `Sources/<service>/<service>.list` with the rule syntax above
2. Add a display name to `DISPLAY_NAMES` in `scripts/convert.py` if the
   directory name does not read well as a title
3. Run `python3 scripts/convert.py`
4. Commit the new directory under both `Sources/` and `Rules/`

Keep one directory per service and do not merge lists — separate files let
each client bind a different policy per service.
