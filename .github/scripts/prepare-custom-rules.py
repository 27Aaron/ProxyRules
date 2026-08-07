#!/usr/bin/env python3
"""Merge maintained custom rules with converted geosite and GeoIP inputs."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


CATEGORY_RE = re.compile(r"^[a-z0-9][a-z0-9!@._-]*$")
DOMAIN_TYPES = ("DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", "DOMAIN-REGEX")
IP_TYPES = ("IP-CIDR", "IP-CIDR6")
SUPPORTED_TYPES = set(DOMAIN_TYPES + IP_TYPES)
SUPPORTED_ACTIONS = {"DIRECT", "REJECT"}


class PreparationError(RuntimeError):
    """Raised when custom input cannot be merged safely."""


@dataclass(frozen=True)
class Rule:
    rule_type: str
    value: str
    action: str = "default"
    no_resolve: bool = False

    @property
    def matcher(self) -> tuple[str, str]:
        return self.rule_type, self.value

    def portable(self) -> str:
        fields = [self.rule_type, self.value]
        if self.no_resolve:
            fields.append("no-resolve")
        return ",".join(fields)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_text(path: Path) -> str:
    if path.is_symlink():
        raise PreparationError(f"symbolic links are not accepted: {path}")
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise PreparationError(f"rule file is not valid UTF-8: {path}") from error


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(text)


def validate_category(name: str) -> None:
    if (
        not CATEGORY_RE.fullmatch(name)
        or ".." in name
        or name.startswith(".")
        or name.endswith(".")
    ):
        raise PreparationError(f"unsafe category name: {name!r}")


def validate_domain(value: str, path: Path, line_number: int) -> None:
    if not value or len(value) > 253:
        raise PreparationError(
            f"invalid domain in {path}:{line_number}: {value!r}"
        )
    for label in value.split("."):
        if (
            not label
            or len(label) > 63
            or label.startswith("-")
            or label.endswith("-")
            or any(
                not (
                    character.isascii()
                    and (character.isalnum() or character == "-")
                )
                for character in label
            )
        ):
            raise PreparationError(
                f"invalid domain in {path}:{line_number}: {value!r}"
            )


def normalize_ip_rule(
    rule_type: str, value: str, path: Path, line_number: int
) -> str:
    try:
        network = ipaddress.ip_network(value, strict=False)
    except ValueError as error:
        raise PreparationError(
            f"invalid CIDR in {path}:{line_number}: {value!r}"
        ) from error
    expected_type = "IP-CIDR" if network.version == 4 else "IP-CIDR6"
    if rule_type != expected_type:
        raise PreparationError(
            f"CIDR family does not match {rule_type} in {path}:{line_number}"
        )
    return network.with_prefixlen


def parse_custom_file(path: Path) -> list[Rule]:
    rules: list[Rule] = []
    seen: set[tuple[str, str]] = set()
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        fields = [field.strip() for field in line.split(",")]
        if len(fields) < 2 or fields[0] not in SUPPORTED_TYPES or not fields[1]:
            raise PreparationError(
                f"unsupported custom rule in {path}:{line_number}: {line!r}"
            )
        rule_type, value = fields[:2]
        action = "default"
        no_resolve = False
        for option in fields[2:]:
            if option in SUPPORTED_ACTIONS:
                if action != "default":
                    raise PreparationError(
                        f"multiple actions in {path}:{line_number}: {line!r}"
                    )
                action = option.lower()
            elif option == "no-resolve" and rule_type in IP_TYPES:
                if no_resolve:
                    raise PreparationError(
                        f"duplicate no-resolve in {path}:{line_number}"
                    )
                no_resolve = True
            else:
                raise PreparationError(
                    f"unsupported modifier in {path}:{line_number}: {option!r}"
                )
        if rule_type in ("DOMAIN", "DOMAIN-SUFFIX"):
            validate_domain(value, path, line_number)
        elif rule_type == "DOMAIN-KEYWORD":
            if not value or any(character.isspace() for character in value):
                raise PreparationError(
                    f"invalid domain keyword in {path}:{line_number}: {value!r}"
                )
        elif rule_type == "DOMAIN-REGEX":
            if not value:
                raise PreparationError(
                    f"empty domain regex in {path}:{line_number}"
                )
        else:
            value = normalize_ip_rule(rule_type, value, path, line_number)

        matcher = (rule_type, value)
        if matcher in seen:
            raise PreparationError(
                f"duplicate custom matcher in {path}:{line_number}: "
                f"{rule_type},{value}"
            )
        seen.add(matcher)
        rules.append(Rule(rule_type, value, action, no_resolve))
    if not rules:
        raise PreparationError(f"custom category has no rules: {path}")
    return rules


def parse_upstream_domains(path: Path) -> list[Rule]:
    if not path.is_file():
        return []
    rules: list[Rule] = []
    seen: set[tuple[str, str]] = set()
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        rule_type, separator, value = line.partition(",")
        if not separator or rule_type not in DOMAIN_TYPES or not value:
            raise PreparationError(
                f"unsupported upstream geosite rule in {path}:{line_number}: {line!r}"
            )
        matcher = (rule_type, value)
        if matcher in seen:
            raise PreparationError(
                f"duplicate upstream geosite rule in {path}:{line_number}: {line!r}"
            )
        seen.add(matcher)
        rules.append(Rule(rule_type, value))
    return rules


def parse_upstream_cidrs(path: Path) -> list[Rule]:
    if not path.is_file():
        return []
    rules: list[Rule] = []
    seen: set[tuple[str, str]] = set()
    for line_number, raw_line in enumerate(read_text(path).splitlines(), start=1):
        value = raw_line.strip()
        if not value:
            continue
        try:
            network = ipaddress.ip_network(value, strict=True)
        except ValueError as error:
            raise PreparationError(
                f"invalid upstream GeoIP rule in {path}:{line_number}: {value!r}"
            ) from error
        rule_type = "IP-CIDR" if network.version == 4 else "IP-CIDR6"
        matcher = (rule_type, network.with_prefixlen)
        if matcher in seen:
            raise PreparationError(
                f"duplicate upstream GeoIP rule in {path}:{line_number}: {value!r}"
            )
        seen.add(matcher)
        rules.append(Rule(rule_type, network.with_prefixlen, no_resolve=True))
    return rules


def merge_rules(upstream: Iterable[Rule], custom: Iterable[Rule]) -> list[Rule]:
    merged: list[Rule] = []
    seen: set[tuple[str, str]] = set()
    for rule in (*upstream, *custom):
        if rule.matcher in seen:
            continue
        seen.add(rule.matcher)
        merged.append(rule)
    return merged


def yaml_scalar(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_lines(values: Iterable[str]) -> str:
    materialized = list(values)
    return "\n".join(materialized) + ("\n" if materialized else "")


def render_yaml(values: Iterable[str]) -> str:
    lines = ["payload:"]
    lines.extend(f"  - {yaml_scalar(value)}" for value in values)
    return "\n".join(lines) + "\n"


def write_ruleset(output_dir: Path, name: str, rules: Iterable[Rule]) -> int:
    portable_rules = [rule.portable() for rule in rules]
    if not portable_rules:
        raise PreparationError(f"prepared ruleset is empty: {name}")
    write_text(
        output_dir / f"ruleset/{name}.list",
        render_lines(portable_rules),
    )
    write_text(
        output_dir / f"ruleset/{name}.yaml",
        render_yaml(portable_rules),
    )
    return len(portable_rules)


def count_rules(rules: Iterable[Rule]) -> dict[str, int]:
    counts = {rule_type.lower().replace("-", "_"): 0 for rule_type in SUPPORTED_TYPES}
    for rule in rules:
        counts[rule.rule_type.lower().replace("-", "_")] += 1
    return {key: value for key, value in sorted(counts.items()) if value}


def prepare(
    *,
    custom_dir: Path,
    geosite_classical_dir: Path,
    geoip_dir: Path,
    output_dir: Path,
    minimum_categories: int,
    required_categories: tuple[str, ...],
) -> dict[str, object]:
    for directory, label in (
        (custom_dir, "custom"),
        (geosite_classical_dir, "geosite classical"),
        (geoip_dir, "GeoIP"),
    ):
        if directory.is_symlink() or not directory.is_dir():
            raise PreparationError(f"{label} directory is required: {directory}")
    if output_dir.is_symlink():
        raise PreparationError(f"output directory must not be a symlink: {output_dir}")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise PreparationError(f"output directory must be empty: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    custom_paths = sorted(
        custom_dir.glob("*/*.list"), key=lambda path: path.as_posix()
    )
    if len(custom_paths) < minimum_categories:
        raise PreparationError(
            f"found only {len(custom_paths)} custom categories; "
            f"minimum is {minimum_categories}"
        )

    custom_by_name: dict[str, tuple[Path, list[Rule]]] = {}
    for path in custom_paths:
        if path.parent.is_symlink():
            raise PreparationError(
                f"symbolic category directories are not accepted: {path.parent}"
            )
        name = path.parent.name
        validate_category(name)
        if path.stem != name:
            raise PreparationError(
                f"custom filename must match its category directory: {path}"
            )
        if name in custom_by_name:
            raise PreparationError(f"duplicate custom category: {name}")
        custom_by_name[name] = (path, parse_custom_file(path))

    missing = sorted(set(required_categories) - set(custom_by_name))
    if missing:
        raise PreparationError(
            f"required custom categories are missing: {', '.join(missing)}"
        )

    metadata_categories: dict[str, dict[str, object]] = {}
    metadata_rulesets: dict[str, dict[str, object]] = {}
    for name, (source_path, custom_rules) in sorted(custom_by_name.items()):
        custom_domains = [
            rule for rule in custom_rules if rule.rule_type in DOMAIN_TYPES
        ]
        custom_ips = [rule for rule in custom_rules if rule.rule_type in IP_TYPES]
        upstream_domains = parse_upstream_domains(
            geosite_classical_dir / f"{name}.list"
        )
        upstream_ips = parse_upstream_cidrs(geoip_dir / f"{name}.list")
        merged_domains = merge_rules(upstream_domains, custom_domains)
        merged_ips = merge_rules(upstream_ips, custom_ips)
        if not merged_domains:
            raise PreparationError(f"custom category has no domain rules: {name}")
        if not merged_ips:
            raise PreparationError(f"custom category has no IP rules: {name}")

        behavior_domains = []
        for rule in merged_domains:
            if rule.rule_type == "DOMAIN":
                behavior_domains.append(rule.value)
            elif rule.rule_type == "DOMAIN-SUFFIX":
                behavior_domains.append(f"+.{rule.value}")
        if not behavior_domains:
            raise PreparationError(
                f"custom category has no MRS-compatible domain rules: {name}"
            )

        domain_classical = [rule.portable() for rule in merged_domains]
        bare_cidrs = [rule.value for rule in merged_ips]
        ip_classical = [rule.portable() for rule in merged_ips]

        write_text(
            output_dir / f"geosite/domain/{name}.list",
            render_lines(behavior_domains),
        )
        write_text(
            output_dir / f"geosite/domain/{name}.yaml",
            render_yaml(behavior_domains),
        )
        write_text(
            output_dir / f"geosite/classical/{name}.list",
            render_lines(domain_classical),
        )
        write_text(
            output_dir / f"geosite/classical/{name}.yaml",
            render_yaml(domain_classical),
        )
        write_text(output_dir / f"geoip/{name}.list", render_lines(bare_cidrs))
        write_text(output_dir / f"geoip/{name}.yaml", render_yaml(bare_cidrs))
        write_text(
            output_dir / f"geoip/classical/{name}.list",
            render_lines(ip_classical),
        )
        write_text(
            output_dir / f"geoip/classical/{name}.yaml",
            render_yaml(ip_classical),
        )

        ruleset_groups: list[tuple[str, str, str, list[Rule]]]
        if name == "ip-attribution":
            default_rules = merge_rules(
                [*upstream_domains, *upstream_ips],
                [rule for rule in custom_rules if rule.action == "default"],
            )
            direct_rules = [rule for rule in custom_rules if rule.action == "direct"]
            reject_rules = [rule for rule in custom_rules if rule.action == "reject"]
            ruleset_groups = [
                (name, "default", name, default_rules),
                (f"{name}-direct", "direct", name, direct_rules),
                (f"{name}-reject", "reject", name, reject_rules),
            ]
        else:
            ruleset_groups = [
                (name, "default", name, [*merged_domains, *merged_ips])
            ]

        ruleset_total = 0
        for ruleset_name, action, output_directory, rules in ruleset_groups:
            rule_count = write_ruleset(output_dir, ruleset_name, rules)
            ruleset_total += rule_count
            metadata_rulesets[ruleset_name] = {
                "source_category": name,
                "action": action,
                "output_directory": output_directory,
                "rules": rule_count,
            }

        action_counts = {"default": 0, "direct": 0, "reject": 0}
        for rule in custom_rules:
            action_counts[rule.action] += 1
        metadata_categories[name] = {
            "source_path": source_path.relative_to(custom_dir).as_posix(),
            "source_sha256": sha256_bytes(source_path.read_bytes()),
            "source_counts": count_rules(custom_rules),
            "actions": action_counts,
            "merged_counts": {
                "geosite": len(merged_domains),
                "geoip": len(merged_ips),
                "ruleset": ruleset_total,
            },
        }

    metadata: dict[str, object] = {
        "schema_version": 1,
        "categories": metadata_categories,
        "rulesets": metadata_rulesets,
    }
    write_text(
        output_dir / "metadata.json",
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
    )
    return metadata


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--custom-dir", required=True, type=Path)
    parser.add_argument("--geosite-classical-dir", required=True, type=Path)
    parser.add_argument("--geoip-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--minimum-categories", type=int, default=5)
    parser.add_argument("--required-category", action="append", default=[])
    args = parser.parse_args(argv)
    if args.minimum_categories < 1:
        parser.error("--minimum-categories must be positive")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        metadata = prepare(
            custom_dir=args.custom_dir,
            geosite_classical_dir=args.geosite_classical_dir,
            geoip_dir=args.geoip_dir,
            output_dir=args.output_dir,
            minimum_categories=args.minimum_categories,
            required_categories=tuple(args.required_category),
        )
    except PreparationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"prepared {len(metadata['categories'])} custom categories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
