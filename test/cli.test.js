// Concern: freezes the verbs a user types, and the error envelope and exit code each fault returns | Non-concern: what install writes into a settings file | IO: none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

/** @param {string} body */
function settingsFile(body) {
  const path = join(mkdtempSync(join(tmpdir(), 'wwt-')), 'settings.json');
  writeFileSync(path, body);
  return path;
}

test('an unknown agent is refused as a usage error, naming what is known', () => {
  try {
    execFileSync(CLI, ['install-agent-hook', 'ollama'], { encoding: 'utf8', stdio: 'pipe' });
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
    execFileSync(CLI, ['install-agent-hook', 'claude', '--settings', path], { encoding: 'utf8' }),
  );
  assert.equal(installed.status, 'success');
  assert.equal(installed.data.path, path);

  // The flag before the resource must not be eaten as the agent.
  const preview = JSON.parse(
    execFileSync(CLI, ['uninstall-agent-hook', '--settings', path, 'claude'], { encoding: 'utf8' }),
  );
  assert.equal(preview.data.preview, true);
});
