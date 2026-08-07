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

    def test_has_only_scheduled_manual_and_reusable_triggers(self) -> None:
        self.assertNotIn("\n  push:", self.workflow)
        self.assertIn('cron: "30 4 * * *"', self.workflow)
        self.assertIn("timezone: Asia/Shanghai", self.workflow)
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertIn("workflow_call:", self.workflow)
        self.assertIn("          ref: main", self.workflow)

    def test_keeps_runtime_validation_without_repeating_unit_tests(self) -> None:
        self.assertIn(
            ".github/scripts/validate-generated-rules.sh",
            self.workflow,
        )
        self.assertNotIn("Test generation scripts", self.workflow)
        self.assertNotIn("python3 .github/scripts/tests/", self.workflow)

    def test_publishes_one_beijing_time_commit_safely(self) -> None:
        self.assertIn("TZ: Asia/Shanghai", self.workflow)
        self.assertIn(
            'commit_time="$(date \'+%Y-%m-%d %H:%M:%S\')"',
            self.workflow,
        )
        self.assertNotIn("UTC+08:00", self.workflow)
        self.assertIn('"chore(rules): update ${commit_time}"', self.workflow)
        self.assertIn(
            'test "$(git -C "$PUBLISH_DIR" rev-list --count HEAD)" -eq 1',
            self.workflow,
        )
        self.assertIn(
            '[[ "$(git -C "$PUBLISH_DIR" log -1 --format=%cI)" == *+08:00 ]]',
            self.workflow,
        )
        self.assertIn('if [[ -n "$PREVIOUS_SHA" ]]; then', self.workflow)
        self.assertIn(
            '"--force-with-lease=refs/heads/${TARGET_BRANCH}:${PREVIOUS_SHA}"',
            self.workflow,
        )
        self.assertNotIn("push --force ", self.workflow)
        self.assertNotIn("push -f ", self.workflow)


if __name__ == "__main__":
    unittest.main()
