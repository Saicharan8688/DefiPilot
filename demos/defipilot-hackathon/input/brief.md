# Demo Brief — defipilot-hackathon

Drafted from `aidemo inspect http://localhost:3000` (page title: DeFiPilot — AI-Powered DeFi Financial Agent).
Fill in the product, audience, tone and CTA; the storyboard next to this file
already has the page's real selectors.

## Product
<your product>

## Demo goal
<the core flow, end to end>

## Audience
<who is this for>

## Tone
Friendly, practical, founder-style. Brisk.

## Length
~45-60 seconds.

## CTA
<what should the viewer do next>

---

## What inspect saw

Headings:
- h1 Your AI DeFi analyst — plans you can see and explain
    - h3 Connect your wallet
    - h3 Analyze your portfolio
    - h3 Ask the AI
    - h3 Get a recommendation
    - h3 Simulate
    - h3 Live DeFi yields
    - h3 Explainable AI
    - h3 Simulate first
    - h3 No fabricated numbers
  - h2 Live yield scan

Interactive elements (unique selectors):

| role | name | selector | |
|---|---|---|---|
| button | Connect Wallet | `button.rounded-full.bg-gradient-to-r` |  |
| link | D DeFiPilot | `a[href="/"]` |  |
| link | Analyze | `a:has-text("Analyze")` |  |
| link | Live scan | `a:has-text("Live scan")` |  |
| link | AI analysis | `a:has-text("AI analysis")` |  |
| link | Analyze my wallet → | `a.rounded-xl.bg-gradient-to-r` |  |
| link | See the live yield scan | `a.rounded-xl.border` |  |

Next: write the narration, replace the candidate hover with the real click +
`assert`, then `aidemo probe` (or the MCP `probe` job).
