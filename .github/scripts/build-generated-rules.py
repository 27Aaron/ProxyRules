#!/usr/bin/env python3
"""Package converted geosite data for the generated ``rules`` branch.

The input directories are produced by MetaCubeX/meta-rules-converter. The
converter's root directory contains Mihomo ``domain`` behavior rule sets,
while ``classical`` contains the representation used for the portable text
and YAML files published by this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


SCHEMA_VERSION = 1
CATEGORY_RE = re.compile(r"^[a-z0-9][a-z0-9!@._-]*$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SEPARATOR = "# -----------------------------------------------------"
PUBLISHED_CLASSICAL_TYPES = {"DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"}
UNSUPPORTED_CLASSICAL_TYPES = {"DOMAIN-REGEX"}


class GenerationError(RuntimeError):
    """Raised when converted rules are incomplete or unsafe to publish."""


@dataclass(frozen=True)
class BuildOptions:
    domain_dir: Path
    classical_dir: Path
    output_dir: Path
    previous_dir: Path | None
    repository: str
    branch: str
    author: str
    source_repository: str
    source_release: str
    source_commit: str
    source_published_at: str
    converter_repository: str
    converter_commit: str
    minimum_categories: int
    required_categories: tuple[str, ...]
    aliases: tuple[tuple[str, str], ...]
    max_category_drop_percent: float
    allow_large_drop: bool


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def read_text(path: Path) -> str:
    if path.is_symlink():
        raise GenerationError(f"symbolic links are not accepted: {path}")
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise GenerationError(f"rule file is not valid UTF-8: {path}") from error


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(text)


def normalize_timestamp(value: str) -> str:
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as error:
        raise GenerationError(f"invalid source timestamp: {value}") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def display_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def validate_category(name: str) -> None:
    if (
        not CATEGORY_RE.fullmatch(name)
        or ".." in name
        or name.endswith(".")
        or name.startswith(".")
    ):
        raise GenerationError(f"unsafe category name: {name!r}")


def validate_domain_value(value: str, path: Path) -> None:
    candidate = value[2:] if value.startswith("+.") else value
    if not candidate or len(candidate) > 253:
        raise GenerationError(f"invalid domain value in {path}: {value!r}")
    for label in candidate.split("."):
        if (
            not label
            or len(label) > 63
            or label.startswith("-")
            or label.endswith("-")
            or any(
                not (char.isascii() and (char.isalnum() or char == "-"))
                for char in label
            )
        ):
            raise GenerationError(f"invalid domain value in {path}: {value!r}")


def parse_domain_rules(path: Path) -> list[str]:
    rules: list[str] = []
    seen: set[str] = set()
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        rule = raw_line.strip()
        if not rule:
            continue
        if rule.startswith("#"):
            raise GenerationError(f"unexpected comment in {path}:{line_number}")
        validate_domain_value(rule, path)
        if rule in seen:
            raise GenerationError(f"duplicate rule in {path}:{line_number}: {rule}")
        seen.add(rule)
        rules.append(rule)
    return rules


def parse_classical_rules(
    path: Path,
) -> tuple[list[str], list[str], dict[str, int]]:
    domain_behavior: list[str] = []
    portable_classical: list[str] = []
    counts = {
        "DOMAIN": 0,
        "DOMAIN-SUFFIX": 0,
        "DOMAIN-KEYWORD": 0,
        "DOMAIN-REGEX": 0,
    }
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        rule_type, separator, value = line.partition(",")
        if not separator or rule_type not in counts or not value:
            raise GenerationError(
                f"unsupported classical rule in {path}:{line_number}: {line!r}"
            )
        counts[rule_type] += 1
        if rule_type == "DOMAIN":
            domain_behavior.append(value)
        elif rule_type == "DOMAIN-SUFFIX":
            domain_behavior.append(f"+.{value}")
        if rule_type in PUBLISHED_CLASSICAL_TYPES:
            portable_classical.append(line)
    return domain_behavior, portable_classical, counts


def load_previous_categories(
    previous_dir: Path | None,
) -> dict[str, dict[str, object]]:
    if previous_dir is None:
        return {}
    manifest_path = previous_dir / "manifest.json"
    if not manifest_path.is_file():
        return {}
    try:
        manifest = json.loads(read_text(manifest_path))
    except json.JSONDecodeError as error:
        raise GenerationError(f"invalid previous manifest: {manifest_path}") from error
    categories = manifest.get("categories", {})
    if not isinstance(categories, dict):
        raise GenerationError("previous manifest categories must be an object")
    return {
        str(name): value
        for name, value in categories.items()
        if isinstance(name, str) and isinstance(value, dict)
    }


def yaml_scalar(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_header(
    *,
    name: str,
    author: str,
    repository: str,
    branch: str,
    relative_path: str,
    source_repository: str,
    updated: str,
    counts: dict[str, int],
) -> str:
    lines = [
        SEPARATOR,
        f"# NAME: {name}",
        f"# AUTHOR: {author}",
        f"# UPDATED: {display_timestamp(updated)}",
        f"# REPO: https://github.com/{repository}",
        f"# LINK: https://raw.githubusercontent.com/{repository}/{branch}/{relative_path}",
        f"# SOURCE: https://github.com/{source_repository}",
    ]
    for rule_type in (
        "DOMAIN",
        "DOMAIN-SUFFIX",
        "DOMAIN-KEYWORD",
        "DOMAIN-REGEX",
    ):
        count = counts[rule_type]
        if count and rule_type in UNSUPPORTED_CLASSICAL_TYPES:
            lines.append(f"# OMITTED-{rule_type}: {count}")
        elif count:
            lines.append(f"# {rule_type}: {count}")
    portable_total = sum(counts[rule_type] for rule_type in PUBLISHED_CLASSICAL_TYPES)
    lines.extend((f"# TOTAL: {portable_total}", SEPARATOR))
    return "\n".join(lines) + "\n"


def render_rule_file(header: str, rules: Iterable[str]) -> str:
    body = "\n".join(rules)
    return header + "\n" + body + ("\n" if body else "")


def render_yaml_file(header: str, rules: Iterable[str]) -> str:
    rendered = ["payload:"]
    rendered.extend(f"  - {yaml_scalar(rule)}" for rule in rules)
    return header + "\n" + "\n".join(rendered) + "\n"


def check_large_drop(
    previous_categories: dict[str, dict[str, object]],
    current_count: int,
    maximum_percent: float,
    allow: bool,
) -> None:
    previous_count = len(previous_categories)
    if allow or previous_count == 0 or current_count >= previous_count:
        return
    drop_percent = ((previous_count - current_count) / previous_count) * 100
    if drop_percent > maximum_percent:
        raise GenerationError(
            "generated category count dropped "
            f"from {previous_count} to {current_count} ({drop_percent:.2f}%), "
            f"exceeding the {maximum_percent:.2f}% safety limit"
        )


def build(options: BuildOptions) -> dict[str, object]:
    if not COMMIT_RE.fullmatch(options.source_commit):
        raise GenerationError("source commit must be a lowercase 40-character SHA")
    if not COMMIT_RE.fullmatch(options.converter_commit):
        raise GenerationError("converter commit must be a lowercase 40-character SHA")
    if options.output_dir.is_symlink():
        raise GenerationError(
            f"output directory must not be a symbolic link: {options.output_dir}"
        )
    if options.output_dir.exists() and any(options.output_dir.iterdir()):
        raise GenerationError(f"output directory must be empty: {options.output_dir}")
    options.output_dir.mkdir(parents=True, exist_ok=True)
    if not options.domain_dir.is_dir() or not options.classical_dir.is_dir():
        raise GenerationError("converted domain and classical directories are required")

    published_at = normalize_timestamp(options.source_published_at)
    previous_categories = load_previous_categories(options.previous_dir)
    domain_paths = sorted(options.domain_dir.glob("*.list"), key=lambda path: path.name)
    if len(domain_paths) < options.minimum_categories:
        raise GenerationError(
            f"found only {len(domain_paths)} source categories; "
            f"minimum is {options.minimum_categories}"
        )

    source_names = {path.stem for path in domain_paths}
    aliases_by_source: dict[str, list[str]] = {}
    alias_map: dict[str, str] = {}
    for alias, source in options.aliases:
        validate_category(alias)
        validate_category(source)
        if alias in source_names:
            raise GenerationError(f"alias conflicts with source category: {alias}")
        if alias in alias_map:
            raise GenerationError(f"duplicate alias: {alias}")
        if source not in source_names:
            raise GenerationError(f"alias source category is missing: {source}")
        alias_map[alias] = source
        aliases_by_source.setdefault(source, []).append(alias)

    categories: dict[str, dict[str, object]] = {}
    omitted_categories: dict[str, dict[str, int]] = {}
    source_portable_rule_total = 0
    published_rule_total = 0
    omitted_rule_total = 0

    for domain_path in domain_paths:
        name = domain_path.stem
        validate_category(name)
        converter_yaml = options.domain_dir / f"{name}.yaml"
        classical_path = options.classical_dir / f"{name}.list"
        if not converter_yaml.is_file() or not classical_path.is_file():
            raise GenerationError(f"incomplete converter output for category: {name}")

        converter_domain_rules = parse_domain_rules(domain_path)
        classical_domain_rules, portable_rules, counts = parse_classical_rules(
            classical_path
        )
        if converter_domain_rules != classical_domain_rules:
            raise GenerationError(
                f"domain and classical converter outputs disagree for category: {name}"
            )

        unsupported = {
            "DOMAIN-REGEX": counts["DOMAIN-REGEX"],
        }
        omitted_rule_total += sum(unsupported.values())
        if not portable_rules:
            omitted_categories[name] = unsupported
            continue

        source_portable_rule_total += len(portable_rules)

        portable_body = "\n".join(portable_rules) + "\n"
        classical_body = read_text(classical_path)
        portable_hash = sha256_text(portable_body)
        source_hash = sha256_text(classical_body)
        for output_name in (name, *sorted(aliases_by_source.get(name, []))):
            previous = previous_categories.get(output_name, {})
            if previous.get("source_sha256") == source_hash and isinstance(
                previous.get("updated"), str
            ):
                updated = normalize_timestamp(str(previous["updated"]))
            else:
                updated = published_at

            relative_dir = Path("geosite") / output_name
            list_relative = (relative_dir / f"{output_name}.list").as_posix()
            yaml_relative = (relative_dir / f"{output_name}.yaml").as_posix()
            list_header = build_header(
                name=output_name,
                author=options.author,
                repository=options.repository,
                branch=options.branch,
                relative_path=list_relative,
                source_repository=options.source_repository,
                updated=updated,
                counts=counts,
            )
            yaml_header = build_header(
                name=output_name,
                author=options.author,
                repository=options.repository,
                branch=options.branch,
                relative_path=yaml_relative,
                source_repository=options.source_repository,
                updated=updated,
                counts=counts,
            )
            list_text = render_rule_file(list_header, portable_rules)
            yaml_text = render_yaml_file(yaml_header, portable_rules)
            write_text(options.output_dir / list_relative, list_text)
            write_text(options.output_dir / yaml_relative, yaml_text)

            list_sha = sha256_text(list_text)
            yaml_sha = sha256_text(yaml_text)
            category: dict[str, object] = {
                "path": relative_dir.as_posix(),
                "updated": updated,
                "counts": {
                    "domain": counts["DOMAIN"],
                    "domain_suffix": counts["DOMAIN-SUFFIX"],
                    "domain_keyword": counts["DOMAIN-KEYWORD"],
                    "omitted_domain_regex": counts["DOMAIN-REGEX"],
                    "total": len(portable_rules),
                },
                "source_sha256": source_hash,
                "portable_sha256": portable_hash,
                "files": {
                    "list": {"path": list_relative, "sha256": list_sha},
                    "yaml": {"path": yaml_relative, "sha256": yaml_sha},
                },
            }
            if output_name != name:
                category["alias_of"] = name
            categories[output_name] = category
            published_rule_total += len(portable_rules)

    unpublished_aliases = sorted(set(alias_map) - set(categories))
    if unpublished_aliases:
        raise GenerationError(
            "aliases have no portable source rules: " + ", ".join(unpublished_aliases)
        )

    if len(categories) < options.minimum_categories:
        raise GenerationError(
            f"generated only {len(categories)} non-empty categories; "
            f"minimum is {options.minimum_categories}"
        )
    missing = sorted(set(options.required_categories) - set(categories))
    if missing:
        raise GenerationError(f"required categories are missing: {', '.join(missing)}")
    check_large_drop(
        previous_categories,
        len(categories),
        options.max_category_drop_percent,
        options.allow_large_drop,
    )

    manifest: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "mode": "portable-classical",
        "source": {
            "repository": options.source_repository,
            "release": options.source_release,
            "commit": options.source_commit,
            "published_at": published_at,
        },
        "converter": {
            "repository": options.converter_repository,
            "commit": options.converter_commit,
        },
        "statistics": {
            "source_categories": len(domain_paths),
            "generated_categories": len(categories),
            "aliases": len(alias_map),
            "omitted_categories": len(omitted_categories),
            "portable_rules": source_portable_rule_total,
            "published_rules": published_rule_total,
            "omitted_rules": omitted_rule_total,
        },
        "categories": dict(sorted(categories.items())),
        "aliases": dict(sorted(alias_map.items())),
        "omitted_category_details": dict(sorted(omitted_categories.items())),
    }
    write_text(
        options.output_dir / "manifest.json",
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    )

    checksums: list[str] = []
    for path in sorted(options.output_dir.rglob("*")):
        if path.is_file() and path.name != "SHA256SUMS":
            relative = path.relative_to(options.output_dir).as_posix()
            checksums.append(f"{sha256_bytes(path.read_bytes())}  {relative}")
    write_text(options.output_dir / "SHA256SUMS", "\n".join(checksums) + "\n")
    return manifest


def parse_args(argv: list[str] | None = None) -> BuildOptions:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain-dir", required=True, type=Path)
    parser.add_argument("--classical-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--previous-dir", type=Path)
    parser.add_argument("--repository", default="27Aaron/ProxyRules")
    parser.add_argument("--branch", default="rules")
    parser.add_argument("--author", default="27Aaron")
    parser.add_argument(
        "--source-repository", default="v2fly/domain-list-community"
    )
    parser.add_argument("--source-release", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--source-published-at", required=True)
    parser.add_argument(
        "--converter-repository", default="MetaCubeX/meta-rules-converter"
    )
    parser.add_argument("--converter-commit", required=True)
    parser.add_argument("--minimum-categories", type=int, default=1000)
    parser.add_argument("--required-category", action="append", default=[])
    parser.add_argument(
        "--alias",
        action="append",
        default=[],
        metavar="ALIAS=SOURCE",
        help="publish SOURCE under an additional ALIAS name",
    )
    parser.add_argument("--max-category-drop-percent", type=float, default=5.0)
    parser.add_argument("--allow-large-drop", action="store_true")
    args = parser.parse_args(argv)
    if args.minimum_categories < 1:
        parser.error("--minimum-categories must be positive")
    if not 0 <= args.max_category_drop_percent <= 100:
        parser.error("--max-category-drop-percent must be between 0 and 100")
    aliases: list[tuple[str, str]] = []
    for raw_alias in args.alias:
        alias, separator, source = raw_alias.partition("=")
        if not separator or not alias or not source:
            parser.error(f"invalid --alias value: {raw_alias!r}")
        aliases.append((alias, source))
    return BuildOptions(
        domain_dir=args.domain_dir,
        classical_dir=args.classical_dir,
        output_dir=args.output_dir,
        previous_dir=args.previous_dir,
        repository=args.repository,
        branch=args.branch,
        author=args.author,
        source_repository=args.source_repository,
        source_release=args.source_release,
        source_commit=args.source_commit,
        source_published_at=args.source_published_at,
        converter_repository=args.converter_repository,
        converter_commit=args.converter_commit,
        minimum_categories=args.minimum_categories,
        required_categories=tuple(args.required_category),
        aliases=tuple(aliases),
        max_category_drop_percent=args.max_category_drop_percent,
        allow_large_drop=args.allow_large_drop,
    )


def main(argv: list[str] | None = None) -> int:
    try:
        options = parse_args(argv)
        manifest = build(options)
    except GenerationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    statistics = manifest["statistics"]
    print(
        "generated "
        f"{statistics['generated_categories']} categories with "
        f"{statistics['published_rules']} published rules"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
