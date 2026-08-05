#!/usr/bin/env python3
"""Refresh metadata headers on client Config files.

Walks each client's ``Config/`` tree for ``.conf`` / ``.yaml`` / ``.yml``
(including nested paths such as Surge/Config/iOS/). README and other files
are left untouched.

Usage:
  python3 .github/scripts/update-config-headers.py
  python3 .github/scripts/update-config-headers.py --base <revision>
  python3 .github/scripts/update-config-headers.py --all
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RULES_SCRIPT = SCRIPT_DIR / "update-rule-headers.py"
SPEC = importlib.util.spec_from_file_location("update_rule_headers", RULES_SCRIPT)
assert SPEC is not None and SPEC.loader is not None
urh = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(urh)

CONFIG_EXTENSIONS = {".conf", ".yaml", ".yml"}
AUTHOR_LINE_RE = re.compile(r"^#\s*AUTHOR\s*:", re.IGNORECASE)


class InvalidConfigPath(ValueError):
    """Raised when a path is not under a managed Config tree."""


def build_config_header(relative_path: str, updated: str) -> str:
    lines = [
        urh.SEPARATOR_LINE,
        f"# AUTHOR: {urh.AUTHOR}",
        f"# UPDATED: {updated}",
        f"# REPO: {urh.REPO}",
        f"# LINK: {urh.file_link(relative_path)}",
        urh.SEPARATOR_LINE,
    ]
    return "\n".join(lines) + "\n"


def with_config_header(text: str, updated: str, relative_path: str) -> str:
    body = urh.strip_header(text)
    header = build_config_header(relative_path, updated)
    if body and not body.endswith("\n"):
        body += "\n"
    return header + "\n" + body


def has_config_meta_header(text: str) -> bool:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if not urh.is_header_line(stripped):
            return False
        if AUTHOR_LINE_RE.match(stripped):
            return True
    return False


def iter_config_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for client in urh.CLIENTS:
        config_dir = root / client / "Config"
        if not config_dir.is_dir():
            continue
        for path in sorted(config_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in CONFIG_EXTENSIONS:
                files.append(path)
    return files


def resolve_config_path(path: str | Path, root: Path) -> Path:
    root = root.resolve()
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = root / candidate
    if candidate.is_symlink():
        raise InvalidConfigPath(f"symbolic links are not managed: {path}")
    candidate = candidate.resolve()
    try:
        relative = candidate.relative_to(root)
    except ValueError as exc:
        raise InvalidConfigPath(f"path is outside repository: {path}") from exc

    parts = relative.parts
    if (
        len(parts) < 3
        or parts[0] not in urh.CLIENTS
        or parts[1] != "Config"
        or candidate.suffix.lower() not in CONFIG_EXTENSIONS
    ):
        raise InvalidConfigPath(f"path is not a managed config file: {relative}")
    return candidate


def process_config_file(
    path: Path,
    updated: str,
    force: bool,
    root: Path,
    base: str | None = None,
    *,
    history_fallback: bool = False,
) -> str:
    raw = urh.read_utf8(path)
    relative = path.relative_to(root).as_posix()
    previous_updated = urh.existing_updated(raw)
    reason = ""

    if force:
        refresh_updated = True
        reason = "--all"
    elif not has_config_meta_header(raw):
        refresh_updated = True
        reason = "missing header"
    elif base is not None:
        previous = urh.git_show(base, relative, root)
        if previous is None:
            refresh_updated = True
            reason = "new file"
        elif urh.body_hash(previous) != urh.body_hash(raw):
            refresh_updated = True
            reason = "body changed"
        elif previous_updated is None:
            refresh_updated = True
            reason = "missing or invalid UPDATED"
        elif history_fallback:
            last_updated = urh.git_last_semantic_updated(relative, root)
            if last_updated is None:
                refresh_updated = True
                reason = "header history unavailable"
            elif urh.body_hash(last_updated) != urh.body_hash(raw):
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
    if header_updated is None:
        header_updated = updated
    new_text = with_config_header(raw, header_updated, relative)

    if new_text == raw:
        return "unchanged" if force else "skip"

    urh.write_utf8_lf(path, new_text)
    print(f"updated {relative} ({reason or 'metadata repaired'})")
    return "updated"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="regenerate every config header and refresh UPDATED",
    )
    parser.add_argument(
        "--base",
        metavar="REVISION",
        help=f"compare bodies with REVISION (default: {urh.DEFAULT_BASE})",
    )
    parser.add_argument("paths", nargs="*", help="optional config file paths")
    args = parser.parse_args(argv[1:])

    root = urh.repo_root().resolve()
    updated = datetime.now().strftime(urh.TIMESTAMP_FORMAT)

    try:
        base = urh.resolve_base(
            args.base,
            explicit=args.base is not None,
            root=root,
        )
        if args.paths:
            paths = [resolve_config_path(path, root) for path in args.paths]
        else:
            paths = [
                resolve_config_path(path, root) for path in iter_config_files(root)
            ]
    except (urh.InvalidBaseRevision, InvalidConfigPath) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not paths:
        print("no config files found", file=sys.stderr)
        return 1

    stats = {"updated": 0, "unchanged": 0, "skip": 0}
    missing = 0
    history_fallback = args.base is not None and base is not None
    for path in paths:
        if not path.is_file():
            print(f"skip missing: {path}", file=sys.stderr)
            missing += 1
            continue
        status = process_config_file(
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
