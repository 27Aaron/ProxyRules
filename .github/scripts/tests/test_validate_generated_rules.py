from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "validate-generated-rules.sh"
FORMATS = {
    "geosite": ("list", "yaml", "mrs", "srs"),
    "geoip": ("list", "yaml", "mrs", "srs"),
    "ruleset": ("list", "yaml", "srs"),
}


class ValidateGeneratedRulesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.output = self.root / "output"
        self.output.mkdir()
        self.metadata_path = self.root / "metadata.json"
        self.config_path = self.root / "config.json"

    def add_category(
        self,
        collection: str,
        name: str,
        *,
        directory: str = "alpha",
        action: str | None = None,
    ) -> dict[str, object]:
        formats: dict[str, object] = {}
        for format_name in FORMATS[collection]:
            relative = Path(collection) / directory / f"{name}.{format_name}"
            path = self.output / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(f"{collection}:{name}:{format_name}\n".encode())
            formats[format_name] = {
                "path": relative.as_posix(),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "rules": 7,
                "counts": {"domain_suffix": 7},
                "omitted": {},
            }
        category: dict[str, object] = {
            "path": f"{collection}/{directory}",
            "formats": formats,
        }
        if action is not None:
            category["action"] = action
        return category

    def write_valid_tree(self) -> None:
        config = {
            "schema_version": 1,
            "aliases": {},
            "minimum_categories": {
                "custom": 1,
                "geosite": 1,
                "geoip": 1,
                "ruleset": 2,
            },
            "required_categories": {
                "custom": ["alpha"],
                "geosite": ["alpha"],
                "geoip": ["alpha"],
                "ruleset": ["alpha", "alpha-direct"],
            },
            "max_category_drop_percent": 5.0,
        }
        metadata = {
            "aliases": {},
            "categories": {"alpha": {}},
            "rulesets": {
                "alpha": {
                    "action": "default",
                    "output_directory": "alpha",
                },
                "alpha-direct": {
                    "action": "direct",
                    "output_directory": "alpha",
                },
            },
        }
        manifest = {
            "schema_version": 2,
            "mode": "category-first",
            "sources": {"custom": {}, "geoip": {}, "geosite": {}},
            "collections": {
                "geosite": {
                    "path": "geosite",
                    "sources": ["geosite", "custom"],
                    "statistics": {"generated_categories": 1},
                    "categories": {
                        "alpha": self.add_category("geosite", "alpha")
                    },
                },
                "geoip": {
                    "path": "geoip",
                    "sources": ["geoip", "custom"],
                    "statistics": {"generated_categories": 1},
                    "categories": {"alpha": self.add_category("geoip", "alpha")},
                },
                "ruleset": {
                    "path": "ruleset",
                    "sources": ["geosite", "geoip", "custom"],
                    "statistics": {
                        "generated_categories": 2,
                        "default_categories": 1,
                        "action_groups": 1,
                    },
                    "unsupported_formats": {
                        "mrs": {"reason": "mixed domain and IP rules"}
                    },
                    "categories": {
                        "alpha": self.add_category(
                            "ruleset", "alpha", action="default"
                        ),
                        "alpha-direct": self.add_category(
                            "ruleset", "alpha-direct", action="direct"
                        ),
                    },
                },
            },
        }
        self.config_path.write_text(json.dumps(config), encoding="utf-8")
        self.metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
        (self.output / "manifest.json").write_text(
            json.dumps(manifest), encoding="utf-8"
        )
        checksums = []
        for path in sorted(self.output.rglob("*")):
            if path.is_file():
                relative = path.relative_to(self.output).as_posix()
                checksums.append(
                    f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}"
                )
        (self.output / "SHA256SUMS").write_text(
            "\n".join(checksums) + "\n", encoding="utf-8"
        )

    def run_validator(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                str(SCRIPT_PATH),
                str(self.output),
                str(self.metadata_path),
                str(self.config_path),
            ],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_accepts_complete_metadata_driven_tree(self) -> None:
        self.write_valid_tree()

        result = self.run_validator()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("validation passed", result.stdout)

    def test_rejects_readme(self) -> None:
        self.write_valid_tree()
        (self.output / "README.md").write_text("generated\n", encoding="utf-8")

        result = self.run_validator()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("contains a README", result.stderr)


if __name__ == "__main__":
    unittest.main()
