#!/usr/bin/env python3
"""Refresh canonical metadata headers on rule files.

By default, rule bodies are compared with ``HEAD~1``. Pass ``--base`` in CI
to compare with the commit before the push instead, including pushes that
contain multiple commits. Metadata is repaired on every run, while the
existing ``UPDATED`` value is preserved when the rule body did not change.

Usage:
  python3 .github/scripts/update-rule-headers.py
  python3 .github/scripts/update-rule-headers.py --base <revision>
  python3 .github/scripts/update-rule-headers.py --all
  python3 .github/scripts/update-rule-headers.py Clash/Rules/Foo/Foo.list
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
DEFAULT_BRANCH = "main"
DEFAULT_BASE = "HEAD~1"
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"

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

CORE_METADATA_RE = re.compile(
    r"^#\s*(?:NAME|AUTHOR|REPO|LINK|UPDATED|TOTAL)(?:\s*:|\s|$)",
    re.IGNORECASE,
)
TYPE_METADATA_RE = re.compile(
    r"^#\s*(?:"
    + "|".join(re.escape(rule_type) for rule_type in TYPE_ORDER)
    + r")\s*:",
    re.IGNORECASE,
)
NAME_LINE_RE = re.compile(r"^#\s*NAME\s*:", re.IGNORECASE)
UPDATED_LINE_RE = re.compile(r"^# UPDATED: (.+)$")
COUNT_LINE_RE = re.compile(r"^# [A-Z][A-Z0-9-]*: \d+\s*$")
# Decorative ban around the metadata block, e.g. "# -----------------------------------------------------"
SEPARATOR_RE = re.compile(r"^#\s*-{3,}\s*$")
SEPARATOR_LINE = "# -----------------------------------------------------"
ZERO_REVISION_RE = re.compile(r"0+")

RULE_TYPE_RE = re.compile(
    r"^(?:-\s*)?"
    r"(DOMAIN(?:-SUFFIX|-KEYWORD|-WILDCARD)?|IP-CIDR6?|GEOIP|IP-ASN|"
    r"PROCESS-NAME|URL-REGEX|USER-AGENT|SRC-IP|DEST-PORT|PROTOCOL)"
    r"\s*,",
    re.IGNORECASE,
)


class InvalidBaseRevision(ValueError):
    """Raised when an explicitly requested Git base cannot be resolved."""


class InvalidRulePath(ValueError):
    """Raised when a requested path is outside the managed rule trees."""


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
    # .github/scripts/ -> repo root
    return Path(__file__).resolve().parents[2]


def read_utf8(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as file:
        return file.read()


def write_utf8_lf(path: Path, text: str) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(text)


def is_header_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("#"):
        return False
    return bool(
        SEPARATOR_RE.match(stripped)
        or CORE_METADATA_RE.match(stripped)
        or TYPE_METADATA_RE.match(stripped)
        or COUNT_LINE_RE.match(stripped)
    )


def strip_header(text: str) -> str:
    lines = text.splitlines()
    index = 0
    while index < len(lines) and (
        not lines[index].strip() or is_header_line(lines[index])
    ):
        index += 1
    body = "\n".join(lines[index:])
    if body and not body.endswith("\n"):
        body += "\n"
    return body.lstrip("\n") if body.startswith("\n") else body


def body_hash(text: str) -> str:
    body = strip_header(text)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def rule_type(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or stripped == "payload:":
        return None
    if stripped.startswith("- "):
        stripped = stripped[2:].lstrip()
    match = RULE_TYPE_RE.match(stripped)
    return match.group(1).upper() if match else None


def count_types(body: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for line in body.splitlines():
        detected_type = rule_type(line)
        if detected_type:
            counts[detected_type] += 1
    return counts


def ordered_types(counts: Counter[str]) -> list[str]:
    known = [rule_type for rule_type in TYPE_ORDER if counts.get(rule_type)]
    extra = sorted(rule_type for rule_type in counts if rule_type not in TYPE_ORDER)
    return known + extra


def file_link(relative_path: str, branch: str = DEFAULT_BRANCH) -> str:
    """Pretty GitHub raw URL for a path inside this repository."""
    rel = relative_path.replace("\\", "/").lstrip("/")
    return f"{REPO}/raw/refs/heads/{branch}/{rel}"


def build_header(
    name: str,
    counts: Counter[str],
    updated: str,
    relative_path: str,
) -> str:
    total = sum(counts.values())
    lines = [
        SEPARATOR_LINE,
        f"# NAME: {name}",
        f"# AUTHOR: {AUTHOR}",
        f"# UPDATED: {updated}",
        f"# REPO: {REPO}",
        f"# LINK: {file_link(relative_path)}",
    ]
    for detected_type in ordered_types(counts):
        lines.append(f"# {detected_type}: {counts[detected_type]}")
    lines.append(f"# TOTAL: {total}")
    lines.append(SEPARATOR_LINE)
    return "\n".join(lines) + "\n"


def with_header(
    name: str,
    text: str,
    updated: str,
    relative_path: str | None = None,
) -> str:
    if relative_path is None:
        relative_path = f"Clash/Rules/{name}/{name}.list"
    body = strip_header(text)
    header = build_header(name, count_types(body), updated, relative_path)
    if body and not body.endswith("\n"):
        body += "\n"
    return header + "\n" + body


def has_meta_header(text: str) -> bool:
    """Return whether the leading metadata block contains a NAME field."""
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not is_header_line(stripped):
            return False
        if NAME_LINE_RE.match(stripped):
            return True
    return False


def existing_updated(text: str) -> str | None:
    """Read a canonical timestamp from the leading metadata block."""
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not is_header_line(stripped):
            break
        match = UPDATED_LINE_RE.fullmatch(stripped)
        if not match:
            continue
        value = match.group(1)
        try:
            parsed = datetime.strptime(value, TIMESTAMP_FORMAT)
        except ValueError:
            return None
        return value if parsed.strftime(TIMESTAMP_FORMAT) == value else None
    return None


def git_revision_exists(revision: str, root: Path | None = None) -> bool:
    if revision.startswith("-"):
        return False
    try:
        subprocess.check_call(
            [
                "git",
                "rev-parse",
                "--verify",
                "--end-of-options",
                f"{revision}^{{commit}}",
            ],
            cwd=root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def resolve_base(
    requested: str | None,
    *,
    explicit: bool,
    root: Path | None = None,
) -> str | None:
    """Resolve the comparison base, allowing an empty/all-zero push sentinel."""
    if requested is not None:
        revision = requested.strip()
        if not revision or ZERO_REVISION_RE.fullmatch(revision):
            return None
    else:
        revision = DEFAULT_BASE

    if git_revision_exists(revision, root):
        return revision
    if explicit:
        raise InvalidBaseRevision(f"base revision does not exist: {revision}")
    return None


def git_show(
    base: str,
    relative_path: str,
    root: Path | None = None,
) -> str | None:
    try:
        output = subprocess.check_output(
            ["git", "show", f"{base}:{relative_path}"],
            cwd=root,
            stderr=subprocess.DEVNULL,
        )
        return output.decode("utf-8")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def git_updated_revisions(
    relative_path: str,
    root: Path | None = None,
) -> list[str]:
    """Return revisions whose diff touched the file's UPDATED line."""
    try:
        output = subprocess.check_output(
            [
                "git",
                "log",
                "--follow",
                "--format=%H",
                "-G",
                r"^# UPDATED:",
                "--",
                relative_path,
            ],
            cwd=root,
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return [revision for revision in output.splitlines() if revision]
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def git_last_semantic_updated(
    relative_path: str,
    root: Path | None = None,
) -> str | None:
    """Return the file at its newest semantic UPDATED timestamp change."""
    for revision in git_updated_revisions(relative_path, root):
        after = git_show(revision, relative_path, root)
        before = git_show(f"{revision}^", relative_path, root)
        if after is None or before is None:
            return None
        if existing_updated(after) != existing_updated(before):
            return after
    return None


def iter_rule_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for client in CLIENTS:
        rules = root / client / "Rules"
        if not rules.is_dir():
            continue
        files.extend(sorted(rules.rglob("*.list")))
        files.extend(sorted(rules.rglob("*.yaml")))
    return files


def resolve_rule_path(path: str | Path, root: Path) -> Path:
    root = root.resolve()
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = root / candidate
    if candidate.is_symlink():
        raise InvalidRulePath(f"symbolic links are not managed rule files: {path}")
    candidate = candidate.resolve()

    try:
        relative = candidate.relative_to(root)
    except ValueError as exc:
        raise InvalidRulePath(f"path is outside repository: {path}") from exc

    parts = relative.parts
    if (
        len(parts) < 3
        or parts[0] not in CLIENTS
        or parts[1] != "Rules"
        or candidate.suffix not in {".list", ".yaml"}
    ):
        raise InvalidRulePath(f"path is not a managed rule file: {relative}")
    return candidate


def process_file(
    path: Path,
    updated: str,
    force: bool,
    root: Path,
    base: str | None = None,
    *,
    history_fallback: bool = False,
) -> str:
    """Canonicalize one rule file. Return updated, unchanged, or skip."""
    raw = read_utf8(path)
    relative = path.relative_to(root).as_posix()
    previous_updated = existing_updated(raw)
    reason = ""

    if force:
        refresh_updated = True
        reason = "--all"
    elif not has_meta_header(raw):
        refresh_updated = True
        reason = "missing header"
    elif base is not None:
        previous = git_show(base, relative, root)
        if previous is None:
            refresh_updated = True
            reason = "new file"
        elif body_hash(previous) != body_hash(raw):
            refresh_updated = True
            reason = "body changed"
        elif previous_updated is None:
            refresh_updated = True
            reason = "missing or invalid UPDATED"
        elif history_fallback:
            last_updated = git_last_semantic_updated(relative, root)
            if last_updated is None:
                refresh_updated = True
                reason = "header history unavailable"
            elif body_hash(last_updated) != body_hash(raw):
                refresh_updated = True
                reason = "body changed since last header update"
            else:
                refresh_updated = False
        else:
            refresh_updated = False
    elif previous_updated is None:
        refresh_updated = True
        reason = "missing or invalid UPDATED"
    else:
        refresh_updated = False

    header_updated = updated if refresh_updated else previous_updated
    if header_updated is None:  # Kept explicit for type checkers and future edits.
        header_updated = updated
    new_text = with_header(path.stem, raw, header_updated, relative)

    if new_text == raw:
        return "unchanged" if force else "skip"

    write_utf8_lf(path, new_text)
    print(f"updated {relative} ({reason or 'metadata repaired'})")
    return "updated"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="regenerate every header and refresh its UPDATED timestamp",
    )
    parser.add_argument(
        "--base",
        metavar="REVISION",
        help=f"compare rule bodies with REVISION (default: {DEFAULT_BASE})",
    )
    parser.add_argument("paths", nargs="*", help="optional rule file paths")
    args = parser.parse_args(argv[1:])

    root = repo_root().resolve()
    updated = datetime.now().strftime(TIMESTAMP_FORMAT)

    try:
        base = resolve_base(
            args.base,
            explicit=args.base is not None,
            root=root,
        )
        if args.paths:
            paths = [resolve_rule_path(path, root) for path in args.paths]
        else:
            paths = [resolve_rule_path(path, root) for path in iter_rule_files(root)]
    except (InvalidBaseRevision, InvalidRulePath) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not paths:
        print("no rule files found", file=sys.stderr)
        return 1

    stats = {"updated": 0, "unchanged": 0, "skip": 0}
    missing = 0
    history_fallback = args.base is not None and base is not None
    for path in paths:
        if not path.is_file():
            print(f"skip missing: {path}", file=sys.stderr)
            missing += 1
            continue
        status = process_file(
            path,
            updated,
            args.all,
            root,
            base,
            history_fallback=history_fallback,
        )
        stats[status] += 1
        relative = path.relative_to(root)
        if status == "skip":
            print(f"skip {relative} (canonical header unchanged)")
        elif status == "unchanged":
            print(f"unchanged {relative}")

    print(
        f"done: updated={stats['updated']} "
        f"unchanged={stats['unchanged']} skip={stats['skip']}"
    )
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
