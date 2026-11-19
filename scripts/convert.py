#!/usr/bin/env python3
"""Generate subscription-ready rule files from hand-maintained source lists.

Sources of truth (hand-maintained, one per service):
    Sources/<service>/<service>.list

Generated files (never edit by hand):
    Rules/<service>/<service>.list          clean copy with stats header
    Rules/<service>/<service>.yaml          Clash rule-provider payload (behavior: classical)
    Rules/<service>/<service>.egern.yaml    Egern rule set

Every generated file starts with a blackmatrix7-style stats header:
    # NAME: Anthropic
    # AUTHOR: 27Aaron
    # REPO: https://github.com/27Aaron/ProxyRules
    # UPDATED: 2025-06-06 09:20:01
    # DOMAIN: 1
    # DOMAIN-SUFFIX: 2
    # TOTAL: 3

UPDATED reflects the source file's modification time, so re-running the
script without editing sources produces no diff.

Usage:
    python3 scripts/convert.py
"""

import os
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "Sources"
OUT_DIR = REPO_ROOT / "Rules"

AUTHOR = "27Aaron"
REPO = "https://github.com/27Aaron/ProxyRules"

DISPLAY_NAMES = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "apple-push": "Apple Push",
    "googlefcm": "Google FCM",
}

DOMAIN_SETS = {
    "DOMAIN": "domain_set",
    "DOMAIN-SUFFIX": "domain_suffix_set",
    "DOMAIN-KEYWORD": "domain_keyword_set",
    "DOMAIN-REGEX": "domain_regex_set",
}
IP_SETS = {
    "IP-CIDR": "ip_cidr_set",
    "IP-CIDR6": "ip_cidr6_set",
}
KNOWN_TYPES = DOMAIN_SETS | IP_SETS
TYPE_ORDER = ["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN-REGEX", "IP-CIDR", "IP-CIDR6"]
EGERN_ORDER = [
    "domain_set",
    "domain_suffix_set",
    "domain_keyword_set",
    "domain_regex_set",
    "ip_cidr_set",
    "ip_cidr6_set",
]


def parse_entries(lines, source):
    entries = []
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith(("#", "//", ";")):
            continue
        parts = [p.strip() for p in line.split(",")]
        rtype = parts[0].upper()
        if rtype not in KNOWN_TYPES:
            raise SystemExit(f"{source}:{lineno}: unsupported rule type '{parts[0]}'")
        if len(parts) < 2 or not parts[1]:
            raise SystemExit(f"{source}:{lineno}: missing value in '{line}'")
        extra = [p for p in parts[2:] if p]
        unknown = [p for p in extra if p != "no-resolve"]
        if unknown:
            raise SystemExit(f"{source}:{lineno}: unsupported option {unknown} in '{line}'")
        entries.append((rtype, parts[1], "no-resolve" in extra))
    if not entries:
        raise SystemExit(f"{source}: no rules found")
    return entries


def display_name(service):
    return DISPLAY_NAMES.get(service, service.replace("-", " ").title())


def stats_header(service, entries, source_mtime):
    counts = {}
    for rtype, _, _ in entries:
        counts[rtype] = counts.get(rtype, 0) + 1
    updated = datetime.fromtimestamp(source_mtime).strftime("%Y-%m-%d %H:%M:%S")
    out = [
        f"# NAME: {display_name(service)}",
        f"# AUTHOR: {AUTHOR}",
        f"# REPO: {REPO}",
        f"# UPDATED: {updated}",
    ]
    for rtype in TYPE_ORDER:
        if counts.get(rtype):
            out.append(f"# {rtype}: {counts[rtype]}")
    out.append(f"# TOTAL: {len(entries)}")
    return out


def generated_list(header, entries):
    out = list(header)
    out.extend(f"{rtype},{value}" + (",no-resolve" if no_resolve else "")
               for rtype, value, no_resolve in entries)
    return "\n".join(out) + "\n"


def clash_payload(header, entries):
    out = list(header)
    out.append("payload:")
    out.extend(f"  - {rtype},{value}" + (",no-resolve" if no_resolve else "")
               for rtype, value, no_resolve in entries)
    return "\n".join(out) + "\n"


def egern_set(header, entries):
    buckets = {}
    ip_total = 0
    ip_no_resolve = 0
    for rtype, value, no_resolve in entries:
        key = KNOWN_TYPES[rtype]
        buckets.setdefault(key, []).append(value)
        if rtype in IP_SETS:
            ip_total += 1
            if no_resolve:
                ip_no_resolve += 1

    out = list(header)
    for key in EGERN_ORDER:
        if key not in buckets:
            continue
        out.append(f"{key}:")
        out.extend(f"  - {value}" for value in buckets[key])
    if ip_total and ip_no_resolve == ip_total:
        out.append("no_resolve: true")
    elif ip_no_resolve:
        out.append(f"# note: {ip_no_resolve}/{ip_total} source IP rules used no-resolve;"
                   " add no_resolve: true here if wanted")
    return "\n".join(out) + "\n"


def main():
    updated = 0
    for list_path in sorted(SRC_DIR.glob("*/*.list")):
        source = list_path.relative_to(REPO_ROOT).as_posix()
        service = list_path.parent.name
        entries = parse_entries(list_path.read_text(encoding="utf-8").splitlines(), source)
        header = stats_header(service, entries, list_path.stat().st_mtime)

        out_dir = OUT_DIR / service
        out_dir.mkdir(parents=True, exist_ok=True)
        targets = {
            out_dir / f"{list_path.stem}.list": generated_list(header, entries),
            out_dir / f"{list_path.stem}.yaml": clash_payload(header, entries),
            out_dir / f"{list_path.stem}.egern.yaml": egern_set(header, entries),
        }
        for path, content in targets.items():
            if path.exists() and path.read_text(encoding="utf-8") == content:
                continue
            path.write_text(content, encoding="utf-8")
            print(f"updated {path.relative_to(REPO_ROOT)}")
            updated += 1
        print(f"{source}: {len(entries)} rules")
    print(f"done, {updated} file(s) updated")


if __name__ == "__main__":
    main()
