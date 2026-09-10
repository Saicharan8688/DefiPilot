# record-demo skill — how this got here & how to keep it fresh

This repo carries a **copy** of the `record-demo` skill (a thin adapter) from
[aidemo](https://github.com/tandryukha/aidemo). The engine itself is
**not** vendored — it runs on demand via npx from a pinned `stable` tag, and
agents drive it through the **aidemo MCP server**, registered by `repo-init`
in `.mcp.json` (Claude Code) and `.gemini/settings.json` (Gemini CLI).
Codex CLI keeps MCP config globally — register once with:

    codex mcp add aidemo -- npx -y github:tandryukha/aidemo#stable mcp

Everywhere below, `aidemo` means:

    npx -y github:tandryukha/aidemo#stable

## The authoring guide (never goes stale)
The canonical guide is served by the engine itself, always version-matched:
the MCP `get_authoring_guide` tool, or `aidemo guide` on the CLI.

## Stay up to date
A `SessionStart` hook in `.claude/settings.json` runs `aidemo skill check` and
prints a notice when a newer skill is available. Nothing is overwritten silently —
apply an update when you're ready:

    npx -y github:tandryukha/aidemo#stable skill update --dir .

## Record a demo
Preferred: ask your agent — it uses the MCP tools (pipeline tools return job
ids; `job_status` reports progress and failures). By hand:

    npx -y github:tandryukha/aidemo#stable init <name>            # scaffold demos/<name>/
    npx -y github:tandryukha/aidemo#stable render demos/<name>    # voice → record → captions → compose

(Needs Chrome, ffmpeg and OPENAI_API_KEY — run `aidemo doctor` to check.)

## Send feedback upstream
Hit a broken selector, bad timing, or have an idea? File it on the engine:

    npx -y github:tandryukha/aidemo#stable feedback demos/<name>
