// Concern: the tool's own name, read from the manifest that owns it | Non-concern: the manifest's other fields, and the paths and tags derived from this name | IO: (package.json) -> name
import { readFileSync } from 'node:fs';

/** @type {string} */
export const NAME = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;
