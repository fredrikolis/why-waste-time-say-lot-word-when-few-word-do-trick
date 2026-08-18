<!-- Concern: what a contributor must run to work on this repo and pass its gates | Non-concern: what the tool does, which the README owns | IO: none -->

# Contributing

```bash
pnpm install
git config core.hooksPath .githooks   # git will not let a repo enable its own hooks
```

Without that second line the annotation lint and the commit-msg gates never run on your commits.

## Gates

```bash
pnpm test           # regression suite
pnpm run check      # tsc --noEmit, JSDoc types, no build step
pnpm run fmt:check  # prettier
```

The pre-commit hook needs [annotated-tree](https://github.com/fredrikolis/annotated-tree) and
skips with a message when it is absent. The commit-msg gate needs
[git-agent-verdict](https://github.com/fredrikolis/git-agent-verdict) and does not skip: commit
through `git agent-verdict attest`, not `git commit`.

Every file's first line is a `Concern | Non-concern | IO` annotation under 200 characters.

## Layout

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

Host field names stop at `event.js`, so a second agent host is a new file under `src/hosts/`
with no change to the core.

Committed tests freeze external contracts only: the hook envelope Claude Code parses, and what
`install` and `uninstall` do to a settings file. Counters are internal, so prove them with
scratch tests in the gitignored `artifacts/`.
