#!/usr/bin/env python3
"""Format repo files for CI (no local Nix required).

- Markdown: prettier
- YAML: yamlfmt + undo !!merge (Clash needs <<:)
- .list / .conf: strip leading & trailing whitespace per line

Usage:
  python3 .github/scripts/format-repo.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CLIENTS = ("Clash", "Surge", "Loon", "Shadowrocket")
SKIP_DIR_NAMES = {".git", ".github", "node_modules", "result"}


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
    return Path(__file__).resolve().parents[2]


def which(cmd: str) -> str | None:
    return shutil.which(cmd)


def run(cmd: list[str], **kwargs) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, **kwargs)


def iter_files(root: Path, suffixes: tuple[str, ...]) -> list[Path]:
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix.lower() in suffixes or name.endswith(suffixes):
                # suffix check: .yaml .yml .md .list .conf
                if any(name.endswith(s) for s in suffixes):
                    out.append(p)
    return sorted(out)


def format_markdown(root: Path) -> None:
    prettier = which("prettier")
    if not prettier:
        print("prettier not found, skip markdown", file=sys.stderr)
        return
    files = iter_files(root, (".md",))
    if not files:
        return
    # batch to avoid huge argv
    chunk = 50
    for i in range(0, len(files), chunk):
        batch = files[i : i + chunk]
        run(
            [
                prettier,
                "--write",
                "--prose-wrap",
                "preserve",
                *[str(p.relative_to(root)) for p in batch],
            ],
            cwd=root,
        )


def format_yaml(root: Path) -> None:
    yamlfmt = which("yamlfmt")
    if not yamlfmt:
        print("yamlfmt not found, skip yaml", file=sys.stderr)
        return
    files = iter_files(root, (".yaml", ".yml"))
    if not files:
        return

    conf = root / ".github" / "yamlfmt.yml"
    conf_args = ["-conf", str(conf)] if conf.is_file() else []

    for path in files:
        rel = path.relative_to(root)
        with path.open("r", encoding="utf-8") as f:
            original = f.read()
        proc = subprocess.run(
            [yamlfmt, *conf_args, "-"],
            input=original,
            text=True,
            capture_output=True,
            cwd=root,
            check=False,
        )
        if proc.returncode != 0:
            print(f"yamlfmt failed on {rel}: {proc.stderr}", file=sys.stderr)
            continue
        text = proc.stdout.replace("!!merge <<:", "<<:")
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"yamlfmt {rel}")


def trim_list_conf(root: Path) -> None:
    files = iter_files(root, (".list", ".conf"))
    for path in files:
        original = path.read_text(encoding="utf-8")
        lines = []
        for line in original.splitlines():
            lines.append(line.strip())  # leading + trailing ws
        # drop trailing empty lines then one final newline
        while lines and lines[-1] == "":
            lines.pop()
        new = "\n".join(lines) + ("\n" if lines or original.endswith("\n") else "")
        if lines:
            new = "\n".join(lines) + "\n"
        else:
            new = ""
        if new != original:
            path.write_text(new, encoding="utf-8")
            print(f"trim {path.relative_to(root)}")


def main() -> int:
    root = repo_root()
    os.chdir(root)
    print(f"format-repo root={root}")
    format_markdown(root)
    format_yaml(root)
    trim_list_conf(root)
    print("format-repo done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
