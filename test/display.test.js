// Concern: freezes the MessageDisplay envelope, the counts it reports, and that a message is withheld until measured | Non-concern: what the agent is told about it | IO: none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

/** @param {'warn' | 'redact'} mode */
function envFor(mode) {
  const config = join(mkdtempSync(join(tmpdir(), 'wwt-cfg-')), 'config.json');
  writeFileSync(config, JSON.stringify({ chatEnforcement: mode, maxChatLines: 50 }));
  return {
    ...process.env,
    WHY_WASTE_TIME_SAY_LOT_WORD_WHEN_FEW_WORD_DO_TRICK_CONFIG: config,
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    WHY_WASTE_TIME_SAY_LOT_WORD_WHEN_FEW_WORD_DO_TRICK_STATE: mkdtempSync(join(tmpdir(), 'wwt-state-')),
  };
}

/** @param {object} payload @param {NodeJS.ProcessEnv} env */
const show = (payload, env) =>
  execFileSync(CLI, ['remind', 'claude'], { input: JSON.stringify(payload), encoding: 'utf8', env });

const long = () => Array.from({ length: 61 }, (_, i) => `line ${i}`).join('\n');

test('an over-long message is replaced, and the envelope names MessageDisplay', () => {
  const out = JSON.parse(
    show(
      { hook_event_name: 'MessageDisplay', session_id: 'a', message_id: 'm', final: true, delta: long() },
      envFor('redact'),
    ),
  );
  assert.equal(out.hookSpecificOutput.hookEventName, 'MessageDisplay');
  assert.match(out.hookSpecificOutput.displayContent, /^\n\[redacted by the /);
  assert.match(out.hookSpecificOutput.displayContent, /61 lines \(max 50\)/);
});

test('nothing is shown until the message is complete', () => {
  const env = envFor('redact');
  const partial = JSON.parse(
    show(
      { hook_event_name: 'MessageDisplay', session_id: 'b', message_id: 'm', final: false, delta: 'first half\n' },
      env,
    ),
  );
  assert.equal(partial.hookSpecificOutput.displayContent, '');

  // The buffered half must reappear once the message completes within the bounds.
  const done = JSON.parse(
    show(
      { hook_event_name: 'MessageDisplay', session_id: 'b', message_id: 'm', final: true, delta: 'second half' },
      env,
    ),
  );
  assert.equal(done.hookSpecificOutput.displayContent, 'first half\nsecond half');
});

test('warn mode leaves the delta alone', () => {
  assert.equal(
    show(
      { hook_event_name: 'MessageDisplay', session_id: 'c', message_id: 'm', final: true, delta: long() },
      envFor('warn'),
    ),
    '',
  );
});

test('a compliant message after a redaction does not erase it before Stop', () => {
  const env = envFor('redact');
  const session = 'turn-shape';
  show({ hook_event_name: 'MessageDisplay', session_id: session, message_id: 'a', final: true, delta: long() }, env);
  show({ hook_event_name: 'MessageDisplay', session_id: session, message_id: 'b', final: true, delta: 'ok' }, env);

  const stop = JSON.parse(show({ hook_event_name: 'Stop', session_id: session, last_assistant_message: 'Done.' }, env));
  assert.match(stop.hookSpecificOutput.additionalContext, /61 lines \(max 50\)/);
  assert.match(stop.hookSpecificOutput.additionalContext, /FULLY REDACTED/);
});
