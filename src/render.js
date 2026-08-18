// Concern: joins an offense line to its rule body and tags the pair as mandate or warning | Non-concern: writing the offense line, which policy.js owns | IO: (Reminder) -> text
import { load } from './rules.js';
import { NAME } from './tool.js';

/**
 * @param {import('./policy.js').Reminder} verdict
 * @returns {string}
 */
export function render({ reminder, offense }) {
  const tag = `${NAME}-${offense ? 'warning' : 'mandate'}`;
  const body = offense ? `${offense}\n\n${load(reminder)}` : load(reminder);
  return `<${tag}>\n${body}\n</${tag}>`;
}
