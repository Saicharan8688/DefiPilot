# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in DeFiPilot, please report it responsibly:

1. **Do not** open a public issue.
2. Email the maintainers directly or use GitHub's private vulnerability reporting.
3. Include details about the vulnerability, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Features

### Read-Only Blockchain Layer
- All blockchain interactions are **read-only** (eth_call, eth_getBalance, eth_getBlockNumber, eth_gasPrice)
- **No private keys** are ever handled by the application
- **No transaction signing or broadcasting** occurs
- Wallet connections via RainbowKit (real mode) or deterministic demo wallets

### Input Validation
- All API endpoints validate and sanitize inputs
- Address validation via `viem` checksum verification
- Numeric bounds checking (amount limits, percentage bounds)
- Request body size limits (64KB max)
- Strict parameter validation with detailed error codes

### Rate Limiting
- In-memory sliding window rate limiting per IP
- Tiered limits:
  - Read endpoints: 60 req/min
  - Write endpoints: 10 req/min
  - LLM endpoints: 2 req/min

### Rate Limit Headers
- `Retry-After` header on 429 responses
- `X-RateLimit-Remaining` header

### Error Handling
- Standardized error codes (`INVALID_PARAMS`, `INVALID_ADDRESS`, `RATE_LIMITED`, `PORTFOLIO_UNAVAILABLE`, etc.)
- No internal error details leaked to clients
- Sanitized error messages

### Secrets Management
- All secrets loaded from environment variables (`.env.local`, gitignored)
- `.env.example` contains no real secrets
- Telegram bot token and cron secret never logged

### Telegram Bot Security
- Bot token validated on each request
- Cron endpoint protected by Bearer token (`NOTIFICATION_CRON_SECRET`)
- Webhook verifies bot token before processing
- User privacy: bot cannot message until user sends `/start`

### Dependency Security
- npm overrides used to patch transitive vulnerabilities:
  - `ws@8.21.0` (fixes HIGH severity ws vulnerabilities)
  - `decode-uri-component@0.5.0` (fixes MODERATE DoS)
  - `uuid@9.0.1` (patches buffer bounds check)
  - `axios@1.18.1` (fixes HIGH prototype pollution/DoS)
- Remaining moderate vulnerabilities are in transitive dependencies requiring breaking changes

### Security Headers
```
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

### Smart Contract Safety
- **No transaction signing or broadcasting**
- Transaction previews show `approved: false, executed: false`
- Contract addresses resolved at execution time (never emitted)
- Simulation sandbox only — no real execution

### Agent Safety
- LLM only proposes percentages; all math done by deterministic code
- Tool calls validated against strict JSON schemas (`additionalProperties: false`)
- Fallback deterministic planner when LLM unavailable
- Tool results validated before use

## Known Limitations

1. **In-memory rate limiting** - Resets on server restart; production should use Redis/Upstash
2. **In-memory notification store** - Resets on server restart; persistent store needed for production
3. **No authentication on public API routes** - Appropriate for read-only demo; production needs auth
4. **Telegram webhook secret not verified** - Accepts any POST; should validate X-Telegram-Bot-Api-Secret-Token in production

## Security Contact

For security concerns, please contact the maintainers via GitHub's private vulnerability reporting.

---

*Last updated: 2026-09-11*