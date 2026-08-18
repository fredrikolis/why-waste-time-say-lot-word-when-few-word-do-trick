// Concern: speaks Claude Code's hook dialect, its envelope, its settings.json registration, and whether a human reads | Non-concern: what earns a reminder | IO: (text, env) -> envelope; (path) -> file
import { readFile, writeFile, copyFile, rename, mkdir, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { NAME } from '../tool.js';

const COMMAND = `${NAME} remind claude`;

/**
 * Every hook this tool ever needs is registered, whatever the mode. Config decides what each
 * one does, so changing a mode takes effect at once instead of leaving the settings file
 * describing a mode the user has since moved off.
 */
export const registrationsFor = () => [...REGISTRATIONS];

/** @type {{ event: string, matcher: string | null }[]} */
const REGISTRATIONS = [
  { event: 'SessionStart', matcher: 'startup|resume|clear|compact' },
  { event: 'Stop', matcher: null },
  { event: 'PostToolUse', matcher: 'Write|Edit' },
  // Both are inert unless chatEnforcement is redact: MessageDisplay leaves the delta alone and
  // PreToolUse has nothing pending to deliver.
  { event: 'MessageDisplay', matcher: null },
  { event: 'PreToolUse', matcher: null },
];

/**
 * Programmatic entrypoints, where the message IS the output and no human is reading it. Named
 * as a denylist: an allowlist silently disables the tool in vscode, jetbrains and the desktop
 * app, which are every bit as interactive as a terminal.
 */
const PROGRAMMATIC = new Set(['sdk-cli', 'sdk-ts', 'sdk-py', 'mcp', 'bench']);

export function isInteractive() {
  return !PROGRAMMATIC.has(process.env.CLAUDE_CODE_ENTRYPOINT ?? 'cli');
}

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
    display: 'MessageDisplay',
    'pre-tool': 'PreToolUse',
  };
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: names[event.kind], additionalContext: text },
  });
}

/** @param {string} text */
export function displayEnvelope(text) {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'MessageDisplay', displayContent: text },
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
 * @param {{ event: string, matcher: string | null }[]} wanted
 * @returns {Promise<{ path: string, backup: string | null, events: string[] }>}
 */
export async function install(path, stamp, wanted = REGISTRATIONS) {
  await mkdir(dirname(path), { recursive: true });
  const present = await exists(path);
  const settings = present ? await readSettings(path) : {};
  const backup = present ? await backUp(path, stamp) : null;

  settings.hooks ??= {};

  // Strip ours from every event that holds one: an install that no longer wants an event must
  // remove it, not leave the last install's registration behind firing on a mode nobody asked
  // for. Events this tool never touched are left exactly as they are, malformed or not.
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    const kept = withoutOurs(settings.hooks[event]);
    if (kept.length === settings.hooks[event].length) continue;
    if (kept.length > 0) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }

  for (const { event, matcher } of wanted) {
    const entry = { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: COMMAND }] };
    settings.hooks[event] = [...(settings.hooks[event] ?? []), entry];
  }

  await writeAtomic(settings, path);
  return { path, backup, events: wanted.map((r) => r.event) };
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
