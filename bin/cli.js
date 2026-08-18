#!/usr/bin/env node
// Concern: maps argv to one engine call and prints the CLI envelope | Non-concern: which reminder any verb emits, which policy.js names | IO: (argv, stdin) -> stdout json, exit code
import { readFileSync } from 'node:fs';
import { normalize } from '../src/event.js';
import { decide, BASELINE } from '../src/policy.js';
import { render } from '../src/render.js';
import { hostFor, AGENTS } from '../src/hosts/index.js';
import { NAME } from '../src/tool.js';
import { DEFAULTS, configPath } from '../src/config.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `USAGE:
  ${NAME} <verb> [args]

DESCRIPTION:
  Keeps coding agents concise. The rules ship with this package, so changing them
  is an install, never a per-host config edit.

VERBS:
  install-agent-hook <agent>
                            Register the hooks for <agent>. Backs up first. Idempotent.
  uninstall-agent-hook <agent>
                            Remove the hooks this tool registered. Previews by
                            default; pass --confirm to apply. Backs up first.
  remind <agent>            Read a hook payload on stdin, write the reminder. Hooks call this.
  print                     Write the rule text to stdout, for hosts with no installer.

AGENTS:
  ${AGENTS.join(', ')}

FLAGS:
  --settings <path>         Settings file to edit, for a repo-local install.
                            Defaults to the agent's own global settings file.
  --confirm                 Apply a change 'uninstall-agent-hook' would otherwise
                            only preview
  --version, -V             Version as JSON
  --help                    This text

EXAMPLES:
  ${NAME} install-agent-hook claude
  ${NAME} install-agent-hook claude --settings .claude/settings.json
  ${NAME} uninstall-agent-hook claude
  ${NAME} uninstall-agent-hook claude --confirm
  ${NAME} print >> AGENTS.md

OUTPUT:
  {"status": "success", "data": {...}, "meta": {"timestamp": 0}}

  'print' and 'remind' are the exceptions: they write raw text, because their
  consumers are an instruction file and Claude Code's hook parser, neither of
  which reads this envelope.

CONFIG:
  ${configPath()}
${Object.entries(DEFAULTS)
  .map(([k, v]) => `  ${k.padEnd(24)}  default ${v}`)
  .join('\n')}

ENVIRONMENT:
  ${NAME.toUpperCase().replace(/-/g, '_')}_CONFIG
                            Override the config file path

EXIT CODES:
  0   Success
  2   Bad arguments
  3   Validation error (a settings file that is not valid JSON)
`;

const meta = () => ({ timestamp: Math.floor(Date.now() / 1000) });

/** @param {unknown} data */
const ok = (data) => JSON.stringify({ status: 'success', data, meta: meta() });

/**
 * @param {string} code
 * @param {string} message
 */
const err = (code, message) => JSON.stringify({ status: 'error', error: { code, message }, meta: meta() });

async function readStdin() {
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/** A backup name no later run reuses. */
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Flags that take a value, so their value is never mistaken for a positional. */
const VALUED = new Set(['--settings']);

/**
 * @param {string[]} argv
 * @returns {{ positional: string[], flags: Record<string, string> }}
 */
function parse(argv) {
  const positional = [];
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
    } else if (VALUED.has(arg)) {
      const value = argv[++i];
      if (!value) throw new RangeError(`${arg} needs a value`);
      flags[arg] = value;
    } else {
      flags[arg] = '';
    }
  }
  return { positional, flags };
}

/** @param {string[]} positional */
function agentIn(positional) {
  const agent = positional[1];
  if (!agent) throw new RangeError(`name an agent: ${AGENTS.join(', ')}`);
  return hostFor(agent);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--version') || argv.includes('-V')) {
    return { out: ok({ name: pkg.name, version: pkg.version }), code: 0 };
  }
  if (argv.includes('--help') || argv.length === 0) {
    process.stdout.write(HELP);
    return { out: null, code: 0 };
  }

  const { positional, flags } = parse(argv);

  switch (positional[0]) {
    case 'install-agent-hook': {
      const host = agentIn(positional);
      const path = flags['--settings'] ?? host.settingsPath();
      return { out: ok(await host.install(path, stamp())), code: 0 };
    }

    case 'uninstall-agent-hook': {
      const host = agentIn(positional);
      const path = flags['--settings'] ?? host.settingsPath();
      if (!('--confirm' in flags)) {
        return { out: ok({ path, preview: true, wouldRemove: await host.pending(path) }), code: 0 };
      }
      return { out: ok(await host.uninstall(path, stamp())), code: 0 };
    }

    case 'print':
      process.stdout.write(`${render({ reminder: BASELINE, offense: null })}\n`);
      return { out: null, code: 0 };

    case 'remind': {
      // A hook must never block a session: every failure here is silent, exit 0.
      try {
        const host = agentIn(positional);
        const event = normalize(JSON.parse(await readStdin()));
        const verdict = decide(event);
        if (verdict) process.stdout.write(host.envelope(render(verdict), event));
      } catch (cause) {
        process.stderr.write(`${NAME}: ${cause instanceof Error ? cause.message : cause}\n`);
      }
      return { out: null, code: 0 };
    }

    default:
      return { out: err('bad_arguments', `unknown verb: ${positional[0]}`), code: 2 };
  }
}

/**
 * A bad argument is usage (exit 2); a settings file we cannot parse is validation (exit 3).
 * Neither is our bug, so neither prints a stack.
 */
const { out, code } = await main().catch((cause) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return cause instanceof RangeError
    ? { out: err('bad_arguments', message), code: 2 }
    : { out: err('validation_error', message), code: 3 };
});
if (out) process.stdout.write(`${out}\n`);
process.exit(code);
