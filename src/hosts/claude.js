// Concern: speaks Claude Code's hook dialect, its output envelope and settings.json registration | Non-concern: which tool call is a file write (event.js) | IO: (text) -> envelope; (path) -> file
import { readFile, writeFile, copyFile, rename, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { NAME } from '../tool.js';

const COMMAND = `${NAME} remind claude`;

/** @type {{ event: string, matcher: string | null }[]} */
const REGISTRATIONS = [
  { event: 'SessionStart', matcher: 'startup|resume|clear|compact' },
  { event: 'Stop', matcher: null },
  { event: 'PostToolUse', matcher: 'Write|Edit' },
];

export function settingsPath() {
  return join(homedir(), '.claude', 'settings.json');
}

/**
 * @param {string} text
 * @param {import('../event.js').Event} event
 */
export function envelope(text, event) {
  /** @type {Record<import('../event.js').EventKind, string>} */
  const names = {
    'session-start': 'SessionStart',
    prompt: 'UserPromptSubmit',
    stop: 'Stop',
    'file-write': 'PostToolUse',
    other: 'PostToolUse',
  };
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: names[event.kind], additionalContext: text },
  });
}

/** @param {string} path */
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/** @param {any[]} entries */
function withoutOurs(entries) {
  return entries.filter(
    (entry) =>
      !(entry?.hooks ?? []).some((/** @type {any} */ h) => typeof h?.command === 'string' && h.command.includes(NAME)),
  );
}

/**
 * Never reuses a backup name: a second run must not overwrite the pristine copy the first one
 * saved. `stamp` is passed in so the caller owns the clock.
 *
 * @param {string} path
 * @param {string} stamp
 */
async function backUp(path, stamp) {
  const backup = `${path}.bak-${stamp}`;
  await copyFile(path, backup);
  return backup;
}

/**
 * @param {any} settings
 * @param {string} path
 */
async function writeAtomic(settings, path) {
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  await rename(tmp, path);
}

/** @param {string} path */
async function readSettings(path) {
  const raw = await readFile(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new SyntaxError(`${path} is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
  }
}

/**
 * @param {string} path
 * @param {string} stamp
 * @returns {Promise<{ path: string, backup: string | null, events: string[] }>}
 */
export async function install(path, stamp) {
  await mkdir(dirname(path), { recursive: true });
  const present = await exists(path);
  const settings = present ? await readSettings(path) : {};
  const backup = present ? await backUp(path, stamp) : null;

  settings.hooks ??= {};
  for (const { event, matcher } of REGISTRATIONS) {
    const entry = { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: COMMAND }] };
    settings.hooks[event] = [...withoutOurs(settings.hooks[event] ?? []), entry];
  }

  await writeAtomic(settings, path);
  return { path, backup, events: REGISTRATIONS.map((r) => r.event) };
}

/**
 * @param {string} path
 * @returns {Promise<number>}
 */
export async function pending(path) {
  if (!(await exists(path))) return 0;
  const settings = await readSettings(path);
  return Object.values(settings.hooks ?? {}).reduce(
    (/** @type {number} */ n, /** @type {any} */ entries) => n + (entries.length - withoutOurs(entries).length),
    0,
  );
}

/**
 * @param {string} path
 * @param {string} stamp
 * @returns {Promise<{ path: string, backup: string | null, removed: number }>}
 */
export async function uninstall(path, stamp) {
  if (!(await exists(path))) return { path, backup: null, removed: 0 };
  const settings = await readSettings(path);
  const backup = await backUp(path, stamp);

  let removed = 0;
  for (const event of Object.keys(settings.hooks ?? {})) {
    const kept = withoutOurs(settings.hooks[event]);
    removed += settings.hooks[event].length - kept.length;
    if (kept.length > 0) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks ?? {}).length === 0) delete settings.hooks;

  await writeAtomic(settings, path);
  return { path, backup, removed };
}
