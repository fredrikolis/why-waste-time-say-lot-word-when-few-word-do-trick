// Concern: freezes the verbs a user types, and the error envelope and exit code each fault returns | Non-concern: what install writes into a settings file | IO: none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

// install persists the mode it registered under, so the suite must not aim that at the real one,
// and no test may inherit another's config: order would otherwise decide what each exercises.
const freshEnv = () => ({
  ...process.env,
  WHY_WASTE_TIME_SAY_LOT_WORD_WHEN_FEW_WORD_DO_TRICK_CONFIG: join(
    mkdtempSync(join(tmpdir(), 'wwt-cfg-')),
    'config.json',
  ),
  WHY_WASTE_TIME_SAY_LOT_WORD_WHEN_FEW_WORD_DO_TRICK_STATE: mkdtempSync(join(tmpdir(), 'wwt-state-')),
  CLAUDE_CODE_ENTRYPOINT: 'cli',
});

/** @param {string} body */
function settingsFile(body) {
  const path = join(mkdtempSync(join(tmpdir(), 'wwt-')), 'settings.json');
  writeFileSync(path, body);
  return path;
}

test('an unknown agent is refused as a usage error, naming what is known', () => {
  try {
    execFileSync(CLI, ['install-agent-hook', 'ollama'], { encoding: 'utf8', env: freshEnv(), stdio: 'pipe' });
    assert.fail('expected a non-zero exit');
  } catch (cause) {
    const e = /** @type {any} */ (cause);
    assert.equal(e.status, 2);
    assert.match(JSON.parse(e.stdout).error.message, /unknown agent: ollama\. known: claude/);
  }
});

test('the hook verbs are reachable by the names a user types', () => {
  const path = settingsFile('{}');
  const installed = JSON.parse(
    execFileSync(CLI, ['install-agent-hook', 'claude', '--settings', path], { encoding: 'utf8', env: freshEnv() }),
  );
  assert.equal(installed.status, 'success');
  assert.equal(installed.data.path, path);

  // The flag before the resource must not be eaten as the agent.
  const preview = JSON.parse(
    execFileSync(CLI, ['uninstall-agent-hook', '--settings', path, 'claude'], { encoding: 'utf8', env: freshEnv() }),
  );
  assert.equal(preview.data.preview, true);
});

test('configure reports every field, its flag, and what it accepts', () => {
  const out = JSON.parse(execFileSync(CLI, ['configure'], { encoding: 'utf8', env: freshEnv() }));
  const chat = out.data.fields.chatEnforcement;
  assert.equal(chat.flag, '--chat-enforcement');
  assert.deepEqual(chat.accepts, ['warn', 'redact']);
  assert.equal(chat.default, 'warn');
});

test('configure stores an override and reports it as in force', () => {
  const out = JSON.parse(
    execFileSync(CLI, ['configure', '--response-lines', '25', '--chat-enforcement', 'redact'], {
      encoding: 'utf8',
      env: freshEnv(),
    }),
  );
  assert.equal(out.data.fields.responseLines.value, 25);
  assert.equal(out.data.fields.responseLines.overridden, true);
  assert.equal(out.data.fields.chatEnforcement.value, 'redact');
});

test('configure refuses a bad value as validation, and an unknown option as usage', () => {
  /** @type {[string[], number, string][]} */
  const cases = [
    [['configure', '--response-lines', '0'], 3, 'validation_error'],
    [['configure', '--chat-enforcement', 'bogus'], 3, 'validation_error'],
    [['configure', '--tool-enforcement', 'redact'], 3, 'validation_error'],
    [['configure', '--response-line', '25'], 2, 'bad_arguments'],
  ];
  for (const [args, status, code] of cases) {
    try {
      execFileSync(CLI, args, { encoding: 'utf8', env: freshEnv(), stdio: 'pipe' });
      assert.fail(`expected ${args.join(' ')} to exit non-zero`);
    } catch (cause) {
      const e = /** @type {any} */ (cause);
      assert.equal(e.status, status, args.join(' '));
      assert.equal(JSON.parse(e.stdout).error.code, code);
    }
  }
});
