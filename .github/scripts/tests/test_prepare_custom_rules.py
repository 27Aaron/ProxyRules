from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "prepare-custom-rules.py"
SPEC = importlib.util.spec_from_file_location("prepare_custom_rules", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
preparer = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = preparer
SPEC.loader.exec_module(preparer)


class PrepareCustomRulesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.custom = self.root / "custom"
        self.geosite = self.root / "geosite-classical"
        self.geoip = self.root / "geoip"
        self.output = self.root / "output"
        self.custom.mkdir()
        self.geosite.mkdir()
        self.geoip.mkdir()

    def add_custom(self, name: str, lines: list[str]) -> None:
        directory = self.custom / name
        directory.mkdir()
        (directory / f"{name}.list").write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )

    def prepare(self, *, required: tuple[str, ...] = ()):
        return preparer.prepare(
            custom_dir=self.custom,
            geosite_classical_dir=self.geosite,
            geoip_dir=self.geoip,
            output_dir=self.output,
            minimum_categories=1,
            required_categories=required,
        )

    def test_merges_upstream_and_custom_rules_for_all_outputs(self) -> None:
        (self.geosite / "anthropic.list").write_text(
            "DOMAIN-SUFFIX,claude.ai\n"
            "DOMAIN-REGEX,^api[0-9]+\\.claude\\.ai$\n",
            encoding="utf-8",
        )
        (self.geoip / "anthropic.list").write_text(
            "160.79.104.0/23\n", encoding="utf-8"
        )
        self.add_custom(
            "anthropic",
            [
                "# maintained additions",
                "DOMAIN-SUFFIX,claude.ai",
                "DOMAIN,api.anthropic.com",
                "DOMAIN-KEYWORD,claude",
                "IP-CIDR,160.79.104.1/23,no-resolve",
                "IP-CIDR6,2607:6bc0:11::1/48,no-resolve",
            ],
        )

        metadata = self.prepare(required=("anthropic",))

        self.assertEqual(
            (self.output / "geosite/domain/anthropic.list").read_text(
                encoding="utf-8"
            ),
            "+.claude.ai\napi.anthropic.com\n",
        )
        self.assertEqual(
            (self.output / "geosite/classical/anthropic.list").read_text(
                encoding="utf-8"
            ),
            "DOMAIN-SUFFIX,claude.ai\n"
            "DOMAIN-REGEX,^api[0-9]+\\.claude\\.ai$\n"
            "DOMAIN,api.anthropic.com\n"
            "DOMAIN-KEYWORD,claude\n",
        )
        self.assertEqual(
            (self.output / "geoip/anthropic.list").read_text(encoding="utf-8"),
            "160.79.104.0/23\n2607:6bc0:11::/48\n",
        )
        ruleset = (self.output / "ruleset/anthropic.list").read_text(
            encoding="utf-8"
        )
        self.assertIn("DOMAIN-REGEX,^api[0-9]+\\.claude\\.ai$\n", ruleset)
        self.assertEqual(ruleset.count("160.79.104.0/23"), 1)
        self.assertIn("IP-CIDR6,2607:6bc0:11::/48,no-resolve\n", ruleset)
        self.assertEqual(
            metadata["categories"]["anthropic"]["merged_counts"],
            {"geosite": 4, "geoip": 2, "ruleset": 6},
        )

    def test_strips_actions_from_combined_ruleset_and_records_them(self) -> None:
        self.add_custom(
            "ip-attribution",
            [
                "DOMAIN,www.example.com",
                "DOMAIN-SUFFIX,static.example.com,DIRECT",
                "IP-CIDR,192.0.2.7/24,REJECT,no-resolve",
            ],
        )

        metadata = self.prepare()

        ruleset = (self.output / "ruleset/ip-attribution.list").read_text(
            encoding="utf-8"
        )
        self.assertEqual(
            ruleset,
            "DOMAIN,www.example.com\n"
            "DOMAIN-SUFFIX,static.example.com\n"
            "IP-CIDR,192.0.2.0/24,no-resolve\n",
        )
        self.assertNotIn("DIRECT", ruleset)
        self.assertNotIn("REJECT", ruleset)
        self.assertEqual(
            metadata["categories"]["ip-attribution"]["actions"],
            {"default": 1, "direct": 1, "reject": 1},
        )

    def test_rejects_unknown_modifier(self) -> None:
        self.add_custom(
            "anthropic",
            [
                "DOMAIN-SUFFIX,anthropic.com,PROXY",
                "IP-CIDR,192.0.2.0/24,no-resolve",
            ],
        )

        with self.assertRaisesRegex(preparer.PreparationError, "unsupported modifier"):
            self.prepare()

    def test_rejects_duplicate_matcher_after_cidr_normalization(self) -> None:
        self.add_custom(
            "anthropic",
            [
                "DOMAIN-SUFFIX,anthropic.com",
                "IP-CIDR,192.0.2.7/24,no-resolve",
                "IP-CIDR,192.0.2.0/24,no-resolve",
            ],
        )

        with self.assertRaisesRegex(preparer.PreparationError, "duplicate custom"):
            self.prepare()

    def test_rejects_missing_required_category(self) -> None:
        self.add_custom(
            "anthropic",
            [
                "DOMAIN-SUFFIX,anthropic.com",
                "IP-CIDR,192.0.2.0/24,no-resolve",
            ],
        )

        with self.assertRaisesRegex(
            preparer.PreparationError, "required custom categories are missing"
        ):
            self.prepare(required=("openai",))


if __name__ == "__main__":
    unittest.main()
