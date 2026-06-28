# ECC for Codex CLI

This supplements the root `AGENTS.md` with a repo-local ECC baseline.

## Repo Skill

- Gala Rentals Codex skill: `.agents/skills/maple-rental/SKILL.md`
- Claude-facing Gala Rentals companion skill: `.claude/skills/maple-rental/SKILL.md`
- Keep user-specific credentials and private MCPs in `~/.codex/config.toml`, not in this repo.

## MCP Baseline

Treat `.codex/config.toml` as the default ECC-safe baseline for work in this repository.
The generated baseline enables GitHub, Context7, Exa, Memory, Playwright, and Sequential Thinking.

## Multi-Agent Support

- Explorer: read-only evidence gathering
- Reviewer: correctness, security, and regression review
- Docs researcher: API and release-note verification

## Workflow Files

- No dedicated workflow command files were generated for this repo.

Use these workflow files as reusable task scaffolds when the detected repository workflows recur.
