// Concern: counts the shape of prose — its longest paragraph and its total lines | Non-concern: the bounds those counts are judged against | IO: (text) -> Measurement
/**
 * Prose only. Fenced code, tables, headings and list markup are structure, not something the
 * agent can be told to cut, so counting them would fire on a data-heavy document whose prose is
 * already short.
 *
 * @typedef {{ paragraphWords: number, lines: number }} Measurement
 */

const FENCE = /^\s*(```|~~~)/;
const STRUCTURE = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||-{3,}\s*$|\*{3,}\s*$)/;

/** @param {string} line */
const countWords = (line) => (line.match(/\S+/g) ?? []).length;

/**
 * Structure (headings, lists, tables, quotes, rules, fenced blocks) and a blank line both end
 * a paragraph.
 *
 * @param {string} text
 * @returns {Measurement}
 */
export function measure(text) {
  const lines = text.split('\n');
  let paragraph = 0;
  let fenced = false;
  const result = { paragraphWords: 0, lines: lines.length };

  const endParagraph = () => {
    result.paragraphWords = Math.max(result.paragraphWords, paragraph);
    paragraph = 0;
  };

  for (const line of lines) {
    const words = countWords(line);

    if (FENCE.test(line)) {
      fenced = !fenced;
      endParagraph();
    } else if (fenced) {
      endParagraph();
    } else if (line.trim() === '') {
      endParagraph();
    } else if (STRUCTURE.test(line)) {
      endParagraph();
    } else {
      paragraph += words;
    }
  }
  endParagraph();
  return result;
}
