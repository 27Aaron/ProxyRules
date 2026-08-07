from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = SCRIPTS_DIR / "prepare-custom-rules.py"
sys.path.insert(0, str(SCRIPTS_DIR))
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

    def prepare(
        self,
        *,
        required: tuple[str, ...] = (),
        aliases: tuple[tuple[str, str], ...] = (),
    ):
        return preparer.prepare(
            custom_dir=self.custom,
            geosite_classical_dir=self.geosite,
            geoip_dir=self.geoip,
            output_dir=self.output,
            minimum_categories=1,
            required_categories=required,
            aliases=aliases,
        )

    def test_cli_loads_shared_generation_config(self) -> None:
        config_path = Path(__file__).resolve().parents[2] / "rules-generation.json"

        args = preparer.parse_args(
            [
                "--config",
                str(config_path),
                "--custom-dir",
                str(self.custom),
                "--geosite-classical-dir",
                str(self.geosite),
                "--geoip-dir",
                str(self.geoip),
                "--output-dir",
                str(self.output),
            ]
        )

        self.assertEqual(args.minimum_categories, 5)
        self.assertIn("anthropic", args.required_category)
        self.assertEqual(args.aliases, [("360", "qihoo360")])

    def test_prepares_complete_ruleset_union_and_aliases(self) -> None:
        (self.geosite / "site-only.list").write_text(
            "DOMAIN-SUFFIX,site.example\n", encoding="utf-8"
        )
        (self.geosite / "shared.list").write_text(
            "DOMAIN-KEYWORD,shared\n", encoding="utf-8"
        )
        (self.geosite / "alias-source.list").write_text(
            "DOMAIN-SUFFIX,alias.example\n", encoding="utf-8"
        )
        (self.geosite / "regex-only.list").write_text(
            r"DOMAIN-REGEX,^regex[0-9]+\.example$" "\n",
            encoding="utf-8",
        )
        (self.geoip / "ip-only.list").write_text(
            "192.0.2.0/24\n", encoding="utf-8"
        )
        (self.geoip / "shared.list").write_text(
            "2001:db8::/32\n", encoding="utf-8"
        )
        self.add_custom(
            "anthropic",
            [
                "DOMAIN-SUFFIX,anthropic.com",
                "IP-CIDR,160.79.104.0/23,no-resolve",
            ],
        )

        metadata = self.prepare(aliases=(("alias", "alias-source"),))

        self.assertEqual(
            set(metadata["rulesets"]),
            {
                "alias",
                "alias-source",
                "anthropic",
                "ip-only",
                "shared",
                "site-only",
            },
        )
        self.assertFalse((self.output / "ruleset/regex-only.list").exists())
        self.assertEqual(
            (self.output / "ruleset/site-only.list").read_text(encoding="utf-8"),
            "DOMAIN-SUFFIX,site.example\n",
        )
        self.assertEqual(
            (self.output / "ruleset/ip-only.list").read_text(encoding="utf-8"),
            "IP-CIDR,192.0.2.0/24,no-resolve\n",
        )
        self.assertEqual(
            (self.output / "ruleset/shared.list").read_text(encoding="utf-8"),
            "DOMAIN-KEYWORD,shared\n"
            "IP-CIDR6,2001:db8::/32,no-resolve\n",
        )
        self.assertEqual(
            (self.output / "ruleset/alias.list").read_text(encoding="utf-8"),
            "DOMAIN-SUFFIX,alias.example\n",
        )
        self.assertEqual(metadata["schema_version"], 2)
        self.assertEqual(metadata["aliases"], {"alias": "alias-source"})

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
        self.assertEqual(
            metadata["rulesets"]["anthropic"],
            {
                "source_category": "anthropic",
                "action": "default",
                "output_directory": "anthropic",
                "rules": 6,
            },
        )

    def test_splits_ip_attribution_rules_by_action(self) -> None:
        self.add_custom(
            "ip-attribution",
            [
                "DOMAIN,www.example.com",
                "DOMAIN-SUFFIX,static.example.com,DIRECT",
                "IP-CIDR,192.0.2.7/24,REJECT,no-resolve",
            ],
        )

        metadata = self.prepare()

        default_rules = (self.output / "ruleset/ip-attribution.list").read_text(
            encoding="utf-8"
        )
        direct_rules = (
            self.output / "ruleset/ip-attribution-direct.list"
        ).read_text(encoding="utf-8")
        reject_rules = (
            self.output / "ruleset/ip-attribution-reject.list"
        ).read_text(encoding="utf-8")
        self.assertEqual(default_rules, "DOMAIN,www.example.com\n")
        self.assertEqual(
            direct_rules, "DOMAIN-SUFFIX,static.example.com\n"
        )
        self.assertEqual(
            reject_rules, "IP-CIDR,192.0.2.0/24,no-resolve\n"
        )
        for rules in (default_rules, direct_rules, reject_rules):
            self.assertNotIn("DIRECT", rules)
            self.assertNotIn("REJECT", rules)
        self.assertEqual(
            metadata["categories"]["ip-attribution"]["actions"],
            {"default": 1, "direct": 1, "reject": 1},
        )
        self.assertEqual(
            metadata["rulesets"],
            {
                "ip-attribution": {
                    "source_category": "ip-attribution",
                    "action": "default",
                    "output_directory": "ip-attribution",
                    "rules": 1,
                },
                "ip-attribution-direct": {
                    "source_category": "ip-attribution",
                    "action": "direct",
                    "output_directory": "ip-attribution",
                    "rules": 1,
                },
                "ip-attribution-reject": {
                    "source_category": "ip-attribution",
                    "action": "reject",
                    "output_directory": "ip-attribution",
                    "rules": 1,
                },
            },
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
