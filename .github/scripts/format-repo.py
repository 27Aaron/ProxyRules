#!/usr/bin/env python3
"""Format repo files for CI.

Handled:
  - *.md            → prettier
  - *.yaml / *.yml  → yamlfmt (+ strip !!merge for Clash)
  - *.list / *.conf → trim leading/trailing whitespace per line

Skipped directories (never walked):
  .git / .github / node_modules / result

Not handled (left as-is):
  *.js, *.sgmodule, LICENSE, and anything under .github/

Usage:
  python3 .github/scripts/format-repo.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

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
    """Walk repo, skip SKIP_DIR_NAMES, match filename suffixes."""
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for name in filenames:
            if any(name.endswith(s) for s in suffixes):
                out.append(Path(dirpath) / name)
    return sorted(out)


def format_markdown(root: Path) -> None:
    prettier = which("prettier")
    if not prettier:
        print("prettier not found, skip markdown", file=sys.stderr)
        return
    files = iter_files(root, (".md",))
    if not files:
        return
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
        original = path.read_text(encoding="utf-8")
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
        # Clash/Mihomo merge keys must stay as <<: not !!merge <<:
        text = proc.stdout.replace("!!merge <<:", "<<:")
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"yamlfmt {rel}")


def trim_list_conf(root: Path) -> None:
    """Strip per-line leading/trailing whitespace; ensure single trailing newline."""
    files = iter_files(root, (".list", ".conf"))
    for path in files:
        original = path.read_text(encoding="utf-8")
        lines = [line.strip() for line in original.splitlines()]
        while lines and lines[-1] == "":
            lines.pop()
        new = ("\n".join(lines) + "\n") if lines else ""
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
