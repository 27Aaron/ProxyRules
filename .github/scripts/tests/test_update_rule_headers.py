from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "update-rule-headers.py"
SPEC = importlib.util.spec_from_file_location("update_rule_headers", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
headers = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(headers)

OLD_UPDATED = "2026-01-02 03:04:05"
NEW_UPDATED = "2026-08-05 12:34:56"


class HeaderTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.path = self.root / "Clash/Rules/Example/Example.list"
        self.path.parent.mkdir(parents=True)

    def write(self, text: str) -> None:
        self.path.write_text(text, encoding="utf-8")

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8")

    def canonical(self, body: str, updated: str = OLD_UPDATED) -> str:
        return headers.with_header("Example", body, updated)

    def process(
        self,
        *,
        base: str | None = "base",
        previous: str | None = None,
        force: bool = False,
    ) -> str:
        with mock.patch.object(headers, "git_show", return_value=previous):
            return headers.process_file(
                self.path,
                NEW_UPDATED,
                force,
                self.root,
                base,
            )

    def test_repairs_metadata_without_changing_updated_for_same_body(self) -> None:
        body = "DOMAIN,example.com\nIP-CIDR,192.0.2.0/24\n"
        corrupted = self.canonical(body).replace(
            "# AUTHOR: 27Aaron", "# AUTHOR: somebody"
        ).replace("# TOTAL: 2", "# TOTAL: 99")
        self.write(corrupted)

        result = self.process(previous=self.canonical(body))

        self.assertEqual(result, "updated")
        self.assertEqual(self.read(), self.canonical(body))
        self.assertIn(f"# UPDATED: {OLD_UPDATED}", self.read())

    def test_repairs_incomplete_type_counts_without_timestamp_churn(self) -> None:
        body = "DOMAIN,example.com\nIP-CIDR,192.0.2.0/24\n"
        incomplete = self.canonical(body).replace("# DOMAIN: 1\n", "")
        self.write(incomplete)

        self.process(previous=self.canonical(body))

        self.assertEqual(self.read(), self.canonical(body))

    def test_removes_malformed_core_metadata(self) -> None:
        body = "DOMAIN,example.com\n"
        malformed = self.canonical(body).replace(
            "# AUTHOR: 27Aaron", "# AUTHOR somebody"
        )
        self.write(malformed)

        self.process(previous=self.canonical(body))

        self.assertEqual(self.read(), self.canonical(body))

    def test_refreshes_updated_when_body_changed(self) -> None:
        old_body = "DOMAIN,old.example\n"
        new_body = "DOMAIN,new.example\n"
        self.write(self.canonical(new_body))

        self.process(previous=self.canonical(old_body))

        self.assertEqual(self.read(), self.canonical(new_body, NEW_UPDATED))

    def test_refreshes_updated_for_new_file_even_with_copied_header(self) -> None:
        body = "DOMAIN,example.com\n"
        self.write(self.canonical(body))

        self.process(previous=None)

        self.assertEqual(self.read(), self.canonical(body, NEW_UPDATED))

    def test_adds_missing_header_with_fresh_updated(self) -> None:
        body = "DOMAIN,example.com\n"
        self.write(body)

        self.process(previous=body)

        self.assertEqual(self.read(), self.canonical(body, NEW_UPDATED))

    def test_invalid_updated_is_replaced(self) -> None:
        body = "DOMAIN,example.com\n"
        self.write(self.canonical(body).replace(OLD_UPDATED, "not-a-date"))

        self.process(previous=self.canonical(body))

        self.assertEqual(self.read(), self.canonical(body, NEW_UPDATED))

    def test_no_base_still_repairs_metadata_and_preserves_updated(self) -> None:
        body = "DOMAIN,example.com\n"
        self.write(self.canonical(body).replace("# TOTAL: 1", "# TOTAL: 20"))

        self.process(base=None)

        self.assertEqual(self.read(), self.canonical(body))

    def test_force_refreshes_updated(self) -> None:
        body = "DOMAIN,example.com\n"
        self.write(self.canonical(body))

        self.process(previous=self.canonical(body), force=True)

        self.assertEqual(self.read(), self.canonical(body, NEW_UPDATED))

    def test_canonical_unchanged_file_is_skipped(self) -> None:
        body = "DOMAIN,example.com\n"
        original = self.canonical(body)
        self.write(original)

        result = self.process(previous=original)

        self.assertEqual(result, "skip")
        self.assertEqual(self.read(), original)

    def test_canonical_crlf_file_is_rewritten_to_lf(self) -> None:
        body = "DOMAIN,example.com\n"
        canonical = self.canonical(body)
        self.path.write_bytes(canonical.replace("\n", "\r\n").encode("utf-8"))

        result = self.process(base=None)

        self.assertEqual(result, "updated")
        self.assertEqual(self.path.read_bytes(), canonical.encode("utf-8"))


class BaseRevisionTests(unittest.TestCase):
    def test_explicit_base_is_used(self) -> None:
        with mock.patch.object(headers, "git_revision_exists", return_value=True):
            self.assertEqual(
                headers.resolve_base("abc123", explicit=True),
                "abc123",
            )

    def test_all_zero_base_means_no_comparison_base(self) -> None:
        with mock.patch.object(headers, "git_revision_exists") as exists:
            self.assertIsNone(headers.resolve_base("0" * 40, explicit=True))
        exists.assert_not_called()

    def test_missing_default_base_is_allowed_for_initial_commit(self) -> None:
        with mock.patch.object(headers, "git_revision_exists", return_value=False):
            self.assertIsNone(headers.resolve_base(None, explicit=False))

    def test_invalid_explicit_base_is_rejected(self) -> None:
        with mock.patch.object(headers, "git_revision_exists", return_value=False):
            with self.assertRaisesRegex(
                headers.InvalidBaseRevision, "does not exist: missing"
            ):
                headers.resolve_base("missing", explicit=True)


class GitHistoryFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.path = self.root / "Clash/Rules/Example/Example.list"
        self.path.parent.mkdir(parents=True)
        self.git("init", "--initial-branch=main")
        self.git("config", "user.name", "Tests")
        self.git("config", "user.email", "tests@example.invalid")

    def git(self, *args: str) -> str:
        return subprocess.check_output(
            ["git", *args],
            cwd=self.root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()

    def test_detects_body_change_missed_by_event_base(self) -> None:
        old_body = "DOMAIN,old.example\n"
        new_body = "DOMAIN,new.example\n"
        self.path.write_text(old_body, encoding="utf-8")
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "original rule")
        self.path.write_text(
            headers.with_header("Example", old_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "baseline header")

        self.path.write_text(
            headers.with_header("Example", new_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "change rule body")
        body_change = self.git("rev-parse", "HEAD")
        self.git("commit", "--allow-empty", "-m", "unrelated push")

        result = headers.process_file(
            self.path,
            NEW_UPDATED,
            False,
            self.root,
            body_change,
            history_fallback=True,
        )

        self.assertEqual(result, "updated")
        self.assertEqual(
            self.path.read_text(encoding="utf-8"),
            headers.with_header("Example", new_body, NEW_UPDATED),
        )

    def test_header_commit_after_formatting_does_not_churn(self) -> None:
        unformatted_body = "  DOMAIN,example.com  \n"
        formatted_body = "DOMAIN,example.com\n"
        self.path.write_text(
            headers.with_header("Example", unformatted_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "baseline")

        self.path.write_text(
            headers.with_header("Example", formatted_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "format rule")
        self.path.write_text(
            headers.with_header("Example", formatted_body, NEW_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "refresh header")
        event_base = self.git("rev-parse", "HEAD")
        self.git("commit", "--allow-empty", "-m", "unrelated push")

        result = headers.process_file(
            self.path,
            "2026-08-05 13:00:00",
            False,
            self.root,
            event_base,
            history_fallback=True,
        )

        self.assertEqual(result, "skip")
        self.assertEqual(
            self.path.read_text(encoding="utf-8"),
            headers.with_header("Example", formatted_body, NEW_UPDATED),
        )

    def test_rename_history_failure_refreshes_conservatively(self) -> None:
        old_body = "DOMAIN,old.example\n"
        new_body = "DOMAIN,new.example\n"
        self.path.write_text(
            headers.with_header("Example", old_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "baseline header")

        renamed = self.path.with_name("Renamed.list")
        self.git(
            "mv",
            self.path.relative_to(self.root).as_posix(),
            renamed.relative_to(self.root).as_posix(),
        )
        renamed.write_text(
            headers.with_header("Example", new_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", renamed.relative_to(self.root).as_posix())
        self.git("commit", "-m", "rename and change rule")
        event_base = self.git("rev-parse", "HEAD")
        self.git("commit", "--allow-empty", "-m", "unrelated push")

        result = headers.process_file(
            renamed,
            NEW_UPDATED,
            False,
            self.root,
            event_base,
            history_fallback=True,
        )

        self.assertEqual(result, "updated")
        self.assertEqual(
            renamed.read_text(encoding="utf-8"),
            headers.with_header(
                "Renamed",
                new_body,
                NEW_UPDATED,
                "Clash/Rules/Example/Renamed.list",
            ),
        )

    def test_new_file_race_refreshes_copied_timestamp(self) -> None:
        body = "DOMAIN,example.com\n"
        self.git("commit", "--allow-empty", "-m", "baseline")
        self.path.write_text(
            headers.with_header("Example", body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "add copied rule")
        event_base = self.git("rev-parse", "HEAD")
        self.git("commit", "--allow-empty", "-m", "unrelated push")

        result = headers.process_file(
            self.path,
            NEW_UPDATED,
            False,
            self.root,
            event_base,
            history_fallback=True,
        )

        self.assertEqual(result, "updated")
        self.assertEqual(
            self.path.read_text(encoding="utf-8"),
            headers.with_header("Example", body, NEW_UPDATED),
        )

    def test_same_timestamp_line_rewrite_is_not_a_header_update(self) -> None:
        old_body = "DOMAIN,old.example\n"
        new_body = "DOMAIN,new.example\n"
        self.path.write_text(old_body, encoding="utf-8")
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "original rule")
        self.path.write_text(
            headers.with_header("Example", old_body, OLD_UPDATED),
            encoding="utf-8",
        )
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "add header")

        rewritten = headers.with_header("Example", new_body, OLD_UPDATED).replace(
            "\n", "\r\n"
        )
        self.path.write_bytes(rewritten.encode("utf-8"))
        self.git("add", "--", self.path.relative_to(self.root).as_posix())
        self.git("commit", "-m", "rewrite file without updating timestamp")
        event_base = self.git("rev-parse", "HEAD")
        self.git("commit", "--allow-empty", "-m", "unrelated push")

        result = headers.process_file(
            self.path,
            NEW_UPDATED,
            False,
            self.root,
            event_base,
            history_fallback=True,
        )

        self.assertEqual(result, "updated")
        self.assertEqual(
            self.path.read_text(encoding="utf-8"),
            headers.with_header("Example", new_body, NEW_UPDATED),
        )


class RulePathTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name) / "repo"
        self.root.mkdir()

    def test_accepts_nested_managed_rule_path(self) -> None:
        resolved = headers.resolve_rule_path(
            "Clash/Rules/Example/Example.yaml", self.root
        )
        self.assertEqual(
            resolved,
            self.root.resolve() / "Clash/Rules/Example/Example.yaml",
        )

    def test_rejects_path_outside_repository(self) -> None:
        with self.assertRaisesRegex(headers.InvalidRulePath, "outside repository"):
            headers.resolve_rule_path(self.root.parent / "outside.list", self.root)

    def test_rejects_non_rule_path(self) -> None:
        with self.assertRaisesRegex(headers.InvalidRulePath, "not a managed rule"):
            headers.resolve_rule_path("Clash/config.yaml", self.root)

    def test_rejects_unsupported_rule_extension(self) -> None:
        with self.assertRaisesRegex(headers.InvalidRulePath, "not a managed rule"):
            headers.resolve_rule_path("Clash/Rules/Example/rules.txt", self.root)

    def test_rejects_symbolic_rule_path(self) -> None:
        target = self.root / "Clash/Rules/Example/Target.list"
        target.parent.mkdir(parents=True)
        target.write_text("DOMAIN,example.com\n", encoding="utf-8")
        linked = target.with_name("Linked.list")
        linked.symlink_to(target)

        with self.assertRaisesRegex(headers.InvalidRulePath, "symbolic links"):
            headers.resolve_rule_path(linked, self.root)


class MainTests(unittest.TestCase):
    def test_any_missing_explicit_path_returns_nonzero(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            existing = root / "Clash/Rules/Example/Example.list"
            existing.parent.mkdir(parents=True)
            existing.write_text("DOMAIN,example.com\n", encoding="utf-8")
            missing = existing.with_name("Missing.list")

            with (
                mock.patch.object(headers, "repo_root", return_value=root),
                mock.patch.object(headers, "resolve_base", return_value=None),
                mock.patch.object(headers, "process_file", return_value="skip"),
                mock.patch.object(headers.sys, "stderr"),
            ):
                result = headers.main(
                    ["update-rule-headers.py", str(existing), str(missing)]
                )

        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main()
