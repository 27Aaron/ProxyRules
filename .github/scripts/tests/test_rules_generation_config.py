from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from rules_generation_config import (  # noqa: E402
    RulesGenerationConfigError,
    load_rules_generation_config,
)


class RulesGenerationConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.path = Path(self.temporary_directory.name) / "rules-generation.json"
        self.config = {
            "schema_version": 1,
            "aliases": {"360": "qihoo360"},
            "minimum_categories": {
                "custom": 1,
                "geosite": 2,
                "geoip": 1,
                "ruleset": 2,
            },
            "required_categories": {
                "custom": ["anthropic"],
                "geosite": ["115", "anthropic"],
                "geoip": ["anthropic"],
                "ruleset": ["anthropic", "anthropic-direct"],
            },
            "max_category_drop_percent": 5.0,
        }

    def write(self) -> None:
        self.path.write_text(json.dumps(self.config), encoding="utf-8")

    def test_loads_valid_config(self) -> None:
        self.write()

        config = load_rules_generation_config(self.path)

        self.assertEqual(config.aliases, (("360", "qihoo360"),))
        self.assertEqual(config.minimum_ruleset_categories, 2)
        self.assertEqual(
            config.required_geosite_categories,
            ("115", "anthropic"),
        )
        self.assertEqual(config.max_category_drop_percent, 5.0)

    def test_rejects_unknown_keys(self) -> None:
        self.config["unknown"] = True
        self.write()

        with self.assertRaisesRegex(
            RulesGenerationConfigError,
            "unexpected unknown",
        ):
            load_rules_generation_config(self.path)

    def test_rejects_duplicate_categories(self) -> None:
        self.config["required_categories"]["custom"] = [
            "anthropic",
            "anthropic",
        ]
        self.config["minimum_categories"]["custom"] = 2
        self.write()

        with self.assertRaisesRegex(
            RulesGenerationConfigError,
            "duplicate categories",
        ):
            load_rules_generation_config(self.path)

    def test_rejects_minimum_below_required_count(self) -> None:
        self.config["minimum_categories"]["geosite"] = 1
        self.write()

        with self.assertRaisesRegex(
            RulesGenerationConfigError,
            "smaller than its required list",
        ):
            load_rules_generation_config(self.path)


if __name__ == "__main__":
    unittest.main()
