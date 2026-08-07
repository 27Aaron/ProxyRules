#!/usr/bin/env python3
"""Load and validate shared generated-rules policy."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
CATEGORY_RE = re.compile(r"^[a-z0-9][a-z0-9!@._-]*$")
COLLECTIONS = ("custom", "geosite", "geoip", "ruleset")


class RulesGenerationConfigError(ValueError):
    """Raised when the shared generation policy is invalid."""


@dataclass(frozen=True)
class RulesGenerationConfig:
    aliases: tuple[tuple[str, str], ...]
    minimum_custom_categories: int
    minimum_geosite_categories: int
    minimum_geoip_categories: int
    minimum_ruleset_categories: int
    required_custom_categories: tuple[str, ...]
    required_geosite_categories: tuple[str, ...]
    required_geoip_categories: tuple[str, ...]
    required_ruleset_categories: tuple[str, ...]
    max_category_drop_percent: float


def require_mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or not all(
        isinstance(key, str) for key in value
    ):
        raise RulesGenerationConfigError(f"{label} must be an object")
    return value


def require_exact_keys(
    value: dict[str, Any], expected: set[str], label: str
) -> None:
    actual = set(value)
    if actual == expected:
        return
    details: list[str] = []
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing:
        details.append("missing " + ", ".join(missing))
    if unexpected:
        details.append("unexpected " + ", ".join(unexpected))
    raise RulesGenerationConfigError(f"{label} keys are invalid: {'; '.join(details)}")


def require_category(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or not CATEGORY_RE.fullmatch(value)
        or ".." in value
        or value.startswith(".")
        or value.endswith(".")
    ):
        raise RulesGenerationConfigError(f"invalid {label}: {value!r}")
    return value


def require_categories(value: Any, label: str) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise RulesGenerationConfigError(f"{label} must be an array")
    categories = tuple(
        require_category(category, f"{label} category") for category in value
    )
    if len(categories) != len(set(categories)):
        raise RulesGenerationConfigError(f"{label} contains duplicate categories")
    return categories


def require_positive_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise RulesGenerationConfigError(f"{label} must be a positive integer")
    return value


def load_rules_generation_config(path: Path) -> RulesGenerationConfig:
    if path.is_symlink() or not path.is_file():
        raise RulesGenerationConfigError(f"config file is required: {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RulesGenerationConfigError(
            f"cannot read config {path}: {error}"
        ) from error

    root = require_mapping(raw, "config")
    require_exact_keys(
        root,
        {
            "schema_version",
            "aliases",
            "minimum_categories",
            "required_categories",
            "max_category_drop_percent",
        },
        "config",
    )
    if root["schema_version"] != SCHEMA_VERSION:
        raise RulesGenerationConfigError(
            f"unsupported config schema version: {root['schema_version']!r}"
        )

    raw_aliases = require_mapping(root["aliases"], "aliases")
    aliases = tuple(
        sorted(
            (
                require_category(alias, "alias"),
                require_category(source, f"source for alias {alias!r}"),
            )
            for alias, source in raw_aliases.items()
        )
    )
    if any(alias == source for alias, source in aliases):
        raise RulesGenerationConfigError("an alias must differ from its source")

    minimums = require_mapping(root["minimum_categories"], "minimum_categories")
    required = require_mapping(root["required_categories"], "required_categories")
    expected_collections = set(COLLECTIONS)
    require_exact_keys(minimums, expected_collections, "minimum_categories")
    require_exact_keys(required, expected_collections, "required_categories")

    minimum_values = {
        name: require_positive_integer(
            minimums[name], f"minimum_categories.{name}"
        )
        for name in COLLECTIONS
    }
    required_values = {
        name: require_categories(required[name], f"required_categories.{name}")
        for name in COLLECTIONS
    }
    for name in COLLECTIONS:
        if minimum_values[name] < len(required_values[name]):
            raise RulesGenerationConfigError(
                f"minimum_categories.{name} is smaller than its required list"
            )

    drop_percent = root["max_category_drop_percent"]
    if (
        not isinstance(drop_percent, (int, float))
        or isinstance(drop_percent, bool)
        or not 0 <= float(drop_percent) <= 100
    ):
        raise RulesGenerationConfigError(
            "max_category_drop_percent must be between 0 and 100"
        )

    return RulesGenerationConfig(
        aliases=aliases,
        minimum_custom_categories=minimum_values["custom"],
        minimum_geosite_categories=minimum_values["geosite"],
        minimum_geoip_categories=minimum_values["geoip"],
        minimum_ruleset_categories=minimum_values["ruleset"],
        required_custom_categories=required_values["custom"],
        required_geosite_categories=required_values["geosite"],
        required_geoip_categories=required_values["geoip"],
        required_ruleset_categories=required_values["ruleset"],
        max_category_drop_percent=float(drop_percent),
    )
