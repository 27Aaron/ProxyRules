from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "format-repo.py"
SPEC = importlib.util.spec_from_file_location("format_repo", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
format_repo = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = format_repo
SPEC.loader.exec_module(format_repo)


class ResolveFormattersTests(unittest.TestCase):
    def test_missing_formatters_fail_in_ci(self) -> None:
        with self.assertRaisesRegex(
            format_repo.FormattingError,
            r"prettier, yamlfmt",
        ):
            format_repo.resolve_formatters(
                ("prettier", "yamlfmt"),
                ci=True,
                finder=lambda _name: None,
            )

    def test_missing_formatters_are_optional_outside_ci(self) -> None:
        with mock.patch.object(format_repo.sys, "stderr"):
            paths = format_repo.resolve_formatters(
                ("prettier", "yamlfmt"),
                ci=False,
                finder=lambda _name: None,
            )

        self.assertEqual(paths, {"prettier": None, "yamlfmt": None})


class FormatMarkdownTests(unittest.TestCase):
    def test_disables_repository_prettier_config(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "README.md").write_text("# Test\n", encoding="utf-8")
            calls: list[tuple[list[str], dict[str, object]]] = []

            def runner(command: list[str], **kwargs: object) -> None:
                calls.append((command, kwargs))

            format_repo.format_markdown(root, "/tools/prettier", runner=runner)

        self.assertEqual(len(calls), 1)
        command, kwargs = calls[0]
        self.assertIn("--no-config", command)
        self.assertIn("--no-editorconfig", command)
        self.assertIn("--ignore-path=/dev/null", command)
        separator = command.index("--")
        self.assertEqual(command[separator + 1 :], ["README.md"])
        self.assertEqual(kwargs["cwd"], root)

    def test_filename_cannot_be_interpreted_as_an_option(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            filename = "--config=untrusted.md"
            (root / filename).write_text("# Test\n", encoding="utf-8")
            calls: list[list[str]] = []

            format_repo.format_markdown(
                root,
                "/tools/prettier",
                runner=lambda command, **_kwargs: calls.append(command),
            )

        self.assertEqual(len(calls), 1)
        separator = calls[0].index("--")
        self.assertEqual(calls[0][separator + 1 :], [filename])

    def test_rejects_symbolic_link_targets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            target = Path(directory) / "outside.md"
            target.write_text("# Outside\n", encoding="utf-8")
            (root / "linked.md").symlink_to(target)

            with self.assertRaisesRegex(
                format_repo.FormattingError,
                r"symbolic link: linked\.md",
            ):
                format_repo.format_markdown(root, "/tools/prettier")


class FormatYamlTests(unittest.TestCase):
    def test_missing_required_config_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "rules.yaml").write_text("key: value\n", encoding="utf-8")

            with self.assertRaisesRegex(
                format_repo.FormattingError,
                "required yamlfmt config not found",
            ):
                format_repo.format_yaml(
                    root,
                    "/tools/yamlfmt",
                    require_config=True,
                )

    def test_failure_does_not_leave_partial_yaml_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "a.yaml"
            second = root / "b.yml"
            first.write_text("a:  1\n", encoding="utf-8")
            second.write_text("b:  2\n", encoding="utf-8")
            results = iter(
                (
                    subprocess.CompletedProcess([], 0, "a: 1\n", ""),
                    subprocess.CompletedProcess([], 2, "", "invalid yaml"),
                )
            )

            def process_runner(*_args: object, **_kwargs: object):
                return next(results)

            with self.assertRaisesRegex(
                format_repo.FormattingError,
                r"b\.yml.*invalid yaml",
            ):
                format_repo.format_yaml(
                    root,
                    "/tools/yamlfmt",
                    process_runner=process_runner,
                )

            self.assertEqual(first.read_text(encoding="utf-8"), "a:  1\n")
            self.assertEqual(second.read_text(encoding="utf-8"), "b:  2\n")

    def test_success_writes_all_yaml_after_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "a.yaml"
            second = root / "b.yml"
            first.write_text("a:  1\n", encoding="utf-8")
            second.write_text(
                "base: &base\n"
                "  key: value\n"
                "merged:\n"
                "  !!merge <<: *base\n"
                'literal: "!!merge <<: literal"\n',
                encoding="utf-8",
            )
            results = iter(
                (
                    subprocess.CompletedProcess([], 0, "a: 1\n", ""),
                    subprocess.CompletedProcess(
                        [],
                        0,
                        "base: &base\n"
                        "  key: value\n"
                        "merged:\n"
                        "  <<: *base\n"
                        'literal: "!!merge <<: literal"\n',
                        "",
                    ),
                )
            )

            format_repo.format_yaml(
                root,
                "/tools/yamlfmt",
                process_runner=lambda *_args, **_kwargs: next(results),
            )

            self.assertEqual(first.read_text(encoding="utf-8"), "a: 1\n")
            self.assertEqual(
                second.read_text(encoding="utf-8"),
                "base: &base\n"
                "  key: value\n"
                "merged:\n"
                "  <<: *base\n"
                'literal: "!!merge <<: literal"\n',
            )

    def test_rejects_symbolic_link_config(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_dir = root / ".github"
            config_dir.mkdir()
            target = root / "outside-yamlfmt.yml"
            target.write_text("formatter: {}\n", encoding="utf-8")
            (config_dir / "yamlfmt.yml").symlink_to(target)
            (root / "rules.yaml").write_text("key: value\n", encoding="utf-8")

            with self.assertRaisesRegex(
                format_repo.FormattingError,
                "config must not be a symbolic link",
            ):
                format_repo.format_yaml(root, "/tools/yamlfmt")

    def test_converts_crlf_yaml_to_lf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "rules.yaml"
            path.write_bytes(b"key: value\r\n")

            format_repo.format_yaml(
                root,
                "/tools/yamlfmt",
                process_runner=lambda *_args, **_kwargs: subprocess.CompletedProcess(
                    [], 0, "key: value\n", ""
                ),
            )

            self.assertEqual(path.read_bytes(), b"key: value\n")


class TrimListConfTests(unittest.TestCase):
    def test_converts_crlf_to_lf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "rules.list"
            path.write_bytes(b"DOMAIN,example.com\r\n")

            format_repo.trim_list_conf(root)

            self.assertEqual(path.read_bytes(), b"DOMAIN,example.com\n")


class MainTests(unittest.TestCase):
    def test_formatter_failure_returns_nonzero(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with (
                mock.patch.object(format_repo, "repo_root", return_value=root),
                mock.patch.object(format_repo.os, "chdir"),
                mock.patch.object(
                    format_repo,
                    "resolve_formatters",
                    side_effect=format_repo.FormattingError("missing"),
                ),
                mock.patch.object(format_repo.sys, "stderr"),
            ):
                result = format_repo.main()

        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main()
