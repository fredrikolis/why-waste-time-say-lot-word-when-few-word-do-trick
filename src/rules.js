// Concern: loads a reminder's markdown body, stripped of its annotation | Non-concern: tagging or assembling that body, which render.js owns | IO: (name) -> text
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @param {string} name */
export function load(name) {
  const url = new URL(`../rules/${name}.md`, import.meta.url);
  return readFileSync(fileURLToPath(url), 'utf8')
    .replace(/^<!--.*?-->\n/s, '')
    .trim();
}
