// Concern: buffers a streaming message, redacts one over the bounds, and keeps the per-session record of that | Non-concern: what the agent is told, policy.js owns it | IO: (delta) -> notice; tmp files
import { mkdir, readFile, writeFile, appendFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measure } from './measure.js';
import { breaches } from './breach.js';
import { NAME } from './tool.js';

// Overridable so a test run never shares state with a live session, and never leaves records
// in one either.
const DIR = process.env[`${NAME.toUpperCase().replace(/-/g, '_')}_STATE`] ?? join(tmpdir(), `${NAME}-state`);
const ABANDONED_MS = 60 * 60 * 1000;

/** @param {string} id */
const slot = (id) => join(DIR, id.replace(/[^\w-]/g, '_'));

/**
 * @typedef {{ breaches: string[] }} Pending
 */

/**
 * What was redacted and whether the agent has been told. A redaction can land on a message that
 * is not the turn's last, so Stop cannot recover the counts by measuring: they are recorded here.
 *
 * @param {string} sessionId
 * @returns {Promise<Pending | null>}
 */
export async function pending(sessionId) {
  // A truncated record must read as "nothing pending", so the parse is guarded too.
  return readFile(`${slot(sessionId)}.redacted`, 'utf8').then(
    (raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/**
 * @param {string} sessionId
 * @param {Pending} state
 */
export const markRedacted = (sessionId, state) => writeFile(`${slot(sessionId)}.redacted`, JSON.stringify(state));

/** @param {string} sessionId */
export const clearPending = (sessionId) => rm(`${slot(sessionId)}.redacted`, { force: true });

/** A stream that never reaches `final` would otherwise leave its buffer behind for good. */
async function sweep() {
  const cutoff = Date.now() - ABANDONED_MS;
  for (const name of await readdir(DIR)) {
    const path = join(DIR, name);
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(path, { force: true });
  }
}

/**
 * Every delta is its own process, so the message is rebuilt from disk. Nothing is shown until
 * `final`: a message cannot be un-rendered, so redaction has to start at the first line.
 *
 * @param {import('./event.js').Event} event
 * @param {import('./config.js').Bounds} bounds
 * @param {boolean} interactive
 * @returns {Promise<string | null>} text to show in place of the delta, or null to leave it alone
 */
export async function display(event, bounds, interactive = true) {
  if (bounds.chatEnforcement !== 'redact' || !interactive) return null;
  if (!event.messageId) throw new TypeError('MessageDisplay payload carries no message_id');

  await mkdir(DIR, { recursive: true });
  if (event.final) await sweep();
  const buffer = slot(event.messageId);
  await appendFile(buffer, event.delta);

  // Measured on every delta, not at `final`: the breach is real the moment the words are
  // written, and the record has to exist before the next hook that could deliver it.
  const soFar = await readFile(buffer, 'utf8');
  const over = breaches(measure(soFar), bounds, { lines: true });
  // Every offence records, so every offence bites. Delivery is what clears it.
  if (over.length > 0) await markRedacted(event.sessionId, { breaches: over });

  if (!event.final) return '';

  await rm(buffer, { force: true });

  if (over.length === 0) return soFar;

  // No escape: every message over the bounds is redacted, however many times it takes. What
  // changes is the claim, because a repeat arrives at Stop with stop_hook_active set and is
  // told nothing.
  return `\n[redacted by the ${NAME} hook defined in settings.json: ${over.join(', ')}. the agent will be told to rewrite it]\n`;
}
