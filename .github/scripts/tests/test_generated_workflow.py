from __future__ import annotations

import unittest
from pathlib import Path


WORKFLOW_PATH = (
    Path(__file__).resolve().parents[2] / "workflows/update-generated-rules.yml"
)


class GeneratedWorkflowInvariantTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    def test_rejects_readmes_and_symbolic_links(self) -> None:
        self.assertIn(
            "test -z \"$(find \"$output_dir\" -type l -print -quit)\"",
            self.workflow,
        )
        self.assertIn(
            "test -z \"$(find \"$output_dir\" -type f -iname 'README*' "
            "-print -quit)\"",
            self.workflow,
        )

    def test_requires_one_root_commit(self) -> None:
        self.assertIn(
            'test "$(git -C "$PUBLISH_DIR" rev-list --count HEAD)" -eq 1',
            self.workflow,
        )
        self.assertIn(
            '[[ "$root_commit" =~ ^[0-9a-f]{40}$ ]]',
            self.workflow,
        )

    def test_requires_beijing_commit_subject_and_offset(self) -> None:
        self.assertIn("TZ: Asia/Shanghai", self.workflow)
        self.assertIn(
            'commit_time="$(date \'+%Y-%m-%d %H:%M:%S UTC+08:00\')"',
            self.workflow,
        )
        self.assertIn(
            '"chore(rules): update ${commit_time}"',
            self.workflow,
        )
        self.assertIn(
            '[[ "$(git -C "$PUBLISH_DIR" log -1 --format=%cI)" == *+08:00 ]]',
            self.workflow,
        )

    def test_replaces_existing_branch_only_with_force_with_lease(self) -> None:
        self.assertIn('if [[ -n "$PREVIOUS_SHA" ]]; then', self.workflow)
        self.assertIn(
            '"--force-with-lease=refs/heads/${TARGET_BRANCH}:${PREVIOUS_SHA}"',
            self.workflow,
        )
        self.assertNotIn('push --force ', self.workflow)
        self.assertNotIn('push -f ', self.workflow)


if __name__ == "__main__":
    unittest.main()
