<!-- Concern: sells the tool, and shows how to install and configure it | Non-concern: the rule text, and the whole flag surface --help owns | IO: none -->

![why-waste-time-say-lot-word-when-few-word-do-trick](https://i.giphy.com/DMNPDvtGTD9WLK2Xxa.webp)

[![npm](https://img.shields.io/npm/v/why-waste-time-say-lot-word-when-few-word-do-trick.svg)](https://www.npmjs.com/package/why-waste-time-say-lot-word-when-few-word-do-trick)

A CLI-tool + agent hook that reminds Claude to be terse, and reminds it when it's not.

**What your agent should say:**

```
The answer is 42.
```

**What it says instead:**

```
Great question! Let me walk through this step by step.

First, some context on why this matters. There are several
approaches here, each with tradeoffs worth considering...

[four more paragraphs]

So in conclusion, the answer is 42. Let me know if you would
like me to elaborate on any part of this!
```

## Install

```bash
npm i -g why-waste-time-say-lot-word-when-few-word-do-trick
why-waste-time-say-lot-word-when-few-word-do-trick install-agent-hook claude
```

## What it does

1. States [the rules](https://github.com/fredrikolis/why-waste-time-say-lot-word-when-few-word-do-trick/blob/main/rules/session-start-reminder.md) at session start, and after every compact.
2. Warns it, with the counts, when a response runs long or a markdown write turns into a wall of text.

Nothing else. Silent while the agent behaves.

## Enforcement

Warnings by default. Under `redact`, an over-long chat response never reaches you:

- You see a notice naming the counts that broke.
- The agent is told to rewrite it, once per session.
- The agent cannot bypass this. It does not control what is drawn.

```bash
why-waste-time-say-lot-word-when-few-word-do-trick configure --chat-enforcement redact
```

**Redaction costs streaming.** Nothing shows until a message is complete and measured.

It applies to interactive sessions only, never to `claude -p`, and never to file writes.

## Configuration

```bash
why-waste-time-say-lot-word-when-few-word-do-trick configure --response-lines 25
why-waste-time-say-lot-word-when-few-word-do-trick configure
```

Only your overrides are stored. Defaults you never set track future releases.

`uninstall-agent-hook claude --confirm` removes the hooks. It leaves this config file in place.
Run `--help` for the whole surface.
