# What to do next (Railway – OpenClaw)

Follow these steps in order.

**Your live URL:** `https://openclaw-production-347c.up.railway.app`

---

## Verify health (already working)

- **Health endpoint:** Open **https://openclaw-production-347c.up.railway.app/health** in any browser.  
  You should see: `{"status":"ok","timestamp":"..."}` and HTTP 200.  
  Railway uses this for the deployment health check.

---

## Complete setup in the browser

1. **Open in Cursor:** Use **View → Simple Browser** (or **Open in Browser**), or any browser.
2. **Setup wizard:** Go to **https://openclaw-production-347c.up.railway.app/setup**  
   - Enter your **SETUP_PASSWORD** (the one you set in Railway Variables).  
   - Follow the wizard (model provider, API keys, etc.) and click **Run setup**.
3. **Control UI:** Go to **https://openclaw-production-347c.up.railway.app/openclaw**  
   - When asked for the gateway token, enter your **OPENCLAW_GATEWAY_TOKEN**.  
   - That connects the dashboard without needing device pairing.

---

## Step 1: Open your Railway project

1. Go to **https://railway.app** and log in.
2. Open the project that has your **openclaw** service.

---

## Step 2: Redeploy the service

The app needs to restart with the new settings.

1. Click your **openclaw** service.
2. Go to the **Deployments** tab.
3. Click **Redeploy** (or the three dots on the latest deployment → **Redeploy**).

Wait until the deployment shows **Success** (green). This can take 1–2 minutes.

---

## Step 3: Add your secrets (if not already set)

1. In the same project, click your **openclaw** service.
2. Open the **Variables** tab.
3. Add or check these variables. Click **+ New Variable** for each:

| Variable name              | What to put                          |
|---------------------------|--------------------------------------|
| `SETUP_PASSWORD`          | A password you choose (for /setup)   |
| `OPENCLAW_GATEWAY_TOKEN`  | A long random string (gateway auth)  |
| `OPENROUTER_API_KEY`      | Your OpenRouter API key (for models) |

If you use another provider (e.g. Anthropic), add that key instead of or in addition to OpenRouter.

4. Click **Add** / **Save** for each variable.

---

## Step 4: Check volume and port

1. Still in your **openclaw** service, open **Settings**.
2. **Volume:** Make sure a volume is attached and mounted at **`/data`**. If not, add one and set mount path to **`/data`**.
3. **Networking:** Make sure **Public Networking** (or HTTP proxy) is on and the port is **8080**.

---

## Step 5: Open your app

1. In Railway, open the **Settings** or **Deployments** tab and find your **public URL** (e.g. `https://something.up.railway.app`).
2. In your browser, open:
   - **Setup wizard:** `https://YOUR-URL/setup`  
     Use `SETUP_PASSWORD` when asked.
   - **Control UI (dashboard):** `https://YOUR-URL/openclaw`  
     Use `OPENCLAW_GATEWAY_TOKEN` when asked to connect.

---

## If something goes wrong

- **“Permission denied” in logs:**  
  Make sure the variable **`RAILWAY_RUN_UID`** is set to **`0`** in the Variables tab (it was set for you already; you can confirm it’s there).

- **Dashboard says “Disconnected”:**  
  Use the same URL as the gateway (e.g. `https://YOUR-URL/openclaw`) and the same token you set as `OPENCLAW_GATEWAY_TOKEN`.

- **Health check:**  
  Open **https://openclaw-production-347c.up.railway.app/health** in the browser. You should see `{"status":"ok","timestamp":"..."}`. If you see that, health is working.

- **“Pairing required” or “Proxy headers from untrusted address”:**  
  Add variable **OPENCLAW_GATEWAY_TRUSTED_PROXIES** = **100.64.0.0/24** in Railway → Variables, then redeploy. Open the Control UI and connect with your **OPENCLAW_GATEWAY_TOKEN**.

---

**Summary:** Health is at `/health`. Complete setup at `/setup`, then use `/openclaw` with your gateway token.
