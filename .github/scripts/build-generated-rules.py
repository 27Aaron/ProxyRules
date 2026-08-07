#!/usr/bin/env python3
"""Package converted geosite and GeoIP data for the ``rules`` branch.

The input directories are produced by MetaCubeX/meta-rules-converter. The
converter's root directory contains Mihomo ``domain`` behavior rule sets,
while ``classical`` contains the representation used for the portable text
and YAML geosite files. GeoIP text files are rendered from canonical CIDRs so
IPv4 and IPv6 receive their correct portable rule types.
"""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


SCHEMA_VERSION = 2
CATEGORY_RE = re.compile(r"^[a-z0-9][a-z0-9!@._-]*$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SEPARATOR = "# -----------------------------------------------------"
PUBLISHED_CLASSICAL_TYPES = {"DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"}
UNSUPPORTED_CLASSICAL_TYPES = {"DOMAIN-REGEX"}
GEOSITE_RULE_TYPES = (
    "DOMAIN",
    "DOMAIN-SUFFIX",
    "DOMAIN-KEYWORD",
    "DOMAIN-REGEX",
)
PORTABLE_GEOSITE_TYPES = GEOSITE_RULE_TYPES[:3]
MRS_GEOSITE_TYPES = GEOSITE_RULE_TYPES[:2]
GEOIP_RULE_TYPES = ("IP-CIDR", "IP-CIDR6")
RULESET_RULE_TYPES = (*GEOSITE_RULE_TYPES, *GEOIP_RULE_TYPES)
RULE_TYPE_KEYS = {
    "DOMAIN": "domain",
    "DOMAIN-SUFFIX": "domain_suffix",
    "DOMAIN-KEYWORD": "domain_keyword",
    "DOMAIN-REGEX": "domain_regex",
    "IP-CIDR": "ipv4",
    "IP-CIDR6": "ipv6",
}
DISPLAY_TIMEZONE = timezone(timedelta(hours=8))
RULESET_ACTION_GROUPS = {
    "ip-attribution-direct": ("ip-attribution", "direct"),
    "ip-attribution-reject": ("ip-attribution", "reject"),
}


class GenerationError(RuntimeError):
    """Raised when converted rules are incomplete or unsafe to publish."""


@dataclass(frozen=True)
class BuildOptions:
    domain_dir: Path
    classical_dir: Path
    srs_dir: Path
    geoip_dir: Path
    geoip_srs_dir: Path
    ruleset_dir: Path
    ruleset_srs_dir: Path
    output_dir: Path
    previous_dir: Path | None
    repository: str
    branch: str
    author: str
    source_repository: str
    source_release: str
    source_commit: str
    source_published_at: str
    geoip_source_repository: str
    geoip_source_release: str
    geoip_source_commit: str
    geoip_source_published_at: str
    custom_source_repository: str
    custom_source_ref: str
    custom_source_commit: str
    custom_source_published_at: str
    custom_categories: tuple[str, ...]
    converter_repository: str
    converter_commit: str
    minimum_categories: int
    minimum_geoip_categories: int
    minimum_ruleset_categories: int
    required_categories: tuple[str, ...]
    required_geoip_categories: tuple[str, ...]
    required_ruleset_categories: tuple[str, ...]
    aliases: tuple[tuple[str, str], ...]
    max_category_drop_percent: float
    allow_large_drop: bool


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def select_counts(
    counts: dict[str, int], rule_types: Iterable[str]
) -> dict[str, int]:
    return {
        RULE_TYPE_KEYS[rule_type]: counts.get(rule_type, 0)
        for rule_type in rule_types
        if counts.get(rule_type, 0)
    }


def format_record(
    *,
    relative_path: str,
    sha256: str,
    counts: dict[str, int],
    included_types: Iterable[str],
    omitted_types: Iterable[str] = (),
) -> dict[str, object]:
    included = select_counts(counts, included_types)
    omitted = select_counts(counts, omitted_types)
    return {
        "path": relative_path,
        "sha256": sha256,
        "rules": sum(included.values()),
        "counts": included,
        "omitted": omitted,
    }


def summarize_formats(
    categories: dict[str, dict[str, object]],
    format_names: Iterable[str],
    additional_omissions: dict[str, dict[str, int]] | None = None,
) -> dict[str, dict[str, object]]:
    summary: dict[str, dict[str, object]] = {}
    for format_name in format_names:
        rules = 0
        files = 0
        counts: dict[str, int] = {}
        omitted: dict[str, int] = {}
        for category in categories.values():
            formats = category.get("formats", {})
            if not isinstance(formats, dict):
                continue
            record = formats.get(format_name)
            if not isinstance(record, dict):
                continue
            files += 1
            rules += int(record.get("rules", 0))
            for key, value in record.get("counts", {}).items():
                counts[str(key)] = counts.get(str(key), 0) + int(value)
            for key, value in record.get("omitted", {}).items():
                omitted[str(key)] = omitted.get(str(key), 0) + int(value)
        for key, value in (additional_omissions or {}).get(
            format_name, {}
        ).items():
            omitted[key] = omitted.get(key, 0) + value
        summary[format_name] = {
            "files": files,
            "rules": rules,
            "counts": dict(sorted(counts.items())),
            "omitted": dict(sorted(omitted.items())),
        }
    return summary


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


def read_binary(path: Path) -> bytes:
    if path.is_symlink():
        raise GenerationError(f"symbolic links are not accepted: {path}")
    try:
        data = path.read_bytes()
    except OSError as error:
        raise GenerationError(f"unable to read binary rule file: {path}") from error
    if not data:
        raise GenerationError(f"binary rule file is empty: {path}")
    return data


def write_binary(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


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
    return parsed.astimezone(DISPLAY_TIMEZONE).strftime(
        "%Y-%m-%d %H:%M:%S UTC+08:00"
    )


def newest_timestamp(*values: str) -> str:
    normalized = [normalize_timestamp(value) for value in values]
    return max(
        normalized,
        key=lambda value: datetime.fromisoformat(value[:-1] + "+00:00"),
    )


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


def parse_geoip_rules(path: Path) -> tuple[list[str], list[str], dict[str, int]]:
    source_rules: list[str] = []
    portable_rules: list[str] = []
    seen: set[str] = set()
    counts = {
        "IP-CIDR": 0,
        "IP-CIDR6": 0,
    }
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        value = raw_line.strip()
        if not value:
            continue
        if value in seen:
            raise GenerationError(
                f"duplicate GeoIP rule in {path}:{line_number}: {value}"
            )
        try:
            network = ipaddress.ip_network(value, strict=True)
        except ValueError as error:
            raise GenerationError(
                f"invalid GeoIP rule in {path}:{line_number}: {value!r}"
            ) from error
        canonical = network.with_prefixlen
        if canonical != value:
            raise GenerationError(
                f"non-canonical GeoIP rule in {path}:{line_number}: {value!r}"
            )
        seen.add(value)
        source_rules.append(value)
        rule_type = "IP-CIDR" if network.version == 4 else "IP-CIDR6"
        portable_rules.append(f"{rule_type},{value},no-resolve")
        counts[rule_type] += 1
    if not source_rules:
        raise GenerationError(f"GeoIP category has no rules: {path}")
    return source_rules, portable_rules, counts


def parse_ruleset_rules(
    path: Path,
) -> tuple[list[str], list[str], dict[str, int]]:
    source_rules: list[str] = []
    portable_rules: list[str] = []
    seen: set[tuple[str, str]] = set()
    counts = {
        "DOMAIN": 0,
        "DOMAIN-SUFFIX": 0,
        "DOMAIN-KEYWORD": 0,
        "DOMAIN-REGEX": 0,
        "IP-CIDR": 0,
        "IP-CIDR6": 0,
    }
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        rule_type, separator, remainder = line.partition(",")
        if not separator or rule_type not in counts or not remainder:
            raise GenerationError(
                f"unsupported ruleset rule in {path}:{line_number}: {line!r}"
            )
        if remainder.rsplit(",", maxsplit=1)[-1] in {"DIRECT", "REJECT"}:
            raise GenerationError(
                f"unsupported ruleset action in {path}:{line_number}: {line!r}"
            )
        if rule_type in {"IP-CIDR", "IP-CIDR6"}:
            fields = remainder.split(",")
            if len(fields) not in {1, 2} or (
                len(fields) == 2 and fields[1] != "no-resolve"
            ):
                raise GenerationError(
                    f"unsupported ruleset modifier in {path}:{line_number}: {line!r}"
                )
            try:
                network = ipaddress.ip_network(fields[0], strict=True)
            except ValueError as error:
                raise GenerationError(
                    f"invalid ruleset CIDR in {path}:{line_number}: {fields[0]!r}"
                ) from error
            expected_type = "IP-CIDR" if network.version == 4 else "IP-CIDR6"
            if rule_type != expected_type or network.with_prefixlen != fields[0]:
                raise GenerationError(
                    f"non-canonical ruleset CIDR in {path}:{line_number}: {line!r}"
                )
            matcher_value = fields[0]
        else:
            matcher_value = remainder
        matcher = (rule_type, matcher_value)
        if matcher in seen:
            raise GenerationError(
                f"duplicate ruleset matcher in {path}:{line_number}: {line!r}"
            )
        seen.add(matcher)
        source_rules.append(line)
        counts[rule_type] += 1
        if rule_type not in UNSUPPORTED_CLASSICAL_TYPES:
            portable_rules.append(line)
    if not source_rules:
        raise GenerationError(f"ruleset category has no rules: {path}")
    return source_rules, portable_rules, counts


def load_previous_categories(
    previous_dir: Path | None,
    collection: str = "geosite",
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
    collections = manifest.get("collections")
    if isinstance(collections, dict):
        collection_data = collections.get(collection, {})
        if not isinstance(collection_data, dict):
            raise GenerationError(
                f"previous manifest collection {collection} must be an object"
            )
        categories = collection_data.get("categories", {})
    else:
        legacy_keys = {
            "geosite": "categories",
            "geoip": "geoip_categories",
            "ruleset": "ruleset_categories",
        }
        categories = manifest.get(legacy_keys[collection], {})
    if not isinstance(categories, dict):
        raise GenerationError(
            f"previous manifest {collection} categories must be an object"
        )
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
    ]
    for rule_type, count in counts.items():
        if count and rule_type in UNSUPPORTED_CLASSICAL_TYPES:
            lines.append(f"# OMITTED-{rule_type}: {count}")
        elif count:
            lines.append(f"# {rule_type}: {count}")
    portable_total = sum(
        count
        for rule_type, count in counts.items()
        if rule_type not in UNSUPPORTED_CLASSICAL_TYPES
    )
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
    if not COMMIT_RE.fullmatch(options.geoip_source_commit):
        raise GenerationError(
            "GeoIP source commit must be a lowercase 40-character SHA"
        )
    if not COMMIT_RE.fullmatch(options.custom_source_commit):
        raise GenerationError(
            "custom source commit must be a lowercase 40-character SHA"
        )
    if not options.custom_source_ref or any(
        character.isspace() for character in options.custom_source_ref
    ):
        raise GenerationError("custom source ref must be a non-empty ref name")
    if not COMMIT_RE.fullmatch(options.converter_commit):
        raise GenerationError("converter commit must be a lowercase 40-character SHA")
    if options.output_dir.is_symlink():
        raise GenerationError(
            f"output directory must not be a symbolic link: {options.output_dir}"
        )
    if options.output_dir.exists() and any(options.output_dir.iterdir()):
        raise GenerationError(f"output directory must be empty: {options.output_dir}")
    options.output_dir.mkdir(parents=True, exist_ok=True)
    if (
        not options.domain_dir.is_dir()
        or not options.classical_dir.is_dir()
        or not options.srs_dir.is_dir()
        or not options.geoip_dir.is_dir()
        or not options.geoip_srs_dir.is_dir()
        or not options.ruleset_dir.is_dir()
        or not options.ruleset_srs_dir.is_dir()
    ):
        raise GenerationError(
            "converted geosite and GeoIP directories are required"
        )

    published_at = normalize_timestamp(options.source_published_at)
    geoip_published_at = normalize_timestamp(options.geoip_source_published_at)
    custom_published_at = normalize_timestamp(options.custom_source_published_at)
    custom_categories = set(options.custom_categories)
    if len(custom_categories) != len(options.custom_categories):
        raise GenerationError("custom categories must not contain duplicates")
    for name in custom_categories:
        validate_category(name)
    previous_categories = load_previous_categories(options.previous_dir)
    previous_geoip_categories = load_previous_categories(
        options.previous_dir, "geoip"
    )
    previous_ruleset_categories = load_previous_categories(
        options.previous_dir, "ruleset"
    )
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
    omitted_categories: dict[str, dict[str, object]] = {}
    geosite_source_rule_total = 0

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

        geosite_source_rule_total += sum(counts.values())
        if not portable_rules:
            omitted_source_counts = select_counts(counts, GEOSITE_RULE_TYPES)
            omitted_source_counts["total"] = sum(counts.values())
            omitted_categories[name] = {
                "reason": "category has no portable list or YAML rules",
                "source_counts": omitted_source_counts,
            }
            continue

        mrs_bytes = read_binary(options.domain_dir / f"{name}.mrs")
        srs_bytes = read_binary(options.srs_dir / f"{name}.srs")

        classical_body = read_text(classical_path)
        source_hash = sha256_text(classical_body)
        for output_name in (name, *sorted(aliases_by_source.get(name, []))):
            previous = previous_categories.get(output_name, {})
            if previous.get("source_sha256") == source_hash and isinstance(
                previous.get("updated"), str
            ):
                updated = normalize_timestamp(str(previous["updated"]))
            else:
                updated = (
                    newest_timestamp(published_at, custom_published_at)
                    if name in custom_categories
                    else published_at
                )

            relative_dir = Path("geosite") / output_name
            list_relative = (relative_dir / f"{output_name}.list").as_posix()
            yaml_relative = (relative_dir / f"{output_name}.yaml").as_posix()
            mrs_relative = (relative_dir / f"{output_name}.mrs").as_posix()
            srs_relative = (relative_dir / f"{output_name}.srs").as_posix()
            list_header = build_header(
                name=output_name,
                author=options.author,
                repository=options.repository,
                branch=options.branch,
                relative_path=list_relative,
                updated=updated,
                counts=counts,
            )
            yaml_header = build_header(
                name=output_name,
                author=options.author,
                repository=options.repository,
                branch=options.branch,
                relative_path=yaml_relative,
                updated=updated,
                counts=counts,
            )
            list_text = render_rule_file(list_header, portable_rules)
            yaml_text = render_yaml_file(yaml_header, portable_rules)
            write_text(options.output_dir / list_relative, list_text)
            write_text(options.output_dir / yaml_relative, yaml_text)
            write_binary(options.output_dir / mrs_relative, mrs_bytes)
            write_binary(options.output_dir / srs_relative, srs_bytes)

            list_sha = sha256_text(list_text)
            yaml_sha = sha256_text(yaml_text)
            mrs_sha = sha256_bytes(mrs_bytes)
            srs_sha = sha256_bytes(srs_bytes)
            source_counts = select_counts(counts, GEOSITE_RULE_TYPES)
            source_counts["total"] = sum(counts.values())
            category: dict[str, object] = {
                "path": relative_dir.as_posix(),
                "updated": updated,
                "source_counts": source_counts,
                "source_sha256": source_hash,
                "formats": {
                    "list": format_record(
                        relative_path=list_relative,
                        sha256=list_sha,
                        counts=counts,
                        included_types=PORTABLE_GEOSITE_TYPES,
                        omitted_types=("DOMAIN-REGEX",),
                    ),
                    "yaml": format_record(
                        relative_path=yaml_relative,
                        sha256=yaml_sha,
                        counts=counts,
                        included_types=PORTABLE_GEOSITE_TYPES,
                        omitted_types=("DOMAIN-REGEX",),
                    ),
                    "mrs": format_record(
                        relative_path=mrs_relative,
                        sha256=mrs_sha,
                        counts=counts,
                        included_types=MRS_GEOSITE_TYPES,
                        omitted_types=("DOMAIN-KEYWORD", "DOMAIN-REGEX"),
                    ),
                    "srs": format_record(
                        relative_path=srs_relative,
                        sha256=srs_sha,
                        counts=counts,
                        included_types=GEOSITE_RULE_TYPES,
                    ),
                },
            }
            if output_name != name:
                category["alias_of"] = name
            categories[output_name] = category

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

    geoip_paths = sorted(options.geoip_dir.glob("*.list"), key=lambda path: path.name)
    if len(geoip_paths) < options.minimum_geoip_categories:
        raise GenerationError(
            f"found only {len(geoip_paths)} GeoIP categories; "
            f"minimum is {options.minimum_geoip_categories}"
        )

    geoip_categories: dict[str, dict[str, object]] = {}
    geoip_source_rule_total = 0
    for geoip_path in geoip_paths:
        name = geoip_path.stem
        validate_category(name)
        converter_yaml = options.geoip_dir / f"{name}.yaml"
        if not converter_yaml.is_file():
            raise GenerationError(f"incomplete GeoIP converter output: {name}")

        source_rules, portable_rules, counts = parse_geoip_rules(geoip_path)
        mrs_bytes = read_binary(options.geoip_dir / f"{name}.mrs")
        srs_bytes = read_binary(options.geoip_srs_dir / f"{name}.srs")
        source_body = read_text(geoip_path)
        source_hash = sha256_text(source_body)
        previous = previous_geoip_categories.get(name, {})
        if previous.get("source_sha256") == source_hash and isinstance(
            previous.get("updated"), str
        ):
            updated = normalize_timestamp(str(previous["updated"]))
        else:
            updated = (
                newest_timestamp(geoip_published_at, custom_published_at)
                if name in custom_categories
                else geoip_published_at
            )

        relative_dir = Path("geoip") / name
        list_relative = (relative_dir / f"{name}.list").as_posix()
        yaml_relative = (relative_dir / f"{name}.yaml").as_posix()
        mrs_relative = (relative_dir / f"{name}.mrs").as_posix()
        srs_relative = (relative_dir / f"{name}.srs").as_posix()
        list_header = build_header(
            name=name,
            author=options.author,
            repository=options.repository,
            branch=options.branch,
            relative_path=list_relative,
            updated=updated,
            counts=counts,
        )
        yaml_header = build_header(
            name=name,
            author=options.author,
            repository=options.repository,
            branch=options.branch,
            relative_path=yaml_relative,
            updated=updated,
            counts=counts,
        )
        list_text = render_rule_file(list_header, portable_rules)
        yaml_text = render_yaml_file(yaml_header, portable_rules)
        write_text(options.output_dir / list_relative, list_text)
        write_text(options.output_dir / yaml_relative, yaml_text)
        write_binary(options.output_dir / mrs_relative, mrs_bytes)
        write_binary(options.output_dir / srs_relative, srs_bytes)

        source_counts = select_counts(counts, GEOIP_RULE_TYPES)
        source_counts["total"] = len(source_rules)
        geoip_categories[name] = {
            "path": relative_dir.as_posix(),
            "updated": updated,
            "source_counts": source_counts,
            "source_sha256": source_hash,
            "formats": {
                "list": format_record(
                    relative_path=list_relative,
                    sha256=sha256_text(list_text),
                    counts=counts,
                    included_types=GEOIP_RULE_TYPES,
                ),
                "yaml": format_record(
                    relative_path=yaml_relative,
                    sha256=sha256_text(yaml_text),
                    counts=counts,
                    included_types=GEOIP_RULE_TYPES,
                ),
                "mrs": format_record(
                    relative_path=mrs_relative,
                    sha256=sha256_bytes(mrs_bytes),
                    counts=counts,
                    included_types=GEOIP_RULE_TYPES,
                ),
                "srs": format_record(
                    relative_path=srs_relative,
                    sha256=sha256_bytes(srs_bytes),
                    counts=counts,
                    included_types=GEOIP_RULE_TYPES,
                ),
            },
        }
        geoip_source_rule_total += len(source_rules)

    missing_geoip = sorted(
        set(options.required_geoip_categories) - set(geoip_categories)
    )
    if missing_geoip:
        raise GenerationError(
            f"required GeoIP categories are missing: {', '.join(missing_geoip)}"
        )
    check_large_drop(
        previous_geoip_categories,
        len(geoip_categories),
        options.max_category_drop_percent,
        options.allow_large_drop,
    )

    ruleset_paths = sorted(
        options.ruleset_dir.glob("*.list"), key=lambda path: path.name
    )
    if len(ruleset_paths) < options.minimum_ruleset_categories:
        raise GenerationError(
            f"found only {len(ruleset_paths)} ruleset categories; "
            f"minimum is {options.minimum_ruleset_categories}"
        )
    ruleset_names = {path.stem for path in ruleset_paths}
    allowed_rulesets = set(custom_categories)
    if "ip-attribution" in custom_categories:
        allowed_rulesets.update(RULESET_ACTION_GROUPS)
    if not custom_categories.issubset(ruleset_names) or not ruleset_names.issubset(
        allowed_rulesets
    ):
        missing_rulesets = sorted(custom_categories - ruleset_names)
        unexpected_rulesets = sorted(ruleset_names - allowed_rulesets)
        details: list[str] = []
        if missing_rulesets:
            details.append("missing " + ", ".join(missing_rulesets))
        if unexpected_rulesets:
            details.append("unexpected " + ", ".join(unexpected_rulesets))
        raise GenerationError(
            "custom ruleset categories disagree: " + "; ".join(details)
        )

    ruleset_categories: dict[str, dict[str, object]] = {}
    ruleset_source_rule_total = 0
    ruleset_published_at = newest_timestamp(
        published_at, geoip_published_at, custom_published_at
    )
    for ruleset_path in ruleset_paths:
        name = ruleset_path.stem
        validate_category(name)
        source_rules, portable_rules, counts = parse_ruleset_rules(ruleset_path)
        if not portable_rules:
            raise GenerationError(f"ruleset has no portable rules: {name}")
        if not (options.ruleset_dir / f"{name}.yaml").is_file():
            raise GenerationError(f"incomplete prepared ruleset output: {name}")
        srs_bytes = read_binary(options.ruleset_srs_dir / f"{name}.srs")
        source_body = read_text(ruleset_path)
        source_hash = sha256_text(source_body)
        previous = previous_ruleset_categories.get(name, {})
        if previous.get("source_sha256") == source_hash and isinstance(
            previous.get("updated"), str
        ):
            updated = normalize_timestamp(str(previous["updated"]))
        else:
            updated = ruleset_published_at

        output_directory, action = RULESET_ACTION_GROUPS.get(name, (name, None))
        if name == "ip-attribution":
            action = "default"
        relative_dir = Path("ruleset") / output_directory
        list_relative = (relative_dir / f"{name}.list").as_posix()
        yaml_relative = (relative_dir / f"{name}.yaml").as_posix()
        srs_relative = (relative_dir / f"{name}.srs").as_posix()
        list_header = build_header(
            name=name,
            author=options.author,
            repository=options.repository,
            branch=options.branch,
            relative_path=list_relative,
            updated=updated,
            counts=counts,
        )
        yaml_header = build_header(
            name=name,
            author=options.author,
            repository=options.repository,
            branch=options.branch,
            relative_path=yaml_relative,
            updated=updated,
            counts=counts,
        )
        list_text = render_rule_file(list_header, portable_rules)
        yaml_text = render_yaml_file(yaml_header, portable_rules)
        write_text(options.output_dir / list_relative, list_text)
        write_text(options.output_dir / yaml_relative, yaml_text)
        write_binary(options.output_dir / srs_relative, srs_bytes)

        source_counts = select_counts(counts, RULESET_RULE_TYPES)
        source_counts["total"] = len(source_rules)
        category: dict[str, object] = {
            "path": relative_dir.as_posix(),
            "updated": updated,
            "source_counts": source_counts,
            "source_sha256": source_hash,
            "formats": {
                "list": format_record(
                    relative_path=list_relative,
                    sha256=sha256_text(list_text),
                    counts=counts,
                    included_types=(*PORTABLE_GEOSITE_TYPES, *GEOIP_RULE_TYPES),
                    omitted_types=("DOMAIN-REGEX",),
                ),
                "yaml": format_record(
                    relative_path=yaml_relative,
                    sha256=sha256_text(yaml_text),
                    counts=counts,
                    included_types=(*PORTABLE_GEOSITE_TYPES, *GEOIP_RULE_TYPES),
                    omitted_types=("DOMAIN-REGEX",),
                ),
                "srs": format_record(
                    relative_path=srs_relative,
                    sha256=sha256_bytes(srs_bytes),
                    counts=counts,
                    included_types=RULESET_RULE_TYPES,
                ),
            },
        }
        if action is not None:
            category["action"] = action
        ruleset_categories[name] = category
        ruleset_source_rule_total += len(source_rules)

    missing_ruleset = sorted(
        set(options.required_ruleset_categories) - set(ruleset_categories)
    )
    if missing_ruleset:
        raise GenerationError(
            f"required ruleset categories are missing: {', '.join(missing_ruleset)}"
        )
    check_large_drop(
        previous_ruleset_categories,
        len(ruleset_categories),
        options.max_category_drop_percent,
        options.allow_large_drop,
    )

    omitted_geosite_by_format = {
        format_name: {} for format_name in ("list", "yaml", "mrs", "srs")
    }
    for detail in omitted_categories.values():
        source_counts = detail.get("source_counts", {})
        if not isinstance(source_counts, dict):
            continue
        for format_name in omitted_geosite_by_format:
            for key, value in source_counts.items():
                if key != "total":
                    current = omitted_geosite_by_format[format_name].get(key, 0)
                    omitted_geosite_by_format[format_name][key] = current + int(value)

    geosite_formats = summarize_formats(
        categories,
        ("list", "yaml", "mrs", "srs"),
        omitted_geosite_by_format,
    )
    geoip_formats = summarize_formats(
        geoip_categories,
        ("list", "yaml", "mrs", "srs"),
    )
    ruleset_formats = summarize_formats(
        ruleset_categories,
        ("list", "yaml", "srs"),
    )

    manifest: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "mode": "category-first",
        "sources": {
            "geosite": {
                "repository": options.source_repository,
                "release": options.source_release,
                "commit": options.source_commit,
                "published_at": published_at,
            },
            "geoip": {
                "repository": options.geoip_source_repository,
                "release": options.geoip_source_release,
                "commit": options.geoip_source_commit,
                "published_at": geoip_published_at,
            },
            "custom": {
                "repository": options.custom_source_repository,
                "ref": options.custom_source_ref,
                "commit": options.custom_source_commit,
                "published_at": custom_published_at,
            },
        },
        "converter": {
            "repository": options.converter_repository,
            "commit": options.converter_commit,
        },
        "collections": {
            "geosite": {
                "path": "geosite",
                "sources": ["geosite", "custom"],
                "statistics": {
                    "source_categories": len(domain_paths),
                    "generated_categories": len(categories),
                    "aliases": len(alias_map),
                    "omitted_categories": len(omitted_categories),
                    "source_rules": geosite_source_rule_total,
                    "formats": geosite_formats,
                },
                "categories": dict(sorted(categories.items())),
                "aliases": dict(sorted(alias_map.items())),
                "omitted_categories": dict(sorted(omitted_categories.items())),
            },
            "geoip": {
                "path": "geoip",
                "sources": ["geoip", "custom"],
                "statistics": {
                    "source_categories": len(geoip_paths),
                    "generated_categories": len(geoip_categories),
                    "source_rules": geoip_source_rule_total,
                    "formats": geoip_formats,
                },
                "categories": dict(sorted(geoip_categories.items())),
            },
            "ruleset": {
                "path": "ruleset",
                "sources": ["geosite", "geoip", "custom"],
                "statistics": {
                    "source_categories": len(ruleset_paths),
                    "generated_categories": len(ruleset_categories),
                    "source_rules": ruleset_source_rule_total,
                    "formats": ruleset_formats,
                },
                "unsupported_formats": {
                    "mrs": {
                        "reason": (
                            "the ruleset collection uses classical rules that may "
                            "mix domain and IP matchers"
                        )
                    }
                },
                "categories": dict(sorted(ruleset_categories.items())),
            },
        },
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
    parser.add_argument("--srs-dir", required=True, type=Path)
    parser.add_argument("--geoip-dir", required=True, type=Path)
    parser.add_argument("--geoip-srs-dir", required=True, type=Path)
    parser.add_argument("--ruleset-dir", required=True, type=Path)
    parser.add_argument("--ruleset-srs-dir", required=True, type=Path)
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
        "--geoip-source-repository", default="Loyalsoldier/geoip"
    )
    parser.add_argument("--geoip-source-release", required=True)
    parser.add_argument("--geoip-source-commit", required=True)
    parser.add_argument("--geoip-source-published-at", required=True)
    parser.add_argument(
        "--custom-source-repository", default="27Aaron/ProxyRules"
    )
    parser.add_argument("--custom-source-ref", default="custom")
    parser.add_argument("--custom-source-commit", required=True)
    parser.add_argument("--custom-source-published-at", required=True)
    parser.add_argument("--custom-category", action="append", default=[])
    parser.add_argument(
        "--converter-repository", default="MetaCubeX/meta-rules-converter"
    )
    parser.add_argument("--converter-commit", required=True)
    parser.add_argument("--minimum-categories", type=int, default=1000)
    parser.add_argument("--minimum-geoip-categories", type=int, default=250)
    parser.add_argument("--minimum-ruleset-categories", type=int, default=5)
    parser.add_argument("--required-category", action="append", default=[])
    parser.add_argument("--required-geoip-category", action="append", default=[])
    parser.add_argument("--required-ruleset-category", action="append", default=[])
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
    if args.minimum_geoip_categories < 1:
        parser.error("--minimum-geoip-categories must be positive")
    if args.minimum_ruleset_categories < 1:
        parser.error("--minimum-ruleset-categories must be positive")
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
        srs_dir=args.srs_dir,
        geoip_dir=args.geoip_dir,
        geoip_srs_dir=args.geoip_srs_dir,
        ruleset_dir=args.ruleset_dir,
        ruleset_srs_dir=args.ruleset_srs_dir,
        output_dir=args.output_dir,
        previous_dir=args.previous_dir,
        repository=args.repository,
        branch=args.branch,
        author=args.author,
        source_repository=args.source_repository,
        source_release=args.source_release,
        source_commit=args.source_commit,
        source_published_at=args.source_published_at,
        geoip_source_repository=args.geoip_source_repository,
        geoip_source_release=args.geoip_source_release,
        geoip_source_commit=args.geoip_source_commit,
        geoip_source_published_at=args.geoip_source_published_at,
        custom_source_repository=args.custom_source_repository,
        custom_source_ref=args.custom_source_ref,
        custom_source_commit=args.custom_source_commit,
        custom_source_published_at=args.custom_source_published_at,
        custom_categories=tuple(args.custom_category),
        converter_repository=args.converter_repository,
        converter_commit=args.converter_commit,
        minimum_categories=args.minimum_categories,
        minimum_geoip_categories=args.minimum_geoip_categories,
        minimum_ruleset_categories=args.minimum_ruleset_categories,
        required_categories=tuple(args.required_category),
        required_geoip_categories=tuple(args.required_geoip_category),
        required_ruleset_categories=tuple(args.required_ruleset_category),
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
    collections = manifest["collections"]
    geosite_statistics = collections["geosite"]["statistics"]
    geoip_statistics = collections["geoip"]["statistics"]
    ruleset_statistics = collections["ruleset"]["statistics"]
    print(
        "generated "
        f"{geosite_statistics['generated_categories']} geosite categories, "
        f"{geoip_statistics['generated_categories']} GeoIP categories, and "
        f"{ruleset_statistics['generated_categories']} mixed rulesets"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
