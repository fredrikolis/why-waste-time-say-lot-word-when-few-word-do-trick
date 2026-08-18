// Concern: names which bounds a measurement broke on a surface | Non-concern: measuring, or what a breach earns | IO: (Measurement, Bounds, surface) -> phrases
/**
 * One source for the phrasing: the Stop warning and the redaction notice must never describe
 * the same breach differently.
 *
 * @param {import('./measure.js').Measurement} m
 * @param {import('./config.js').Bounds} bounds
 * @param {'chat' | 'tool'} surface
 * @returns {string[]}
 */
export function breaches(m, bounds, surface) {
  const maxLines = surface === 'chat' ? bounds.maxChatLines : bounds.maxToolLines;
  const maxParagraph = surface === 'chat' ? bounds.maxChatParagraphWords : bounds.maxToolParagraphWords;

  const found = [];
  if (m.lines > maxLines) found.push(`${m.lines} lines (max ${maxLines})`);
  if (m.paragraphWords > maxParagraph) {
    found.push(`longest paragraph ${m.paragraphWords} words (max ${maxParagraph})`);
  }
  return found;
}
