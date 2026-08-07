from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "build-generated-rules.py"
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
        self.output = self.root / "output"
        self.domain.mkdir()
        self.classical.mkdir()

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
            output_dir=output or self.output,
            previous_dir=previous,
            repository="27Aaron/ProxyRules",
            branch="rules",
            author="27Aaron",
            source_repository="v2fly/domain-list-community",
            source_release="test-release",
            source_commit="a" * 40,
            source_published_at=PUBLISHED_AT,
            converter_repository="MetaCubeX/meta-rules-converter",
            converter_commit="b" * 40,
            minimum_categories=minimum,
            required_categories=required,
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
        self.assertTrue(list_path.is_file())
        self.assertTrue(yaml_path.is_file())
        self.assertFalse((self.output / "geosite/regex-only").exists())
        list_text = list_path.read_text(encoding="utf-8")
        yaml_text = yaml_path.read_text(encoding="utf-8")
        self.assertIn(
            "# LINK: https://raw.githubusercontent.com/27Aaron/ProxyRules/rules/"
            "geosite/115/115.list",
            list_text,
        )
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
        self.assertEqual(manifest["statistics"]["source_categories"], 2)
        self.assertEqual(manifest["statistics"]["generated_categories"], 1)
        self.assertEqual(manifest["statistics"]["omitted_categories"], 1)
        self.assertEqual(manifest["statistics"]["portable_rules"], 3)
        self.assertEqual(manifest["statistics"]["published_rules"], 3)
        self.assertEqual(manifest["mode"], "portable-classical")
        self.assertEqual(
            manifest["converter"],
            {
                "repository": "MetaCubeX/meta-rules-converter",
                "commit": "b" * 40,
            },
        )
        self.assertEqual(
            manifest["categories"]["115"]["counts"],
            {
                "domain": 1,
                "domain_suffix": 1,
                "domain_keyword": 1,
                "omitted_domain_regex": 1,
                "total": 3,
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
                "geosite/115/115.yaml",
                "manifest.json",
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
        saved["categories"]["115"]["updated"] = "2026-01-02T03:04:05Z"
        first_manifest_path.write_text(
            json.dumps(saved, indent=2) + "\n", encoding="utf-8"
        )

        second_output = self.root / "second"
        second = generator.build(
            self.options(output=second_output, previous=first_output)
        )

        self.assertEqual(
            second["categories"]["115"]["updated"],
            "2026-01-02T03:04:05Z",
        )
        self.assertEqual(
            first["categories"]["115"]["source_sha256"],
            second["categories"]["115"]["source_sha256"],
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

        manifest = generator.build(
            self.options(
                required=("360",),
                aliases=(("360", "qihoo360"),),
            )
        )

        alias_path = self.output / "geosite/360/360.list"
        self.assertTrue(alias_path.is_file())
        self.assertTrue(
            alias_path.read_text(encoding="utf-8").endswith(
                "DOMAIN-SUFFIX,360.com\n"
            )
        )
        self.assertEqual(manifest["aliases"], {"360": "qihoo360"})
        self.assertEqual(manifest["categories"]["360"]["alias_of"], "qihoo360")
        self.assertEqual(manifest["statistics"]["portable_rules"], 1)
        self.assertEqual(manifest["statistics"]["published_rules"], 2)

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
