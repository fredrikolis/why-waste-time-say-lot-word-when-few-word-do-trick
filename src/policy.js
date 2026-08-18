// Concern: decides which reminder an Event earns and writes the offense line stating the counts | Non-concern: tagging it onto the body, render.js owns it | IO: (Event) -> Reminder; config file
import { measure } from './measure.js';
import { bounds as loadBounds } from './config.js';
import { breaches } from './breach.js';

/**
 * @typedef {{ reminder: string, offense: string | null, clearsPending?: boolean }} Reminder
 */

/** The reminder that states the rules with nothing yet to correct. */
export const BASELINE = 'session-start-reminder';

/**
 * @param {import('./event.js').Event} event
 * @param {import('./config.js').Bounds} [bounds]
 * @param {import('./enforce.js').Pending | null} [redacted]
 * @param {boolean} [interactive]
 * @returns {Reminder | null}
 */
export function decide(event, bounds = loadBounds(), redacted = null, interactive = true) {
  if (event.kind === 'session-start') {
    return { reminder: BASELINE, offense: null };
  }

  // Chat warnings only where a human is reading: a Stop warning continues the run, so a
  // programmatic caller would get a rewrite it never asked for at twice the tokens. A
  // PostToolUse reminder continues nothing, so it is not gated.
  if (event.kind === 'stop' && !interactive) return null;

  // A redaction can land on a message that is not the turn's last, so the recorded breach wins
  // over measuring what happens to be last: otherwise the user loses text and is never told why.

  // Delivered at the first hook that reaches the model: PreToolUse beats Stop whenever the
  // agent calls a tool next, so it learns mid-turn instead of after the damage.
  const canDeliver = event.kind === 'pre-tool' || (event.kind === 'stop' && !event.stopHookActive);
  if (canDeliver && bounds.chatEnforcement === 'redact' && redacted) {
    return {
      reminder: 'redacted-chat-response',
      offense: `Your previous message was redacted: ${redacted.breaches.join(', ')}.`,
      clearsPending: true,
    };
  }

  // A warning continues the conversation, which ends in another Stop. Without this it loops.
  if (event.kind === 'stop' && !event.stopHookActive && event.text) {
    const m = measure(event.text);
    const found = breaches(m, bounds, 'chat');
    if (found.length === 0) return null;
    return {
      reminder: 'wordy-chat-response-reminder',
      offense: `Your last response broke the bounds: ${found.join(', ')}.`,
    };
  }

  if (event.kind === 'file-write' && event.filePath?.endsWith('.md')) {
    const m = measure(event.text);
    const found = breaches(m, bounds, 'tool');
    if (found.length === 0) return null;
    return {
      reminder: 'wordy-tool-call-reminder',
      offense: `You wrote ${event.filePath.split('/').pop()}: ${found.join(', ')}.`,
    };
  }

  return null;
}
