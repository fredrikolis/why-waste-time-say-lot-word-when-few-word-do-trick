// Concern: names which bounds a measurement broke | Non-concern: measuring, or what a breach earns | IO: (Measurement, Bounds, lines?) -> phrases
/**
 * One source for the phrasing: the Stop warning and the redaction notice must never describe
 * the same breach differently.
 *
 * @param {import('./measure.js').Measurement} m
 * @param {import('./config.js').Bounds} bounds
 * @param {{ lines?: boolean }} [also]
 * @returns {string[]}
 */
export function breaches(m, bounds, also = {}) {
  const found = [];
  if (also.lines && m.lines > bounds.responseLines) found.push(`${m.lines} lines (max ${bounds.responseLines})`);
  if (m.paragraphWords > bounds.paragraphWords) {
    found.push(`longest paragraph ${m.paragraphWords} words (max ${bounds.paragraphWords})`);
  }
  if (m.proseRunWords > bounds.proseRunWords) {
    found.push(`longest unbroken prose run ${m.proseRunWords} words (max ${bounds.proseRunWords})`);
  }
  return found;
}
