// Concern: counts the shape of prose — longest paragraph, longest unbroken run, prose size, total lines | Non-concern: the bounds those counts are judged against | IO: (text) -> Measurement
/**
 * `words` counts PROSE only. Fenced code, tables, headings and list markup are structure, not
 * something the agent can be told to cut, so counting them would fire on a data-heavy document
 * whose prose is already short.
 *
 * @typedef {{ paragraphWords: number, proseRunWords: number, lines: number, words: number }} Measurement
 */

const FENCE = /^\s*(```|~~~)/;
const STRUCTURE = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||-{3,}\s*$|\*{3,}\s*$)/;

/** @param {string} line */
const countWords = (line) => (line.match(/\S+/g) ?? []).length;

/**
 * Structure (headings, lists, tables, quotes, rules, fenced blocks) breaks a prose run.
 * A blank line ends a paragraph but leaves the run open.
 *
 * @param {string} text
 * @returns {Measurement}
 */
export function measure(text) {
  const lines = text.split('\n');
  let paragraph = 0;
  let run = 0;
  let fenced = false;
  const result = { paragraphWords: 0, proseRunWords: 0, lines: lines.length, words: 0 };

  const endParagraph = () => {
    result.paragraphWords = Math.max(result.paragraphWords, paragraph);
    paragraph = 0;
  };
  const endRun = () => {
    endParagraph();
    result.proseRunWords = Math.max(result.proseRunWords, run);
    run = 0;
  };

  for (const line of lines) {
    const words = countWords(line);

    if (FENCE.test(line)) {
      fenced = !fenced;
      endRun();
    } else if (fenced) {
      endRun();
    } else if (line.trim() === '') {
      endParagraph();
    } else if (STRUCTURE.test(line)) {
      endRun();
    } else {
      paragraph += words;
      run += words;
      result.words += words;
    }
  }
  endRun();
  return result;
}
