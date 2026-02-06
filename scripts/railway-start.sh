#!/bin/sh
set -e

# Railway entrypoint script for OpenClaw Gateway.
#
# This script:
# 1. Creates state and workspace directories on the Railway volume (/data)
# 2. Sets the correct environment variables the gateway code reads
# 3. Seeds an initial config with trustedProxies for Railway's internal LB
# 4. Starts the gateway with appropriate flags for Railway

# --- Directory setup ---
# Railway volume is mounted at /data. Create subdirectories for state and workspace.
mkdir -p /data/.openclaw /data/workspace

# --- Environment variables ---
# The gateway reads OPENCLAW_STATE_DIR (NOT OPENCLAW_DATA_DIR) for its data directory.
# See: src/config/paths.ts → resolveStateDir()
export OPENCLAW_STATE_DIR=/data/.openclaw
export OPENCLAW_WORKSPACE_DIR=/data/workspace

# --- Initial config seeding ---
# If no config file exists yet (first deploy), write a minimal one with trustedProxies.
# Railway's internal load balancer forwards requests from IPs in the 100.64.0.0/10
# CGNAT range. Without trustedProxies configured, the gateway logs warnings on every
# connection and cannot detect local clients behind the proxy.
if [ ! -f /data/.openclaw/openclaw.json ]; then
  node -e "
    // Generate Railway internal proxy IPs (100.64.0.0/24 covers observed LB addresses)
    const proxies = [];
    for (let i = 0; i <= 255; i++) proxies.push('100.64.0.' + i);
    const config = { gateway: { trustedProxies: proxies } };
    require('fs').writeFileSync(
      '/data/.openclaw/openclaw.json',
      JSON.stringify(config, null, 2)
    );
    console.log('[railway-start] Seeded initial config with trustedProxies (100.64.0.0/24)');
  "
fi

# --- Start the gateway ---
# --bind lan       : Listen on 0.0.0.0 (required for Railway's HTTP proxy to reach us)
# --port           : Use Railway's PORT env var (typically 8080), fallback to 8080
# --auth token     : Require token authentication for all connections
# --allow-unconfigured : Allow start without gateway.mode=local in the config
exec npx openclaw gateway \
  --bind lan \
  --port "${PORT:-8080}" \
  --auth token \
  --token "$OPENCLAW_GATEWAY_TOKEN" \
  --allow-unconfigured
