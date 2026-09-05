import unittest
from hook_test_support import HookTestCase


class FormatLintTests(HookTestCase):
    def test_codex_patch_checks_both_changed_sides(self):
        self.file('backend/a.go')
        self.file('frontend/a.ts')
        result = self.invoke(cwd=self.root / 'sub', tool_name='apply_patch', tool_input={'command':
            '*** Begin Patch\n*** Update File: ../backend/a.go\n*** Update File: ../frontend/a.ts\n*** End Patch'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(['make', ['-s', '-C', 'backend', 'fmt', 'lint']], self.commands())
        self.assertIn(['make', ['-s', 'frontend-fmt']], self.commands())

    def test_claude_edit_handles_quoted_filename(self):
        path = self.file('backend/a "quoted" file.go')
        result = self.invoke(agent='claude', tool_input={'file_path': str(path)})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any(name == 'make' for name, _ in self.commands()))

    def test_stop_checks_untracked_files_and_prevents_continuation_loop(self):
        self.file('backend/a "quoted" file.go')
        result = self.invoke('Stop', stop_hook_active=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any(name == 'make' for name, _ in self.commands()))
        self.log.unlink()
        result = self.invoke('Stop', stop_hook_active=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.commands(), [])

    def test_lint_failure_is_returned(self):
        path = self.file('backend/a.go')
        self.env['HOOK_FAIL_MATCH'] = 'make'
        result = self.invoke(tool_input={'file_path': str(path)})
        self.assertEqual(result.returncode, 2)
        self.assertIn('fixture diagnostic', result.stderr)

    def test_docker_unavailable_skips_checks(self):
        path = self.file('backend/a.go')
        self.env['HOOK_DOCKER_DOWN'] = '1'
        result = self.invoke(tool_input={'file_path': str(path)})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(name == 'make' for name, _ in self.commands()))

    def test_docs_do_not_run_formatters(self):
        path = self.file('README.md')
        result = self.invoke(tool_input={'file_path': str(path)})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(name == 'make' for name, _ in self.commands()))


if __name__ == '__main__':
    unittest.main()
