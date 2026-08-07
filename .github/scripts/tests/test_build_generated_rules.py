from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = SCRIPTS_DIR / "build-generated-rules.py"
sys.path.insert(0, str(SCRIPTS_DIR))
SPEC = importlib.util.spec_from_file_location("build_generated_rules", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
generator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)

PUBLISHED_AT = "2026-08-05T18:44:53Z"


class GeneratedRulesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.domain = self.root / "converted"
        self.classical = self.domain / "classical"
        self.srs = self.root / "sing-box"
        self.geoip = self.root / "converted-geoip"
        self.geoip_srs = self.root / "converted-geoip-sing"
        self.ruleset = self.root / "prepared-ruleset"
        self.ruleset_srs = self.root / "compiled-ruleset"
        self.output = self.root / "output"
        self.domain.mkdir()
        self.classical.mkdir()
        self.srs.mkdir()
        self.geoip.mkdir()
        self.geoip_srs.mkdir()
        self.ruleset.mkdir()
        self.ruleset_srs.mkdir()

    def test_cli_loads_shared_generation_config(self) -> None:
        config_path = Path(__file__).resolve().parents[2] / "rules-generation.json"
        commit = "a" * 40
        published_at = "2026-08-07T00:00:00Z"

        options = generator.parse_args(
            [
                "--config",
                str(config_path),
                "--domain-dir",
                str(self.domain),
                "--classical-dir",
                str(self.classical),
                "--srs-dir",
                str(self.srs),
                "--geoip-dir",
                str(self.geoip),
                "--geoip-srs-dir",
                str(self.geoip_srs),
                "--ruleset-dir",
                str(self.ruleset),
                "--ruleset-srs-dir",
                str(self.ruleset_srs),
                "--output-dir",
                str(self.output),
                "--source-release",
                "source",
                "--source-commit",
                commit,
                "--source-published-at",
                published_at,
                "--geoip-source-release",
                "geoip",
                "--geoip-source-commit",
                commit,
                "--geoip-source-published-at",
                published_at,
                "--custom-source-commit",
                commit,
                "--custom-source-published-at",
                published_at,
                "--converter-commit",
                commit,
            ]
        )

        self.assertEqual(options.minimum_categories, 1000)
        self.assertEqual(options.minimum_ruleset_categories, 2000)
        self.assertIn("anthropic", options.required_categories)
        self.assertEqual(options.aliases, (("360", "qihoo360"),))

    def add_category(
        self,
        name: str,
        domain_rules: list[str],
        classical_rules: list[str],
    ) -> None:
        (self.domain / f"{name}.list").write_text(
            "\n".join(domain_rules), encoding="utf-8"
        )
        (self.domain / f"{name}.yaml").write_text(
            "payload:\n"
            + "".join(f"    - {rule}\n" for rule in domain_rules),
            encoding="utf-8",
        )
        (self.classical / f"{name}.list").write_text(
            "\n".join(classical_rules), encoding="utf-8"
        )
        (self.domain / f"{name}.mrs").write_bytes(f"mrs:{name}".encode())
        (self.srs / f"{name}.srs").write_bytes(f"srs:{name}".encode())
        if any(not rule.startswith("DOMAIN-REGEX,") for rule in classical_rules):
            self.merge_ruleset_category(name, classical_rules)

    def add_geoip_category(self, name: str, cidrs: list[str]) -> None:
        (self.geoip / f"{name}.list").write_text(
            "\n".join(cidrs), encoding="utf-8"
        )
        (self.geoip / f"{name}.yaml").write_text(
            "payload:\n" + "".join(f"    - {cidr}\n" for cidr in cidrs),
            encoding="utf-8",
        )
        (self.geoip / f"{name}.mrs").write_bytes(f"geoip-mrs:{name}".encode())
        (self.geoip_srs / f"{name}.srs").write_bytes(
            f"geoip-srs:{name}".encode()
        )
        self.merge_ruleset_category(
            name,
            [
                f"{'IP-CIDR6' if ':' in cidr else 'IP-CIDR'},"
                f"{cidr},no-resolve"
                for cidr in cidrs
            ],
        )

    def add_ruleset_category(self, name: str, rules: list[str]) -> None:
        (self.ruleset / f"{name}.list").write_text(
            "\n".join(rules), encoding="utf-8"
        )
        (self.ruleset / f"{name}.yaml").write_text(
            "payload:\n" + "".join(f"    - {rule}\n" for rule in rules),
            encoding="utf-8",
        )
        (self.ruleset_srs / f"{name}.srs").write_bytes(
            f"ruleset-srs:{name}".encode()
        )

    def merge_ruleset_category(self, name: str, rules: list[str]) -> None:
        path = self.ruleset / f"{name}.list"
        existing = (
            path.read_text(encoding="utf-8").splitlines() if path.exists() else []
        )
        self.add_ruleset_category(name, list(dict.fromkeys([*existing, *rules])))

    def options(
        self,
        *,
        output: Path | None = None,
        previous: Path | None = None,
        minimum: int = 1,
        required: tuple[str, ...] = ("115",),
        aliases: tuple[tuple[str, str], ...] = (),
        allow_large_drop: bool = False,
    ):
        return generator.BuildOptions(
            domain_dir=self.domain,
            classical_dir=self.classical,
            srs_dir=self.srs,
            geoip_dir=self.geoip,
            geoip_srs_dir=self.geoip_srs,
            ruleset_dir=self.ruleset,
            ruleset_srs_dir=self.ruleset_srs,
            output_dir=output or self.output,
            previous_dir=previous,
            repository="27Aaron/ProxyRules",
            branch="rules",
            author="27Aaron",
            source_repository="v2fly/domain-list-community",
            source_release="test-release",
            source_commit="a" * 40,
            source_published_at=PUBLISHED_AT,
            geoip_source_repository="Loyalsoldier/geoip",
            geoip_source_release="test-geoip-release",
            geoip_source_commit="c" * 40,
            geoip_source_published_at="2026-08-06T00:32:51Z",
            custom_source_repository="27Aaron/ProxyRules",
            custom_source_ref="custom",
            custom_source_commit="d" * 40,
            custom_source_published_at="2026-08-07T05:30:00+08:00",
            custom_categories=(),
            converter_repository="MetaCubeX/meta-rules-converter",
            converter_commit="b" * 40,
            minimum_categories=minimum,
            minimum_geoip_categories=0,
            minimum_ruleset_categories=0,
            required_categories=required,
            required_geoip_categories=(),
            required_ruleset_categories=(),
            aliases=aliases,
            max_category_drop_percent=5.0,
            allow_large_drop=allow_large_drop,
        )

    def add_115(self) -> None:
        self.add_category(
            "115",
            ["exact.115.com", "+.115.com"],
            [
                "DOMAIN,exact.115.com",
                "DOMAIN-SUFFIX,115.com",
                "DOMAIN-KEYWORD,115cdn",
                r"DOMAIN-REGEX,^api[0-9]\\.115\\.com$",
            ],
        )

    def test_builds_category_first_layout_and_manifest(self) -> None:
        self.add_115()
        self.add_category(
            "regex-only",
            [],
            [r"DOMAIN-REGEX,^example[0-9]\\.com$"],
        )

        manifest = generator.build(self.options())

        list_path = self.output / "geosite/115/115.list"
        yaml_path = self.output / "geosite/115/115.yaml"
        mrs_path = self.output / "geosite/115/115.mrs"
        srs_path = self.output / "geosite/115/115.srs"
        self.assertTrue(list_path.is_file())
        self.assertTrue(yaml_path.is_file())
        self.assertEqual(mrs_path.read_bytes(), b"mrs:115")
        self.assertEqual(srs_path.read_bytes(), b"srs:115")
        self.assertFalse((self.output / "geosite/regex-only").exists())
        list_text = list_path.read_text(encoding="utf-8")
        yaml_text = yaml_path.read_text(encoding="utf-8")
        self.assertIn(
            "# LINK: https://raw.githubusercontent.com/27Aaron/ProxyRules/rules/"
            "geosite/115/115.list",
            list_text,
        )
        self.assertIn("# UPDATED: 2026-08-06 02:44:53 UTC+08:00", list_text)
        self.assertNotIn("# SOURCE:", list_text)
        self.assertIn("# UPDATED: 2026-08-06 02:44:53 UTC+08:00", yaml_text)
        self.assertNotIn("# SOURCE:", yaml_text)
        self.assertIn("# DOMAIN-KEYWORD: 1", list_text)
        self.assertIn("# OMITTED-DOMAIN-REGEX: 1", list_text)
        self.assertTrue(
            list_text.endswith(
                "DOMAIN,exact.115.com\n"
                "DOMAIN-SUFFIX,115.com\n"
                "DOMAIN-KEYWORD,115cdn\n"
            )
        )
        self.assertIn(
            "payload:\n"
            "  - 'DOMAIN,exact.115.com'\n"
            "  - 'DOMAIN-SUFFIX,115.com'\n"
            "  - 'DOMAIN-KEYWORD,115cdn'\n",
            yaml_text,
        )
        self.assertEqual(manifest["schema_version"], 2)
        self.assertEqual(manifest["mode"], "category-first")
        self.assertEqual(set(manifest["sources"]), {"geosite", "geoip", "custom"})
        self.assertEqual(set(manifest["collections"]), {"geosite", "geoip", "ruleset"})
        self.assertEqual(
            manifest["sources"]["geosite"]["repository"],
            "v2fly/domain-list-community",
        )
        self.assertEqual(
            manifest["sources"]["geoip"]["repository"], "Loyalsoldier/geoip"
        )
        self.assertEqual(manifest["sources"]["custom"]["ref"], "custom")
        for legacy_key in (
            "source",
            "geoip_source",
            "custom_source",
            "statistics",
            "categories",
            "geoip_categories",
            "ruleset_categories",
        ):
            self.assertNotIn(legacy_key, manifest)
        self.assertEqual(
            manifest["converter"],
            {
                "repository": "MetaCubeX/meta-rules-converter",
                "commit": "b" * 40,
            },
        )
        geosite = manifest["collections"]["geosite"]
        self.assertEqual(geosite["sources"], ["geosite", "custom"])
        self.assertEqual(
            manifest["collections"]["geoip"]["sources"], ["geoip", "custom"]
        )
        self.assertEqual(
            manifest["collections"]["ruleset"]["sources"],
            ["geosite", "geoip", "custom"],
        )
        statistics = geosite["statistics"]
        self.assertEqual(statistics["source_categories"], 2)
        self.assertEqual(statistics["generated_categories"], 1)
        self.assertEqual(statistics["omitted_categories"], 1)
        self.assertEqual(statistics["source_rules"], 5)
        self.assertEqual(
            statistics["formats"],
            {
                "list": {
                    "files": 1,
                    "rules": 3,
                    "counts": {
                        "domain": 1,
                        "domain_keyword": 1,
                        "domain_suffix": 1,
                    },
                    "omitted": {"domain_regex": 2},
                },
                "yaml": {
                    "files": 1,
                    "rules": 3,
                    "counts": {
                        "domain": 1,
                        "domain_keyword": 1,
                        "domain_suffix": 1,
                    },
                    "omitted": {"domain_regex": 2},
                },
                "mrs": {
                    "files": 1,
                    "rules": 2,
                    "counts": {"domain": 1, "domain_suffix": 1},
                    "omitted": {"domain_keyword": 1, "domain_regex": 2},
                },
                "srs": {
                    "files": 1,
                    "rules": 4,
                    "counts": {
                        "domain": 1,
                        "domain_keyword": 1,
                        "domain_regex": 1,
                        "domain_suffix": 1,
                    },
                    "omitted": {"domain_regex": 1},
                },
            },
        )
        category = geosite["categories"]["115"]
        self.assertEqual(
            category["source_counts"],
            {
                "domain": 1,
                "domain_suffix": 1,
                "domain_keyword": 1,
                "domain_regex": 1,
                "total": 4,
            },
        )
        self.assertEqual(
            set(category["formats"]),
            {"list", "yaml", "mrs", "srs"},
        )
        self.assertEqual(category["formats"]["list"]["rules"], 3)
        self.assertEqual(
            category["formats"]["list"]["omitted"], {"domain_regex": 1}
        )
        self.assertEqual(category["formats"]["mrs"]["rules"], 2)
        self.assertEqual(
            category["formats"]["mrs"]["omitted"],
            {"domain_keyword": 1, "domain_regex": 1},
        )
        self.assertEqual(category["formats"]["srs"]["rules"], 4)
        self.assertEqual(category["formats"]["srs"]["omitted"], {})
        self.assertEqual(
            geosite["omitted_categories"]["regex-only"],
            {
                "reason": "category has no portable list or YAML rules",
                "source_counts": {"domain_regex": 1, "total": 1},
            },
        )
        self.assertFalse((self.output / "README.md").exists())
        self.assertTrue((self.output / "manifest.json").is_file())
        self.assertTrue((self.output / "SHA256SUMS").is_file())
        checksums = (self.output / "SHA256SUMS").read_text(encoding="utf-8")
        checksum_entries = {}
        for line in checksums.splitlines():
            digest, relative_path = line.split("  ", maxsplit=1)
            checksum_entries[relative_path] = digest
        self.assertEqual(
            set(checksum_entries),
            {
                "geosite/115/115.list",
                "geosite/115/115.mrs",
                "geosite/115/115.srs",
                "geosite/115/115.yaml",
                "manifest.json",
                "ruleset/115/115.list",
                "ruleset/115/115.srs",
                "ruleset/115/115.yaml",
            },
        )
        for relative_path, digest in checksum_entries.items():
            self.assertEqual(
                generator.sha256_bytes((self.output / relative_path).read_bytes()),
                digest,
            )

    def test_preserves_updated_when_source_category_is_unchanged(self) -> None:
        self.add_115()
        first_output = self.root / "first"
        first = generator.build(self.options(output=first_output))
        first_manifest_path = first_output / "manifest.json"
        saved = json.loads(first_manifest_path.read_text(encoding="utf-8"))
        saved["collections"]["geosite"]["categories"]["115"][
            "updated"
        ] = "2026-01-02T03:04:05Z"
        first_manifest_path.write_text(
            json.dumps(saved, indent=2) + "\n", encoding="utf-8"
        )

        second_output = self.root / "second"
        second = generator.build(
            self.options(output=second_output, previous=first_output)
        )

        self.assertEqual(
            second["collections"]["geosite"]["categories"]["115"]["updated"],
            "2026-01-02T03:04:05Z",
        )
        self.assertEqual(
            first["collections"]["geosite"]["categories"]["115"][
                "source_sha256"
            ],
            second["collections"]["geosite"]["categories"]["115"][
                "source_sha256"
            ],
        )
        second_list = (second_output / "geosite/115/115.list").read_text(
            encoding="utf-8"
        )
        self.assertIn("# UPDATED: 2026-01-02 11:04:05 UTC+08:00", second_list)

    def test_migrates_updated_timestamp_from_manifest_v1(self) -> None:
        self.add_115()
        previous = self.root / "previous-v1"
        previous.mkdir()
        source_hash = generator.sha256_text(
            (self.classical / "115.list").read_text(encoding="utf-8")
        )
        (previous / "manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "categories": {
                        "115": {
                            "updated": "2026-01-02T03:04:05Z",
                            "source_sha256": source_hash,
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        manifest = generator.build(self.options(previous=previous))

        self.assertEqual(
            manifest["collections"]["geosite"]["categories"]["115"]["updated"],
            "2026-01-02T03:04:05Z",
        )

    def test_builds_complete_geoip_category_with_correct_ip_types(self) -> None:
        self.add_115()
        self.add_geoip_category(
            "cn",
            ["1.0.1.0/24", "2001:db8::/32"],
        )
        options = replace(
            self.options(),
            minimum_geoip_categories=1,
            required_geoip_categories=("cn",),
        )

        manifest = generator.build(options)

        list_path = self.output / "geoip/cn/cn.list"
        yaml_path = self.output / "geoip/cn/cn.yaml"
        separator = "# -----------------------------------------------------"
        self.assertEqual(
            list_path.read_text(encoding="utf-8").split(separator)[-1].strip(),
            "IP-CIDR,1.0.1.0/24,no-resolve\n"
            "IP-CIDR6,2001:db8::/32,no-resolve",
        )
        list_text = list_path.read_text(encoding="utf-8")
        yaml_text = yaml_path.read_text(encoding="utf-8")
        self.assertIn("# IP-CIDR: 1", list_text)
        self.assertIn("# IP-CIDR6: 1", list_text)
        self.assertIn("# TOTAL: 2", list_text)
        self.assertIn("# UPDATED: 2026-08-06 08:32:51 UTC+08:00", list_text)
        self.assertIn("  - 'IP-CIDR,1.0.1.0/24,no-resolve'", yaml_text)
        self.assertIn("  - 'IP-CIDR6,2001:db8::/32,no-resolve'", yaml_text)
        self.assertEqual(
            (self.output / "geoip/cn/cn.mrs").read_bytes(), b"geoip-mrs:cn"
        )
        self.assertEqual(
            (self.output / "geoip/cn/cn.srs").read_bytes(), b"geoip-srs:cn"
        )
        geoip = manifest["collections"]["geoip"]
        category = geoip["categories"]["cn"]
        self.assertEqual(
            category["source_counts"],
            {"ipv4": 1, "ipv6": 1, "total": 2},
        )
        self.assertEqual(
            set(category["formats"]),
            {"list", "yaml", "mrs", "srs"},
        )
        for format_name in ("list", "yaml", "mrs", "srs"):
            self.assertEqual(category["formats"][format_name]["rules"], 2)
            self.assertEqual(
                category["formats"][format_name]["counts"],
                {"ipv4": 1, "ipv6": 1},
            )
            self.assertEqual(category["formats"][format_name]["omitted"], {})
        self.assertEqual(geoip["statistics"]["generated_categories"], 1)
        self.assertEqual(geoip["statistics"]["source_rules"], 2)
        self.assertEqual(
            geoip["statistics"]["formats"]["srs"],
            {
                "files": 1,
                "rules": 2,
                "counts": {"ipv4": 1, "ipv6": 1},
                "omitted": {},
            },
        )
        checksums = (self.output / "SHA256SUMS").read_text(encoding="utf-8")
        for suffix in ("list", "yaml", "mrs", "srs"):
            self.assertIn(f"  geoip/cn/cn.{suffix}\n", checksums)

    def test_rejects_noncanonical_geoip_rule(self) -> None:
        self.add_115()
        self.add_geoip_category("cn", ["1.0.1.1/24"])
        options = replace(self.options(), minimum_geoip_categories=1)

        with self.assertRaisesRegex(generator.GenerationError, "invalid GeoIP rule"):
            generator.build(options)

    def test_rejects_missing_required_geoip_category(self) -> None:
        self.add_115()
        self.add_geoip_category("cn", ["1.0.1.0/24"])
        options = replace(
            self.options(),
            minimum_geoip_categories=1,
            required_geoip_categories=("private",),
        )

        with self.assertRaisesRegex(
            generator.GenerationError, "required GeoIP categories are missing"
        ):
            generator.build(options)

    def test_builds_mixed_ruleset_without_mrs_and_omits_regex_from_text(self) -> None:
        self.add_115()
        self.add_category(
            "anthropic",
            ["api.anthropic.com", "+.anthropic.com"],
            [
                "DOMAIN,api.anthropic.com",
                "DOMAIN-SUFFIX,anthropic.com",
                "DOMAIN-KEYWORD,claude",
                r"DOMAIN-REGEX,^api[0-9]+\.anthropic\.com$",
            ],
        )
        self.add_geoip_category(
            "anthropic", ["160.79.104.0/23", "2607:6bc0::/48"]
        )
        self.add_ruleset_category(
            "anthropic",
            [
                "DOMAIN,api.anthropic.com",
                "DOMAIN-SUFFIX,anthropic.com",
                "DOMAIN-KEYWORD,claude",
                r"DOMAIN-REGEX,^api[0-9]+\.anthropic\.com$",
                "IP-CIDR,160.79.104.0/23,no-resolve",
                "IP-CIDR6,2607:6bc0::/48,no-resolve",
            ],
        )
        options = replace(
            self.options(),
            custom_categories=("anthropic",),
            minimum_ruleset_categories=1,
            required_ruleset_categories=("anthropic",),
        )

        manifest = generator.build(options)

        list_path = self.output / "ruleset/anthropic/anthropic.list"
        yaml_path = self.output / "ruleset/anthropic/anthropic.yaml"
        srs_path = self.output / "ruleset/anthropic/anthropic.srs"
        list_text = list_path.read_text(encoding="utf-8")
        self.assertTrue(yaml_path.is_file())
        self.assertEqual(srs_path.read_bytes(), b"ruleset-srs:anthropic")
        self.assertFalse((self.output / "ruleset/anthropic/anthropic.mrs").exists())
        self.assertNotIn("DOMAIN-REGEX,", list_text.split("\n\n", maxsplit=1)[-1])
        self.assertIn("# OMITTED-DOMAIN-REGEX: 1", list_text)
        self.assertIn("# IP-CIDR: 1", list_text)
        self.assertIn("# IP-CIDR6: 1", list_text)
        self.assertIn("# UPDATED: 2026-08-07 05:30:00 UTC+08:00", list_text)
        ruleset = manifest["collections"]["ruleset"]
        category = ruleset["categories"]["anthropic"]
        self.assertEqual(set(category["formats"]), {"list", "yaml", "srs"})
        self.assertEqual(
            category["source_counts"],
            {
                "domain": 1,
                "domain_suffix": 1,
                "domain_keyword": 1,
                "domain_regex": 1,
                "ipv4": 1,
                "ipv6": 1,
                "total": 6,
            },
        )
        self.assertEqual(category["formats"]["list"]["rules"], 5)
        self.assertEqual(
            category["formats"]["list"]["omitted"], {"domain_regex": 1}
        )
        self.assertEqual(category["formats"]["yaml"]["rules"], 5)
        self.assertEqual(category["formats"]["srs"]["rules"], 6)
        self.assertEqual(category["formats"]["srs"]["omitted"], {})
        self.assertEqual(ruleset["statistics"]["source_rules"], 10)
        self.assertEqual(
            ruleset["statistics"]["formats"]["list"]["omitted"],
            {"domain_regex": 2},
        )
        self.assertIn("mrs", ruleset["unsupported_formats"])
        self.assertIn(
            "mix domain and IP",
            ruleset["unsupported_formats"]["mrs"]["reason"],
        )
        geosite_text = (self.output / "geosite/anthropic/anthropic.list").read_text(
            encoding="utf-8"
        )
        geoip_text = (self.output / "geoip/anthropic/anthropic.list").read_text(
            encoding="utf-8"
        )
        self.assertIn("# UPDATED: 2026-08-07 05:30:00 UTC+08:00", geosite_text)
        self.assertIn("# UPDATED: 2026-08-07 05:30:00 UTC+08:00", geoip_text)

    def test_builds_complete_ruleset_union(self) -> None:
        self.add_115()
        self.add_category(
            "site-only",
            ["+.site.example"],
            ["DOMAIN-SUFFIX,site.example"],
        )
        self.add_geoip_category("ip-only", ["192.0.2.0/24"])
        self.add_category(
            "shared",
            ["+.shared.example"],
            ["DOMAIN-SUFFIX,shared.example"],
        )
        self.add_geoip_category("shared", ["2001:db8::/32"])

        manifest = generator.build(self.options())

        rulesets = manifest["collections"]["ruleset"]
        self.assertEqual(
            set(rulesets["categories"]),
            {"115", "ip-only", "shared", "site-only"},
        )
        self.assertEqual(rulesets["statistics"]["default_categories"], 4)
        self.assertEqual(rulesets["statistics"]["action_groups"], 0)
        shared = (self.output / "ruleset/shared/shared.list").read_text(
            encoding="utf-8"
        )
        self.assertIn("DOMAIN-SUFFIX,shared.example\n", shared)
        self.assertIn("IP-CIDR6,2001:db8::/32,no-resolve\n", shared)
        self.assertTrue((self.output / "ruleset/site-only/site-only.srs").is_file())
        self.assertTrue((self.output / "ruleset/ip-only/ip-only.yaml").is_file())

    def test_rejects_missing_complete_ruleset_category(self) -> None:
        self.add_115()
        for directory, suffix in (
            (self.ruleset, "list"),
            (self.ruleset, "yaml"),
            (self.ruleset_srs, "srs"),
        ):
            (directory / f"115.{suffix}").unlink()

        with self.assertRaisesRegex(
            generator.GenerationError,
            "complete ruleset categories disagree: missing 115",
        ):
            generator.build(self.options())

    def test_rejects_action_in_prepared_ruleset(self) -> None:
        self.add_115()
        self.add_category(
            "anthropic",
            ["+.anthropic.com"],
            ["DOMAIN-SUFFIX,anthropic.com"],
        )
        self.add_ruleset_category(
            "anthropic", ["DOMAIN-SUFFIX,anthropic.com,DIRECT"]
        )
        options = replace(
            self.options(),
            custom_categories=("anthropic",),
            minimum_ruleset_categories=1,
        )

        with self.assertRaisesRegex(generator.GenerationError, "unsupported ruleset"):
            generator.build(options)

    def test_places_ip_attribution_action_groups_in_one_directory(self) -> None:
        self.add_115()
        self.add_category(
            "ip-attribution",
            ["proxy.example.com"],
            ["DOMAIN,proxy.example.com"],
        )
        self.add_ruleset_category(
            "ip-attribution", ["DOMAIN,proxy.example.com"]
        )
        self.add_ruleset_category(
            "ip-attribution-direct", ["DOMAIN-SUFFIX,direct.example.com"]
        )
        self.add_ruleset_category(
            "ip-attribution-reject", ["IP-CIDR,192.0.2.0/24,no-resolve"]
        )
        required = (
            "ip-attribution",
            "ip-attribution-direct",
            "ip-attribution-reject",
        )
        options = replace(
            self.options(),
            custom_categories=("ip-attribution",),
            minimum_ruleset_categories=3,
            required_ruleset_categories=required,
        )

        manifest = generator.build(options)

        shared_directory = self.output / "ruleset/ip-attribution"
        for name in required:
            for suffix in ("list", "yaml", "srs"):
                self.assertTrue((shared_directory / f"{name}.{suffix}").is_file())
        self.assertFalse((self.output / "ruleset/ip-attribution-direct").exists())
        self.assertFalse((self.output / "ruleset/ip-attribution-reject").exists())
        categories = manifest["collections"]["ruleset"]["categories"]
        self.assertEqual(
            categories["ip-attribution"]["action"],
            "default",
        )
        self.assertEqual(
            categories["ip-attribution-direct"]["action"],
            "direct",
        )
        self.assertEqual(
            categories["ip-attribution-reject"]["action"],
            "reject",
        )
        for name in required:
            self.assertEqual(
                categories[name]["path"],
                "ruleset/ip-attribution",
            )

    def test_rejects_converter_disagreement(self) -> None:
        self.add_category(
            "115",
            ["+.different.example"],
            ["DOMAIN-SUFFIX,115.com"],
        )

        with self.assertRaisesRegex(
            generator.GenerationError, "converter outputs disagree"
        ):
            generator.build(self.options())

    def test_publishes_configured_alias_with_matching_rules(self) -> None:
        self.add_category(
            "qihoo360",
            ["+.360.com"],
            ["DOMAIN-SUFFIX,360.com"],
        )
        self.add_ruleset_category("360", ["DOMAIN-SUFFIX,360.com"])

        manifest = generator.build(
            self.options(
                required=("360",),
                aliases=(("360", "qihoo360"),),
            )
        )

        alias_path = self.output / "geosite/360/360.list"
        self.assertTrue(alias_path.is_file())
        self.assertEqual(
            (self.output / "geosite/360/360.mrs").read_bytes(), b"mrs:qihoo360"
        )
        self.assertEqual(
            (self.output / "geosite/360/360.srs").read_bytes(), b"srs:qihoo360"
        )
        self.assertTrue(
            alias_path.read_text(encoding="utf-8").endswith(
                "DOMAIN-SUFFIX,360.com\n"
            )
        )
        geosite = manifest["collections"]["geosite"]
        self.assertEqual(geosite["aliases"], {"360": "qihoo360"})
        self.assertEqual(geosite["categories"]["360"]["alias_of"], "qihoo360")
        self.assertEqual(geosite["statistics"]["source_rules"], 1)
        self.assertEqual(
            geosite["statistics"]["formats"]["list"]["rules"], 2
        )
        self.assertEqual(
            geosite["statistics"]["formats"]["list"]["files"], 2
        )

    def test_rejects_alias_when_source_has_no_portable_rules(self) -> None:
        self.add_category(
            "regex-only",
            [],
            [r"DOMAIN-REGEX,^example[0-9]\\.com$"],
        )

        with self.assertRaisesRegex(
            generator.GenerationError, "aliases have no portable source rules"
        ):
            generator.build(
                self.options(
                    required=(),
                    aliases=(("alias", "regex-only"),),
                )
            )

    def test_rejects_invalid_source_commit(self) -> None:
        self.add_115()
        options = replace(self.options(), source_commit="main")

        with self.assertRaisesRegex(generator.GenerationError, "source commit"):
            generator.build(options)

    def test_rejects_invalid_converter_commit(self) -> None:
        self.add_115()
        options = replace(self.options(), converter_commit="main")

        with self.assertRaisesRegex(generator.GenerationError, "converter commit"):
            generator.build(options)

    def test_rejects_invalid_geoip_source_commit(self) -> None:
        self.add_115()
        options = replace(self.options(), geoip_source_commit="master")

        with self.assertRaisesRegex(generator.GenerationError, "GeoIP source commit"):
            generator.build(options)

    def test_rejects_invalid_custom_source_commit(self) -> None:
        self.add_115()
        options = replace(self.options(), custom_source_commit="custom")

        with self.assertRaisesRegex(generator.GenerationError, "custom source commit"):
            generator.build(options)

    def test_rejects_unsafe_category_name(self) -> None:
        self.add_category("unsafe..name", ["example.com"], ["DOMAIN,example.com"])

        with self.assertRaisesRegex(generator.GenerationError, "unsafe category"):
            generator.build(self.options(required=()))

    def test_rejects_duplicate_domain_rule(self) -> None:
        self.add_category(
            "115",
            ["115.com", "115.com"],
            ["DOMAIN,115.com", "DOMAIN,115.com"],
        )

        with self.assertRaisesRegex(generator.GenerationError, "duplicate rule"):
            generator.build(self.options())

    def test_rejects_missing_binary_rule_file(self) -> None:
        self.add_115()
        (self.srs / "115.srs").unlink()

        with self.assertRaisesRegex(generator.GenerationError, "unable to read binary"):
            generator.build(self.options())

    def test_rejects_empty_binary_rule_file(self) -> None:
        self.add_115()
        (self.domain / "115.mrs").write_bytes(b"")

        with self.assertRaisesRegex(generator.GenerationError, "binary rule file is empty"):
            generator.build(self.options())

    def test_rejects_large_category_drop(self) -> None:
        self.add_115()
        previous = self.root / "previous"
        previous.mkdir()
        previous_categories = {
            f"category-{index}": {"updated": PUBLISHED_AT}
            for index in range(20)
        }
        (previous / "manifest.json").write_text(
            json.dumps({"categories": previous_categories}), encoding="utf-8"
        )

        with self.assertRaisesRegex(generator.GenerationError, "dropped"):
            generator.build(self.options(previous=previous))


if __name__ == "__main__":
    unittest.main()
