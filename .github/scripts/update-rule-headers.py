#!/usr/bin/env python3
"""Refresh meta headers on Rules/*.list and Rules/*.yaml.

Smart mode (default): only rewrite a file when its *rule body* (content without
the meta header) changed vs HEAD~1. Avoids UPDATED-only churn.

Usage:
  python3 .github/scripts/update-rule-headers.py
  python3 .github/scripts/update-rule-headers.py --all
  python3 .github/scripts/update-rule-headers.py path/to/file.list
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

AUTHOR = "27Aaron"
REPO = "https://github.com/27Aaron/ProxyRules"

CLIENTS = ("Clash", "Surge", "Loon", "Shadowrocket")

TYPE_ORDER = [
    "DOMAIN",
    "DOMAIN-SUFFIX",
    "DOMAIN-KEYWORD",
    "DOMAIN-WILDCARD",
    "IP-CIDR",
    "IP-CIDR6",
    "GEOIP",
    "IP-ASN",
    "PROCESS-NAME",
    "URL-REGEX",
    "USER-AGENT",
    "SRC-IP",
    "DEST-PORT",
    "PROTOCOL",
]

HEADER_PREFIXES = (
    "# NAME:",
    "# AUTHOR:",
    "# REPO:",
    "# UPDATED:",
    "# TOTAL:",
)

RULE_TYPE_RE = re.compile(
    r"^(?:-\s*)?"
    r"(DOMAIN(?:-SUFFIX|-KEYWORD|-WILDCARD)?|IP-CIDR6?|GEOIP|IP-ASN|"
    r"PROCESS-NAME|URL-REGEX|USER-AGENT|SRC-IP|DEST-PORT|PROTOCOL)"
    r"\s*,",
    re.IGNORECASE,
)

COUNT_LINE_RE = re.compile(r"^# [A-Z][A-Z0-9-]*: \d+\s*$")


def repo_root() -> Path:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    # .github/scripts/ → repo root
    return Path(__file__).resolve().parents[2]


def is_header_line(line: str) -> bool:
    s = line.strip()
    if not s.startswith("#"):
        return False
    if s.startswith(HEADER_PREFIXES):
        return True
    return COUNT_LINE_RE.match(s) is not None


def strip_header(text: str) -> str:
    lines = text.splitlines()
    i = 0
    while i < len(lines) and (not lines[i].strip() or is_header_line(lines[i])):
        i += 1
    body = "\n".join(lines[i:])
    if body and not body.endswith("\n"):
        body += "\n"
    return body.lstrip("\n") if body.startswith("\n") else body


def body_hash(text: str) -> str:
    body = strip_header(text)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def rule_type(line: str) -> str | None:
    s = line.strip()
    if not s or s.startswith("#") or s == "payload:":
        return None
    if s.startswith("- "):
        s = s[2:].lstrip()
    m = RULE_TYPE_RE.match(s)
    return m.group(1).upper() if m else None


def count_types(body: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for line in body.splitlines():
        t = rule_type(line)
        if t:
            counts[t] += 1
    return counts


def ordered_types(counts: Counter[str]) -> list[str]:
    known = [t for t in TYPE_ORDER if counts.get(t)]
    extra = sorted(t for t in counts if t not in TYPE_ORDER)
    return known + extra


def build_header(name: str, counts: Counter[str], updated: str) -> str:
    total = sum(counts.values())
    lines = [
        f"# NAME: {name}",
        f"# AUTHOR: {AUTHOR}",
        f"# REPO: {REPO}",
        f"# UPDATED: {updated}",
    ]
    for t in ordered_types(counts):
        lines.append(f"# {t}: {counts[t]}")
    lines.append(f"# TOTAL: {total}")
    return "\n".join(lines) + "\n"


def with_header(name: str, text: str, updated: str) -> str:
    body = strip_header(text)
    header = build_header(name, count_types(body), updated)
    if body and not body.endswith("\n"):
        body += "\n"
    return header + "\n" + body


def git_show(rev_path: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "show", rev_path],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return None


def has_parent() -> bool:
    try:
        subprocess.check_call(
            ["git", "rev-parse", "--verify", "HEAD~1"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def iter_rule_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for client in CLIENTS:
        rules = root / client / "Rules"
        if not rules.is_dir():
            continue
        files.extend(sorted(rules.rglob("*.list")))
        files.extend(sorted(rules.rglob("*.yaml")))
    return files


def has_meta_header(text: str) -> bool:
    """True if file already has our generated header block."""
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        return s.startswith("# NAME:")
    return False


def process_file(path: Path, updated: str, force: bool, root: Path) -> str:
    """Returns: updated | unchanged | skip"""
    raw = path.read_text(encoding="utf-8")
    rel = path.relative_to(root).as_posix()
    name = path.stem

    need = force
    reason = "--all" if force else ""

    if not need:
        # First-time / stripped files: always write header once
        if not has_meta_header(raw):
            need, reason = True, "missing header"
        elif not has_parent():
            need, reason = True, "no HEAD~1"
        else:
            prev = git_show(f"HEAD~1:{rel}")
            if prev is None:
                need, reason = True, "new file"
            elif body_hash(prev) != body_hash(raw):
                need, reason = True, "body changed"

    if not need:
        return "skip"

    new_text = with_header(name, raw, updated)
    if new_text == raw:
        return "unchanged"

    path.write_text(new_text, encoding="utf-8")
    print(f"updated {rel} ({reason})")
    return "updated"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="regenerate headers for every rule file",
    )
    parser.add_argument("paths", nargs="*", help="optional rule file paths")
    args = parser.parse_args(argv[1:])

    root = repo_root()
    updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if args.paths:
        paths = [(root / p).resolve() if not Path(p).is_absolute() else Path(p) for p in args.paths]
    else:
        paths = iter_rule_files(root)

    if not paths:
        print("no rule files found", file=sys.stderr)
        return 1

    stats = {"updated": 0, "unchanged": 0, "skip": 0}
    for path in paths:
        if not path.is_file():
            print(f"skip missing: {path}", file=sys.stderr)
            continue
        status = process_file(path, updated, args.all, root)
        stats[status] = stats.get(status, 0) + 1
        if status == "skip":
            print(f"skip {path.relative_to(root)} (rule body unchanged vs HEAD~1)")
        elif status == "unchanged":
            print(f"unchanged {path.relative_to(root)}")

    print(
        f"done: updated={stats['updated']} "
        f"unchanged={stats['unchanged']} skip={stats['skip']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
