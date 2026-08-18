<!-- Concern: explains the tool to a first-time reader and documents its surface | Non-concern: the rule text itself, which rules/ owns | IO: none -->

# why-waste-time-say-lot-word-when-few-word-do-trick

Coding agents write far more than they need to. You pay for every word, and you read every
word to find the sentence that mattered.

Telling them to be terse does not stick. A concision rule in a system prompt loses to 200k
tokens of context, and by the time the agent writes your README it has not seen that rule in
an hour. This puts the rule in a hook that fires when the agent is being wordy, carrying the
counts that prove it.

## What it does

Three reminders. Nothing else, and nothing at all when the agent is behaving.

| When                               | What the agent receives               |
| ---------------------------------- | ------------------------------------- |
| Session start, and after a compact | The baseline mandate                  |
| A response breaks the bounds       | The counts that broke, and how to cut |
| A markdown write breaks the bounds | The counts that broke, and how to cut |

A warning looks like this:

```
<why-waste-time-say-lot-word-when-few-word-do-trick-warning>
You wrote 1847 words to README.md: longest paragraph 140 words (max 70), longest
unbroken prose run 460 words (max 200).

Delete first. Compressing prose into bullets keeps every idea and saves nothing.
...
</why-waste-time-say-lot-word-when-few-word-do-trick-warning>
```

The numbers are the point. "Be concise" is advice an agent can rationalize past. "Longest
paragraph 140 words, max 70" is a fact it cannot argue with.

## Install

Not on npm yet. Until it is published, install from a clone:

```bash
git clone https://github.com/fredrikolis/why-waste-time-say-lot-word-when-few-word-do-trick
cd why-waste-time-say-lot-word-when-few-word-do-trick
npm link
why-waste-time-say-lot-word-when-few-word-do-trick install
```

Once published, `npm i -g why-waste-time-say-lot-word-when-few-word-do-trick` replaces the
first three lines.

`install` backs up `~/.claude/settings.json`, then registers three hooks. It is idempotent:
run it again and it replaces its own entries, leaving every other hook alone. Pass a path to
install into a repo-local `.claude/settings.json` instead.

`uninstall` previews by default and reports how many entries it would remove. Pass `--confirm`
to apply it. It backs up first, the same way.

Your settings file gains a pointer and nothing more:

```json
"Stop": [
  { "hooks": [{ "type": "command", "command": "why-waste-time-say-lot-word-when-few-word-do-trick remind" }] }
]
```

The rules live in the package, so changing them is `npm i -g` and no edit to any config file
on any machine.

## What is measured

Four counts. Nothing here judges whether your prose is good.

| Count                                   | What it catches                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Words in the longest paragraph          | The single bloated block                                                                                                           |
| Words in the longest unbroken prose run | The wall of text that slips a per-paragraph bound. Consecutive paragraphs with no heading, list, table, or code fence between them |
| Lines in a response                     | Chat only. A document is allowed to be long                                                                                        |
| Total prose words                       | Documents only. Past the trigger the agent is told to re-read its output, whatever its shape                                       |

Only prose counts. Fenced code, tables, headings and list markup are structure, not something
an agent can be told to cut, so a document that is mostly a JSON block does not trip the word
trigger on the strength of its data.

The fourth count is a trigger, not a bound. Documents legitimately run long, so total words
never fail on their own; passing the trigger only earns the reminder. A 340-word paragraph is
340 words whether the writing is good or bad, so judgment stays in the rule text and the counts
only pick the moment to deliver it.

## Configuration

Optional. The defaults are complete, and the tool works with no config file present.

`~/.config/why-waste-time-say-lot-word-when-few-word-do-trick/config.json`:

```json
{
  "paragraphWords": 70,
  "proseRunWords": 200,
  "responseLines": 50,
  "documentWords": 400
}
```

| Key              | Default | Meaning                                           |
| ---------------- | ------- | ------------------------------------------------- |
| `paragraphWords` | 70      | Bound on the longest paragraph                    |
| `proseRunWords`  | 200     | Bound on the longest unbroken prose run           |
| `responseLines`  | 50      | Bound on a chat response, ignored for documents   |
| `documentWords`  | 400     | Words in a markdown write that trigger a reminder |

One file, one machine. The numbers live here and never in the rule text, so there is one place
to change them. A file that is present but unparseable falls back to the defaults and says so
on stderr, rather than silently reverting bounds you think you set.

Set `WHY_WASTE_TIME_SAY_LOT_WORD_WHEN_FEW_WORD_DO_TRICK_CONFIG` to read a different path.

## The rules

Three markdown files in `rules/`, shipped with the package:

- `session-start-reminder.md` sets the baseline before anything goes wrong.
- `wordy-chat-response-reminder.md` fires on a wordy response.
- `wordy-tool-call-reminder.md` fires on a wordy document.

Both warnings lead with deletion rather than compression, because agents reach for
restructuring first and a reformatted wall of text is still a wall of text.

`why-waste-time-say-lot-word-when-few-word-do-trick print` writes the baseline to stdout. For an agent
with no hook system, append it to whatever instruction file that agent reads:

```bash
why-waste-time-say-lot-word-when-few-word-do-trick print >> AGENTS.md
```

## Which hooks, and why

| Hook           | Matcher                           | Job                                                                                       |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `SessionStart` | `startup\|resume\|clear\|compact` | Baseline. The `compact` case matters most, since compaction is when the rules are evicted |
| `Stop`         | none                              | Measures the response the agent just finished                                             |
| `PostToolUse`  | `Write\|Edit`                     | Measures a `.md` write                                                                    |

`Stop` carries `last_assistant_message`, so measuring a response reads nothing from disk. A
warning there continues the conversation, so the policy returns nothing when `stop_hook_active`
is set. Without that guard it would warn about the response it caused.

## Development

```bash
pnpm install
git config core.hooksPath .githooks   # git will not let a repo enable its own hooks
pnpm test           # regression suite
pnpm run check      # tsc --noEmit, JSDoc types, no build step
pnpm run fmt:check  # prettier
```

Zero runtime dependencies. Plain ES modules, no compile step, no bundler.

Committed tests freeze external contracts only: the hook envelope Claude Code parses, and what
`install` and `uninstall` do to a settings file. The counters are internal, so they are proved
with scratch tests rather than frozen ones.

The pre-commit hook needs `annotated-tree` and skips with a message when it is absent. The
commit-msg gate needs `git-agent-verdict` and does not skip.

```
bin/cli.js            argv to one engine call
src/event.js          host payload to canonical Event, the boundary
src/measure.js        text to counts
src/config.js         bounds, defaults through the config file
src/policy.js         Event to which reminder, and the counts that earned it
src/render.js         reminder to tagged text
src/rules.js          loads rules/*.md
src/tool.js           the package name, read from package.json
src/hosts/claude.js   Claude's envelope and settings.json
```

Host field names stop at `event.js` and appear nowhere past it, so a second agent host is a
new file under `src/hosts/` with no change to the core.

## License

MIT
