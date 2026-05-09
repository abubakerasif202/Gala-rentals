# Codex – Project Guidelines

## Working style
- Keep working with minimal interruption during code audits, test runs, and targeted edits. Only pause to ask when a decision is genuinely ambiguous or the next action is irreversible.
- Prefer small, production-safe changes. Avoid refactors, cosmetic cleanup, or new abstractions unless explicitly requested.
- Do not add comments, docstrings, or type annotations to code you did not change.

## End-of-task summary
After completing any non-trivial task, finish with a concise summary in this format:

**Files changed:** list each file and what changed  
**Tests run:** command used and pass/fail result  
**Manual follow-up:** anything that cannot be automated (env vars to set, migrations to run, deploys to trigger, secrets to rotate, etc.)

## Guarded operations (always confirm before proceeding)
- Force-push (`git push --force` / `-f`)
- Hard resets (`git reset --hard`)
- Deleting files or directories
- Changing or rotating secrets / environment variables
- Triggering a deployment (Render, Fly, Vercel, etc.)
- Any `rm -rf` or irreversible database operation
