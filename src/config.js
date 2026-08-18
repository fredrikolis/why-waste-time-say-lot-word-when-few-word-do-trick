// Concern: the bounds a measurement is judged against, and the file and env var that override them | Non-concern: taking any measurement | IO: (config path) -> Bounds
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { NAME } from './tool.js';

/**
 * @typedef {{ paragraphWords: number, proseRunWords: number, responseLines: number, documentWords: number }} Bounds
 */

/** @type {Bounds} */
const DEFAULTS = {
  paragraphWords: 70,
  proseRunWords: 200,
  responseLines: 50,
  documentWords: 400,
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
