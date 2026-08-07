# Custom Rules

Manually maintained rules that supplement upstream geosite and GeoIP data.

Files in this branch are source rules rather than generated artifacts. The update
workflow merges them with matching upstream categories, removes duplicates, and
publishes ready-to-use files to the
[`rules`](https://github.com/27Aaron/ProxyRules/tree/rules) branch.

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

## Generated Files

The generated `rules` branch contains:

- `geosite/`: domain rules in `.list`, `.yaml`, `.mrs`, and `.srs` formats.
- `geoip/`: IP rules in `.list`, `.yaml`, `.mrs`, and `.srs` formats.
- `ruleset/`: combined domain and IP rules in `.list`, `.yaml`, and `.srs`
  formats.

Use the generated [`rules`](https://github.com/27Aaron/ProxyRules/tree/rules)
branch when configuring proxy clients.
