// Concern: the agent hosts this tool can wire — the name a user types, and the list the help renders | Non-concern: what any host's dialect looks like | IO: (agent name) -> host; () -> names
import * as claude from './claude.js';

/** A null prototype: `HOSTS['constructor']` must miss, not return Object's. */
const HOSTS = /** @type {Record<string, typeof claude>} */ (Object.assign(Object.create(null), { claude }));

export const AGENTS = Object.keys(HOSTS);

/**
 * @param {string} agent
 * @returns {typeof claude}
 */
export function hostFor(agent) {
  const host = HOSTS[agent];
  if (!host) throw new RangeError(`unknown agent: ${agent}. known: ${AGENTS.join(', ')}`);
  return host;
}
