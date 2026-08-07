from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "validate-maintenance-diff.py"
SPEC = importlib.util.spec_from_file_location("validate_maintenance_diff", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
validator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator
SPEC.loader.exec_module(validator)


class MaintenanceDiffTests(unittest.TestCase):
    def test_parses_modified_paths(self) -> None:
        paths = validator.parse_changed_paths(
            b"M\0README.md\0M\0Clash/Rules/Test/Test.list\0"
        )

        self.assertEqual(
            paths,
            [Path("README.md"), Path("Clash/Rules/Test/Test.list")],
        )

    def test_rejects_non_modification_changes(self) -> None:
        with self.assertRaisesRegex(
            validator.MaintenanceDiffError,
            "attempted a 'A' change",
        ):
            validator.parse_changed_paths(b"A\0README.md\0")

    def test_rejects_github_paths(self) -> None:
        with self.assertRaisesRegex(
            validator.MaintenanceDiffError,
            "must not modify .github",
        ):
            validator.validate_path(Path(".github/workflows/ci.yml"))

    def test_rejects_unsupported_extensions(self) -> None:
        with self.assertRaisesRegex(
            validator.MaintenanceDiffError,
            "unexpected maintenance path",
        ):
            validator.validate_path(Path("Scripts/example.js"))


if __name__ == "__main__":
    unittest.main()
