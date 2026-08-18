// Concern: freezes the hook envelope Claude Code parses | Non-concern: which counts trigger a reminder, and settings registration | IO: none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NAME } from '../src/tool.js';

// Bounds must come from the defaults, never from whatever config this machine happens to carry.
// Both are stated, never inherited: CI has no Claude Code environment to borrow them from.
const env = {
  ...process.env,
  [`${NAME.toUpperCase().replace(/-/g, '_')}_CONFIG`]: '/nonexistent/lwp-test.json',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
};

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

/** @param {object} payload */
const remind = (payload) =>
  execFileSync(CLI, ['remind', 'claude'], { input: JSON.stringify(payload), encoding: 'utf8', env });

test('SessionStart emits additionalContext under hookSpecificOutput', () => {
  const out = JSON.parse(remind({ hook_event_name: 'SessionStart', session_id: 's1' }));
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /Report findings/);
});

test('a breach emits a tagged warning carrying the counts', () => {
  const wordy = Array(120).fill('word').join(' ');
  const out = JSON.parse(remind({ hook_event_name: 'Stop', session_id: 's1', last_assistant_message: wordy }));
  assert.equal(out.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(
    out.hookSpecificOutput.additionalContext,
    /^<why-waste-time-say-lot-word-when-few-word-do-trick-warning>/,
  );
  assert.match(out.hookSpecificOutput.additionalContext, /longest paragraph \d+ words \(max \d+\)/);
});

test('a stop-hook continuation never warns again', () => {
  const wordy = Array(120).fill('word').join(' ');
  assert.equal(
    remind({ hook_event_name: 'Stop', session_id: 's1', stop_hook_active: true, last_assistant_message: wordy }),
    '',
  );
});

test('an event with no reminder emits nothing', () => {
  assert.equal(remind({ hook_event_name: 'Stop', session_id: 's1' }), '');
});

test('a malformed payload never blocks the session', () => {
  assert.equal(
    execFileSync(CLI, ['remind', 'claude'], {
      input: 'not json',
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'ignore'],
    }),
    '',
  );
});
