#!/usr/bin/env python3
"""Validate files changed by automated repository maintenance."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ALLOWED_SUFFIXES = {".conf", ".list", ".md", ".yaml", ".yml"}


class MaintenanceDiffError(RuntimeError):
    """Raised when maintenance changed an unsupported path or file property."""


def run_git(*arguments: str) -> bytes:
    try:
        return subprocess.check_output(["git", *arguments], stderr=subprocess.PIPE)
    except (OSError, subprocess.CalledProcessError) as error:
        detail = ""
        if isinstance(error, subprocess.CalledProcessError):
            detail = error.stderr.decode("utf-8", errors="replace").strip()
        message = f"git {' '.join(arguments)} failed"
        raise MaintenanceDiffError(
            f"{message}: {detail}" if detail else message
        ) from error


def parse_changed_paths(data: bytes) -> list[Path]:
    fields = data.split(b"\0")
    if fields and fields[-1] == b"":
        fields.pop()
    if len(fields) % 2:
        raise MaintenanceDiffError("unexpected git name-status output")

    paths: list[Path] = []
    for index in range(0, len(fields), 2):
        status = fields[index].decode("ascii", errors="replace")
        raw_path = fields[index + 1]
        if status != "M":
            raise MaintenanceDiffError(
                f"maintenance attempted a {status!r} change"
            )
        try:
            value = raw_path.decode("utf-8")
        except UnicodeDecodeError as error:
            raise MaintenanceDiffError(
                "maintenance changed a non-UTF-8 path"
            ) from error
        paths.append(Path(value))
    return paths


def validate_path(path: Path) -> None:
    if path.is_absolute() or ".." in path.parts:
        raise MaintenanceDiffError(f"unsafe maintenance path: {path}")
    if path.parts and path.parts[0] == ".github":
        raise MaintenanceDiffError(f"maintenance must not modify .github: {path}")
    if path.suffix not in ALLOWED_SUFFIXES:
        raise MaintenanceDiffError(f"unexpected maintenance path: {path}")


def validate() -> list[Path]:
    paths = parse_changed_paths(
        run_git("diff", "--name-status", "--no-renames", "-z", "--")
    )
    for path in paths:
        validate_path(path)

    summary = run_git("diff", "--summary", "--").decode("utf-8").strip()
    if summary:
        raise MaintenanceDiffError(
            f"maintenance attempted a mode change:\n{summary}"
        )

    try:
        subprocess.check_call(["git", "diff", "--check", "--"])
    except (OSError, subprocess.CalledProcessError) as error:
        raise MaintenanceDiffError("maintenance diff check failed") from error
    return paths


def main() -> int:
    try:
        paths = validate()
    except MaintenanceDiffError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"validated {len(paths)} maintenance change(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
