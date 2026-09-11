with open('README.md', 'r') as f:
    content = f.read()

old = """## 16. Future improvements

- Real executor (safe signer, intents/EIP-7702) so the plan can actually be executed — with explicit consent UI.
- Analysis over real on-chain balances (optionally opt-in), with a no-telemetry guarantee.
- Multi-chain portfolio reads (the RPC layer already knows Base/Arbitrum/OP).
- Deeper per-protocol risk inputs (audits, insurance, governance) beyond the current pool-level model.
- Persistent + per-user notification store, Telegram long-polling fallback for local dev, and a hosted deployment.
- Distributed rate limiting (Redis/Upstash KV) and a real integration/E2E test suite.

---

**License**: Private — hackathon submission."""

new_text = """## 17. Troubleshooting

### Hydration Error: `<div>` cannot be a descendant of `<p>`
If you see `In HTML, <div> cannot be a descendant of <p>. This will cause a hydration error`, check for `<p>` tags containing block-level elements like `<div>`, `<ul>`, `<ol>`, or `<table>`. React's HTML parser closes `<p>` tags before block elements, causing a server/client mismatch.

**Fix**: Replace `<p>` with `<div>` or use inline elements (`<span>`) for inline content. In this codebase, the `Card` component uses `<section>` and `<div>` instead of `<p>` for block content.

### Multiple Telegram Bot Instances (409 Conflict)
```
[1] [telegram:watch] getUpdates failed: {"ok":false,"error_code":409,"description":"Conflict: terminated by other getUpdates request"}
```
**Cause**: Multiple `npm run telegram:watch` or `npm run dev` processes running simultaneously.

**Fix**:
```bash
# Kill all instances
pkill -f "telegram-poll" && pkill -f "next dev"
# Restart cleanly
npm run dev:all
```

### No `/portfolio` Reply in Telegram
**Cause**: User hasn't sent `/start <wallet>` to the bot first (Telegram privacy restriction).

**Fix**: User must first message the bot `/start 0xYourWalletAddress` to register. The bot cannot initiate conversations.

### No `/portfolio` Reply for Empty Wallet
**Behavior**: Bot replies with a valid snapshot showing `$0` total with "No USD-valued balances to chart yet" message (never fails silently).

### Yield Alerts Not Firing
- Alerts trigger only when a watched pool's APY changes by **≥1.0 percentage point**
- First run establishes baseline (0 alerts)
- Trigger via cron: `POST /api/notifications/alerts` with `Authorization: Bearer <NOTIFICATION_CRON_SECRET>` and `{"type":"yield"}`
- **Portfolio alerts**: `POST /api/notifications/alerts?type=portfolio&address=0x...`

### Build Fails with "Module not found"
After `rm -rf node_modules && npm install`, ensure `.next/` is cleared:
```bash
rm -rf .next node_modules && npm install && npm run build
```

---

## 17. Future improvements

- Real executor (safe signer, intents/EIP-7702) so the plan can actually be executed — with explicit consent UI.
- Analysis over real on-chain balances (optionally opt-in), with a no-telemetry guarantee.
- Multi-chain portfolio reads (the RPC layer already knows Base/Arbitrum/OP).
- Deeper per-protocol risk inputs (audits, insurance, governance) beyond the current pool-level model.
- Persistent + per-user notification store, Telegram long-polling fallback for local dev, and a hosted deployment.
- Distributed rate limiting (Redis/Upstash KV) and a real integration/E2E test suite.

---

**License**: Private — hackathon submission."""

with open('README.md', 'r') as f:
    content = f.read()

if '## 16. Future improvements' in content:
    content = content.replace('## 16. Future improvements', new_text)
    with open('README.md', 'w') as f:
        f.write(content)
    print('Done!')
else:
    print("Not found")
    idx = content.find('## 16. Future improvements')
    if idx >= 0:
        print(f"Found at index {content.find('## 16. Future improvements')}")
    else:
        print("Section not found")
        print(content[-500:])

print("Done!")
