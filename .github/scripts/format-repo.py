#!/usr/bin/env python3
"""Format repo files for CI.

Handled:
  - *.md            → prettier
  - *.yaml / *.yml  → yamlfmt
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
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

SKIP_DIR_NAMES = {".git", ".github", "node_modules", "result"}


class FormattingError(RuntimeError):
    """Raised when the repository cannot be formatted completely."""


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


def read_utf8(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as file:
        return file.read()


def write_utf8_lf(path: Path, text: str) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(text)


def is_ci(environ: Mapping[str, str] | None = None) -> bool:
    """Return whether the process is running in a CI environment."""
    source = environ if environ is not None else os.environ
    value = source.get("CI", "")
    return value.lower() not in {"", "0", "false", "no"}


def resolve_formatters(
    names: Sequence[str],
    *,
    ci: bool | None = None,
    finder: Callable[[str], str | None] = which,
) -> dict[str, str | None]:
    """Resolve formatter executables, requiring all of them in CI."""
    paths = {name: finder(name) for name in names}
    missing = [name for name, path in paths.items() if path is None]
    if not missing:
        return paths

    ci_mode = is_ci() if ci is None else ci
    if ci_mode:
        joined = ", ".join(missing)
        raise FormattingError(f"required formatter(s) not found in CI: {joined}")

    for name in missing:
        print(f"{name} not found, skip {name} formatting", file=sys.stderr)
    return paths


def iter_files(root: Path, suffixes: tuple[str, ...]) -> list[Path]:
    """Walk repo, skip SKIP_DIR_NAMES, match filename suffixes."""
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for name in filenames:
            if any(name.endswith(s) for s in suffixes):
                path = Path(dirpath) / name
                if path.is_symlink():
                    relative = path.relative_to(root)
                    raise FormattingError(
                        f"refusing to format symbolic link: {relative}"
                    )
                out.append(path)
    return sorted(out)


def format_markdown(
    root: Path,
    prettier: str | None,
    *,
    runner: Callable[..., None] = run,
) -> None:
    if not prettier:
        return
    files = iter_files(root, (".md",))
    if not files:
        return
    chunk = 50
    for i in range(0, len(files), chunk):
        batch = files[i : i + chunk]
        runner(
            [
                prettier,
                "--write",
                "--no-config",
                "--no-editorconfig",
                "--ignore-path=/dev/null",
                "--prose-wrap",
                "preserve",
                "--",
                *[str(p.relative_to(root)) for p in batch],
            ],
            cwd=root,
        )


def format_yaml(
    root: Path,
    yamlfmt: str | None,
    *,
    require_config: bool = False,
    process_runner: Callable[..., Any] = subprocess.run,
) -> None:
    if not yamlfmt:
        return
    files = iter_files(root, (".yaml", ".yml"))
    if not files:
        return

    conf = root / ".github" / "yamlfmt.yml"
    if conf.is_symlink():
        raise FormattingError("yamlfmt config must not be a symbolic link")
    if require_config and not conf.is_file():
        raise FormattingError(f"required yamlfmt config not found: {conf}")
    conf_args = ["-conf", str(conf)] if conf.is_file() else []

    formatted: list[tuple[Path, str, str]] = []
    failures: list[str] = []
    for path in files:
        rel = path.relative_to(root)
        original = read_utf8(path)
        try:
            proc = process_runner(
                [yamlfmt, *conf_args, "-"],
                input=original,
                text=True,
                capture_output=True,
                cwd=root,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            failures.append(f"{rel}: {exc}")
            continue
        if proc.returncode != 0:
            detail = proc.stderr.strip()
            message = f"{rel} (exit {proc.returncode})"
            failures.append(f"{message}: {detail}" if detail else message)
            continue
        formatted.append((path, original, proc.stdout))

    if failures:
        details = "\n  ".join(failures)
        raise FormattingError(
            f"yamlfmt failed; no YAML files were changed:\n  {details}"
        )

    for path, original, text in formatted:
        if text == original:
            continue
        write_utf8_lf(path, text)
        print(f"yamlfmt {path.relative_to(root)}")


def trim_list_conf(root: Path) -> None:
    """Strip per-line leading/trailing whitespace; ensure single trailing newline."""
    files = iter_files(root, (".list", ".conf"))
    for path in files:
        original = read_utf8(path)
        lines = [line.strip() for line in original.splitlines()]
        while lines and lines[-1] == "":
            lines.pop()
        new = ("\n".join(lines) + "\n") if lines else ""
        if new != original:
            write_utf8_lf(path, new)
            print(f"trim {path.relative_to(root)}")


def main() -> int:
    root = repo_root()
    os.chdir(root)
    print(f"format-repo root={root}")
    try:
        ci_mode = is_ci()
        formatters = resolve_formatters(("prettier", "yamlfmt"), ci=ci_mode)
        format_markdown(root, formatters["prettier"])
        format_yaml(
            root,
            formatters["yamlfmt"],
            require_config=ci_mode,
        )
        trim_list_conf(root)
    except (FormattingError, OSError, subprocess.SubprocessError) as exc:
        print(f"format-repo failed: {exc}", file=sys.stderr)
        return 1
    print("format-repo done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
