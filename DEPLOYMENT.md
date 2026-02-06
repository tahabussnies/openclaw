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
- ✅ **railway.json**: Created with Nixpacks builder
- ✅ **Binding**: Configured for 0.0.0.0:$PORT (Railway standard)
- ✅ **Health Check**: `/health` endpoint with 300s timeout
- ✅ **Restart Policy**: ON_FAILURE with 10 max retries

### Environment Variables Required
```bash
# Core Gateway
OPENCLAW_GATEWAY_TOKEN=your-secure-token

# Model Providers
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key

# Channels (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### Persistent State
- Configure Railway volume mount for `/data` or `~/.openclaw`
- Ensures agent memory and config survive redeploys

## Railway Deployment Commands

```bash
# Initialize Railway project
railway init

# Set environment variables
railway vars set OPENROUTER_API_KEY="your-key"
railway vars set OPENCLAW_GATEWAY_TOKEN="your-token"

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

## Documentation Links

- OpenClaw Docs: https://docs.openclaw.ai/
- Railway Docs: https://docs.railway.app/
- OpenRouter API: https://openrouter.ai/docs
- Telegram Bot API: https://core.telegram.org/bots/api
