// Concern: decides which reminder an Event earns and writes the offense line stating the counts | Non-concern: tagging that line onto the body, render.js owns it | IO: (Event, Bounds) -> Reminder | null
import { measure } from './measure.js';
import { bounds as loadBounds } from './config.js';

/**
 * @typedef {{ reminder: string, offense: string | null }} Reminder
 */

/**
 * @param {import('./measure.js').Measurement} m
 * @param {import('./config.js').Bounds} b
 */
function shapeBreaches(m, b) {
  const found = [];
  if (m.paragraphWords > b.paragraphWords) {
    found.push(`longest paragraph ${m.paragraphWords} words (max ${b.paragraphWords})`);
  }
  if (m.proseRunWords > b.proseRunWords) {
    found.push(`longest unbroken prose run ${m.proseRunWords} words (max ${b.proseRunWords})`);
  }
  return found;
}

/** The reminder that states the rules with nothing yet to correct. */
export const BASELINE = 'session-start-reminder';

/**
 * @param {import('./event.js').Event} event
 * @param {import('./config.js').Bounds} [bounds]
 * @returns {Reminder | null}
 */
export function decide(event, bounds = loadBounds()) {
  if (event.kind === 'session-start') {
    return { reminder: BASELINE, offense: null };
  }

  // A warning continues the conversation, which ends in another Stop. Without this it loops.
  if (event.kind === 'stop' && !event.stopHookActive && event.text) {
    const m = measure(event.text);
    const found = shapeBreaches(m, bounds);
    if (m.lines > bounds.responseLines) found.unshift(`${m.lines} lines (max ${bounds.responseLines})`);
    if (found.length === 0) return null;
    return {
      reminder: 'wordy-chat-response-reminder',
      offense: `Your last response broke the bounds: ${found.join(', ')}.`,
    };
  }

  if (event.kind === 'file-write' && event.filePath?.endsWith('.md')) {
    const m = measure(event.text);
    const found = shapeBreaches(m, bounds);
    if (found.length === 0 && m.words <= bounds.documentWords) return null;
    const name = event.filePath.split('/').pop();
    const detail = found.length > 0 ? `: ${found.join(', ')}` : '';
    return {
      reminder: 'wordy-tool-call-reminder',
      offense: `You wrote ${m.words} words to ${name}${detail}.`,
    };
  }

  return null;
}
