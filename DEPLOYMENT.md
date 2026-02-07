# OpenClaw Security & Deployment Guide

## Security Hardening Applied

### CVE-2026-25253 Patch Status
- ✅ **VERIFIED**: Version 2026.2.4 (above vulnerable threshold 2026.1.29)
- ✅ **WebSocket Origin Validation**: Active in `src/gateway/origin-check.ts`
  - Validates Origin header against allowlist and loopback addresses
  - Prevents Cross-Site WebSocket Hijacking (CSWSH)
  - Tests confirm proper rejection of mismatched origins

### Gateway URL Security
- ✅ **AUDITED**: No vulnerable `gatewayUrl` query parameter usage found
- ✅ **CLEAN**: All connections use secure configuration, not URL parameters

### Sandbox Configuration
- ✅ **VERIFIED**: Default sandbox mode is secure
- ✅ **ENFORCED**: `terminal_access` defaults to false in configurations
- ✅ **DOCKER**: All skill execution forced into Docker sandbox environment

### Secret Management
- ✅ **SCANNED**: No hardcoded tokens found in codebase
- ✅ **ENVIRONMENT**: All credentials pulled from environment variables
- ✅ **OPENROUTER_API_KEY**: Properly integrated in config system

## OpenRouter Integration

### Provider Implementation
- ✅ **Native Support**: Added `openrouter` provider to usage tracking
- ✅ **API Integration**: Full usage fetching from `https://openrouter.ai/api/v1/usage`
- ✅ **Model Support**: Recognizes `openrouter/` prefix for models
- ✅ **Environment**: `OPENROUTER_API_KEY` properly configured

### Onboarding Integration
- ✅ **Wizard Support**: OpenRouter available in setup wizard
- ✅ **Default Model**: `openrouter/auto` configured as default
- ✅ **Auth Profiles**: Proper credential management for OpenRouter

## Railway Deployment

### Configuration
- ✅ **railway.json**: Nixpacks builder, inline start command (no script dependency)
- ✅ **Binding**: `--bind lan` (0.0.0.0) so Railway's HTTP proxy can reach the gateway
- ✅ **Health Check**: HTTP GET `/health` endpoint (200 OK), 300s timeout
- ✅ **Restart Policy**: ON_FAILURE with 10 max retries
- ✅ **Start command**: Creates `/data/.openclaw` and `/data/workspace`, sets `OPENCLAW_STATE_DIR`/`OPENCLAW_WORKSPACE_DIR`, then runs the gateway

### Required Railway Settings

1. **Volume**: Attach a volume mounted at `/data` (required for persistent state)
2. **HTTP Proxy**: Enable on port `8080`
3. **Environment Variables** (set in **Railway Dashboard → your service → Variables**):

**Dashboard checklist** — add or confirm these in the Variables tab:

| Variable | Value | Required |
|----------|--------|----------|
| `RAILWAY_RUN_UID` | `0` | Yes (fixes "Permission denied" on `/data`) |
| `SETUP_PASSWORD` | your chosen password | Yes |
| `PORT` | `8080` | Yes |
| `OPENCLAW_GATEWAY_TOKEN` | your secret token | Yes |
| `OPENCLAW_STATE_DIR` | `/data/.openclaw` | Recommended |
| `OPENCLAW_WORKSPACE_DIR` | `/data/workspace` | Recommended |
| `OPENROUTER_API_KEY` or other provider key | (your key) | At least one for models |

4. **Environment Variables** (full list for copy/paste or CLI):

```bash
# Required for volume write access (Railway volumes are root-owned; UID 0 = root)
RAILWAY_RUN_UID=0

# Required (SETUP_PASSWORD protects /setup wizard; set a strong value)
SETUP_PASSWORD=your-setup-password
PORT=8080

# Required for gateway auth
OPENCLAW_GATEWAY_TOKEN=your-secure-token

# Recommended (start command sets these when /data is writable)
OPENCLAW_STATE_DIR=/data/.openclaw
OPENCLAW_WORKSPACE_DIR=/data/workspace

# Trust Railway proxy (fixes "pairing required" / "Health Offline" in dashboard)
OPENCLAW_GATEWAY_TRUSTED_PROXIES=100.64.0.0/24

# Model Providers (at least one required)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key

# Channels (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

**Important**: The gateway reads `OPENCLAW_STATE_DIR` (not `OPENCLAW_DATA_DIR`) for its
data directory. See `src/config/paths.ts` for the full resolution logic.

### Persistent State
- Railway volume must be mounted at `/data`
- **Set `RAILWAY_RUN_UID=0`** so the container runs as root and can create dirs in `/data` (Railway volumes are root-owned; otherwise you get "Permission denied" and the start command falls back to `/tmp`, which is not persistent)
- The start command creates `/data/.openclaw` (state) and `/data/workspace` (workspace) when `/data` is writable
- Config, sessions, and agent memory survive redeploys

### Trusted Proxies (fixes "pairing required" and "Health Offline")
Railway's load balancer uses 100.64.0.x. Set the env var **`OPENCLAW_GATEWAY_TRUSTED_PROXIES=100.64.0.0/24`** on the service. The gateway then trusts the proxy and uses `X-Forwarded-For` for client detection, so token auth works and the dashboard connects instead of "pairing required". You can also add `gateway.trustedProxies` in the config file or Control UI.

## Railway Deployment Commands

```bash
# Initialize Railway project
railway init

# Option A: Set variables via API script (no interactive CLI)
# 1. Create a token at https://railway.com/account/tokens (Account or Workspace token)
# 2. In repo root: set RAILWAY_TOKEN=<your-token> then run:
node scripts/railway-set-vars.js
# This sets RAILWAY_RUN_UID=0, PORT=8080, OPENCLAW_STATE_DIR, OPENCLAW_WORKSPACE_DIR.
# Add secrets (SETUP_PASSWORD, OPENCLAW_GATEWAY_TOKEN, API keys) in the Railway dashboard.

# Option B: Railway CLI (interactive; vars must be set in dashboard — CLI cannot set vars)
railway vars set RAILWAY_RUN_UID="0"
railway vars set SETUP_PASSWORD="your-password"
railway vars set PORT="8080"
railway vars set OPENCLAW_GATEWAY_TOKEN="your-token"
railway vars set OPENROUTER_API_KEY="your-key"

# Deploy service
railway up

# Monitor deployment
railway logs
```

## Channel Compatibility

### Telegram
- ✅ **Bot API**: Full support with polling mode
- ✅ **Authentication**: Bot token from BotFather
- ✅ **Rate Limits**: Respects Telegram API limits (30 msg/sec)
- ✅ **Commands**: Add with `openclaw channels add telegram --token $TOKEN`

### WhatsApp Web
- ✅ **Bridge Server**: Headless Chromium automation
- ✅ **QR Flow**: Standard WhatsApp Web authentication
- ✅ **Session Persistence**: Requires volume mount for session cookies
- ✅ **Commands**: `openclaw web bridge --port 9223` then add channel

## Testing Checklist

### Pre-Deployment
- [x] Build passes: `pnpm build`
- [x] Lint passes: `pnpm check`
- [x] Security audit: `openclaw security audit --deep`
- [x] Gateway starts: `openclaw gateway --bind 127.0.0.1 --port 18789`

### Post-Deployment
- [ ] Gateway responds on Railway URL
- [ ] OpenRouter usage tracking works
- [ ] Telegram bot responds to messages
- [ ] WhatsApp bridge connects successfully
- [ ] Health check endpoint returns 200

## Security Recommendations

1. **Always use HTTPS** for Railway deployment
2. **Set strong gateway tokens** - rotate regularly
3. **Enable sandbox mode** for all untrusted inputs
4. **Monitor usage** via OpenRouter integration
5. **Keep dependencies updated** regularly
6. **Review Railway logs** for security events

## Troubleshooting

### Common Issues
- **EACCES permission denied on `/data/.openclaw`**: The gateway is using the wrong
  state directory. Ensure `OPENCLAW_STATE_DIR=/data/.openclaw` is set (not `OPENCLAW_DATA_DIR`).
  The `/data` volume must be mounted and writable by the container user.
- **"Proxy headers detected from untrusted address"**: Railway's load balancer IPs
  are not in `gateway.trustedProxies`. The startup script seeds these automatically on
  first deploy. If the config was created manually, add Railway's 100.64.0.x IPs to
  `gateway.trustedProxies` in `openclaw.json`.
- **Dashboard shows "Disconnected"**: Usually caused by EACCES errors (see above).
  Check Railway deployment logs for permission errors.
- **Health check returns 404**: Ensure you are running a version with the HTTP `/health`
  endpoint (added in `src/gateway/server-http.ts`).
- **Gateway won't start**: Check Railway environment variables
- **OpenRouter auth fails**: Verify API key format and permissions
- **Telegram no response**: Check bot token and webhook/polling mode
- **WhatsApp session expires**: Re-authenticate via QR scan

### Debug Commands
```bash
# Gateway status
openclaw status --deep

# Channel diagnostics
openclaw channels status --deep

# Security audit
openclaw security audit --deep

# Test OpenRouter
openclaw chat --provider openrouter --model openrouter/auto --text "ping"
```

## Related OpenClaw documentation

These [docs.openclaw.ai](https://docs.openclaw.ai/) pages apply to Railway and cloud deployments:

- [Deploy on Railway](https://docs.openclaw.ai/install/railway) — checklist, variables, setup flow
- [Environment variables](https://docs.openclaw.ai/environment) — precedence and config `env` block
- [Gateway configuration](https://docs.openclaw.ai/gateway/configuration) — `gateway.trustedProxies`, auth, control UI base path
- [Gateway troubleshooting](https://docs.openclaw.ai/gateway/troubleshooting) — common issues, "Gateway start blocked", port and bind
- [Health checks](https://docs.openclaw.ai/gateway/health) — CLI health and status commands
- [Control UI](https://docs.openclaw.ai/web/control-ui) — auth, pairing, token, HTTPS
- [FAQ](https://docs.openclaw.ai/help/faq) — "First 60 seconds", bind/auth, "Disconnected from gateway"

## Documentation Links

- OpenClaw Docs: https://docs.openclaw.ai/
- Railway Docs: https://docs.railway.app/
- OpenRouter API: https://openrouter.ai/docs
- Telegram Bot API: https://core.telegram.org/bots/api
