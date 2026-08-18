// Concern: the bounds a measurement is judged against, and reading and writing the file that overrides them | Non-concern: taking any measurement | IO: (config path) -> Bounds; edited file
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { NAME } from './tool.js';

/**
 * @typedef {'warn' | 'redact'} Enforcement
 * @typedef {{
 *   paragraphWords: number,
 *   proseRunWords: number,
 *   responseLines: number,
 *   documentWords: number,
 *   chatEnforcement: Enforcement,
 *   toolEnforcement: Enforcement,
 * }} Bounds
 */

/** @type {Bounds} */
export const DEFAULTS = {
  paragraphWords: 70,
  proseRunWords: 200,
  responseLines: 50,
  documentWords: 400,
  chatEnforcement: 'warn',
  // Paired with chatEnforcement so both surfaces are declared, and held at one value on
  // purpose: a file write cannot be redacted, because the write already happened. It is the
  // seam where per-surface levels land, so it is not dead config to delete.
  toolEnforcement: 'warn',
};

const ENV_VAR = `${NAME.toUpperCase().replace(/-/g, '_')}_CONFIG`;

export function configPath() {
  return process.env[ENV_VAR] ?? join(homedir(), '.config', NAME, 'config.json');
}

/**
 * A hook must not break a session, so a bad file falls back to the defaults rather than
 * throwing. It says so on stderr: silently reverting bounds the user thinks they set is worse
 * than a noisy hook.
 *
 * @param {string} [path]
 * @returns {Bounds}
 */
export function bounds(path = configPath()) {
  if (!existsSync(path)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(path, 'utf8')) };
  } catch (cause) {
    const why = cause instanceof Error ? cause.message : String(cause);
    process.stderr.write(`${NAME}: ignoring unreadable config ${path}: ${why}\n`);
    return { ...DEFAULTS };
  }
}

/**
 * Persists what `install` was asked for, so the runtime reads the same mode the hooks were
 * registered under. Only values that differ from the defaults are written, so a later release
 * that changes a default reaches every user who never overrode it.
 *
 * @param {Partial<Bounds>} patch
 * @param {string} [path]
 */
export function save(patch, path = configPath()) {
  // Never overwrite a file we could not read: its other overrides would vanish silently. Read
  // it once here, rather than parsing it again through bounds().
  let existing = {};
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    try {
      existing = JSON.parse(raw);
    } catch (cause) {
      throw new BadValue(`${path} is not valid JSON, so it will not be overwritten: ${cause}`);
    }
  }
  const merged = { ...DEFAULTS, ...existing, ...patch };
  const overrides = Object.fromEntries(
    Object.entries(merged).filter(([key, value]) => value !== DEFAULTS[/** @type {keyof Bounds} */ (key)]),
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(overrides, null, 2)}\n`);
  return path;
}

const COUNT = 'a positive whole number';

/** A well-formed option carrying a value the field does not accept: validation, not usage. */
export class BadValue extends Error {}

/** The flag a user types for each key, and what that key accepts. */
const FIELDS = {
  '--paragraph-words': { key: 'paragraphWords', accepts: COUNT },
  '--prose-run-words': { key: 'proseRunWords', accepts: COUNT },
  '--response-lines': { key: 'responseLines', accepts: COUNT },
  '--document-words': { key: 'documentWords', accepts: COUNT },
  '--chat-enforcement': { key: 'chatEnforcement', accepts: ['warn', 'redact'] },
  // One legal value today. See DEFAULTS for why the surface exists anyway.
  '--tool-enforcement': { key: 'toolEnforcement', accepts: ['warn'] },
};

export const FLAGS = Object.keys(FIELDS);

/**
 * @param {Record<string, string>} flags
 * @returns {Partial<Bounds>}
 */
export function parseFields(flags) {
  /** @type {Record<string, any>} */
  const patch = {};
  for (const flag of Object.keys(flags)) {
    if (!(flag in FIELDS)) throw new RangeError(`unknown option: ${flag}. known: ${FLAGS.join(', ')}`);
  }
  for (const [flag, { key }] of Object.entries(FIELDS)) {
    if (!(flag in flags)) continue;
    const raw = flags[flag];

    const accepts = FIELDS[/** @type {keyof typeof FIELDS} */ (flag)].accepts;
    if (Array.isArray(accepts)) {
      if (!accepts.includes(raw)) throw new BadValue(`${flag} takes ${accepts.join(' or ')}, not ${raw}`);
      patch[key] = raw;
      continue;
    }

    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new BadValue(`${flag} takes ${accepts}, not ${raw}`);
    patch[key] = n;
  }
  return patch;
}

/**
 * Self-describing: every key reports the flag that sets it, what it accepts, and whether the
 * value in force is yours or the default. An agent can change a setting from this alone.
 *
 * @param {string} [path]
 */
export function describe(path = configPath()) {
  const resolved = bounds(path);
  return Object.fromEntries(
    Object.entries(FIELDS).map(([flag, { key, accepts }]) => {
      const value = resolved[/** @type {keyof Bounds} */ (key)];
      const fallback = DEFAULTS[/** @type {keyof Bounds} */ (key)];
      return [key, { flag, value, default: fallback, accepts, overridden: value !== fallback }];
    }),
  );
}
