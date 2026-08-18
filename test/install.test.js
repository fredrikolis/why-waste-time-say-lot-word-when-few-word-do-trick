// Concern: freezes what install and uninstall do to a settings file | Non-concern: the argv surface that reaches them, which cli.test.js owns | IO: none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, uninstall } from '../src/hosts/claude.js';

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** @param {string} body */
function settingsFile(body) {
  const path = join(mkdtempSync(join(tmpdir(), 'wwt-')), 'settings.json');
  writeFileSync(path, body);
  return path;
}

test('install is idempotent and preserves foreign hooks', async () => {
  const path = settingsFile(
    JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other-tool' }] }] } }),
  );

  const first = await install(path, 'a');
  await install(path, 'b');
  const settings = read(path);

  for (const event of first.events) {
    const ours = settings.hooks[event].filter((/** @type {any} */ e) =>
      e.hooks.some((/** @type {any} */ h) => h.command.includes('why-waste-time')),
    );
    assert.equal(ours.length, 1, `${event} has ${ours.length} entries`);
  }
  assert.equal(settings.model, 'opus');
  assert.equal(settings.hooks.Stop.filter((/** @type {any} */ e) => e.hooks[0].command === 'other-tool').length, 1);
});

test('a second install never overwrites the first backup', async () => {
  const path = settingsFile(JSON.stringify({ model: 'opus' }));

  const first = await install(path, 'first');
  const second = await install(path, 'second');

  assert.ok(first.backup && second.backup);
  assert.notEqual(first.backup, second.backup);
  assert.equal(read(first.backup).hooks, undefined, 'the pristine copy must survive');
});

test('uninstall removes only our entries', async () => {
  const path = settingsFile(JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other' }] }] } }));
  const { events } = await install(path, 'a');
  const { removed } = await uninstall(path, 'b');

  // Derived, not hardcoded: adding a registration must not silently un-freeze this.
  assert.equal(removed, events.length);
  assert.equal(read(path).hooks.Stop.length, 1);
  assert.equal(read(path).hooks.Stop[0].hooks[0].command, 'other');
});

test('a settings file that is not JSON is reported, not thrown as a stack', async () => {
  const path = settingsFile('{ "model": "opus", }');
  await assert.rejects(() => install(path, 'a'), /not valid JSON/);
});
