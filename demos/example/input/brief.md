# Demo Brief — example

## Product
<your product> (a web app; for ChatGPT apps / Apps SDK widgets see the record-demo skill)

## Demo goal
Show a user completing <the core flow> end-to-end — e.g. search for an item,
compare results, add to basket, and check out.

## Audience
<who is this demo for>

## Tone
Friendly, practical, founder-style. Brisk.

## Length
~45-60 seconds.

## CTA
<what should the viewer do next>

---

Authoring notes (see the record-demo skill for the full schema + principles):
- 4-6 scenes, ONE idea each; ~2.5 words/second of narration per scene.
- Use waitForWidget (with label "thinking") for every async/loading wait so the
  dead time gets trimmed out of the final cut.
- Set humanize:false on typing when the narration (not the typing) should set
  the scene's pace.
- Placeholder selectors in the scaffold storyboard will NOT match your app —
  replace them with real hooks and confirm with `aidemo probe`.
- If your app renders inside an iframe (e.g. a ChatGPT Apps SDK widget), declare
  it under "frames" and target elements with { "frame": "<name>", ... } — the
  skill documents the nested-iframe pattern and real-world gotchas.
