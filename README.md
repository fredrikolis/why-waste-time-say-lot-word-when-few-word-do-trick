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
```

Configure limits and make it auto-redact long chat output

```bash
why-waste-time-say-lot-word-when-few-word-do-trick configure --max-chat-lines 25
why-waste-time-say-lot-word-when-few-word-do-trick configure --max-chat-paragraph-words 50
why-waste-time-say-lot-word-when-few-word-do-trick configure --chat-enforcement redact
```

Install Claude hooks (modifies ~/.claude/settings.json)

```bash
why-waste-time-say-lot-word-when-few-word-do-trick install-agent-hook claude
```

## What the installed hook does

1. Tells the agent to communicate concisely at SessionStart (and PostCompaction)
2. Auto-rejects long chat responses, forcing the agent to try again.
3. Warns the agent if it writes lengthy Markdown prose

Nothing else. Silent while the agent behaves.

`uninstall-agent-hook claude --confirm` removes the hooks. It leaves this config file in place.
Run `--help` for the whole surface.
