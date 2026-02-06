import type { ProviderUsageSnapshot, UsageWindow } from "./provider-usage.types.js";
import { fetchJson } from "./provider-usage.fetch.shared.js";
import { clampPercent } from "./provider-usage.shared.js";

type OpenRouterUsageResponse = {
  data?: {
    usage?: Array<{
      model_id?: string;
      label?: string;
      usage?: number;
      limit?: number;
      period?: string;
    }>;
    balance?: number;
  };
  error?: {
    message?: string;
  };
};

export async function fetchOpenRouterUsage(
  token: string,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<ProviderUsageSnapshot> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "HTTP-Referer": "https://openclaw.ai",
    "X-Title": "OpenClaw AI Assistant",
    Accept: "application/json",
  };

  // First try to get usage data
  const usageRes = await fetchJson(
    "https://openrouter.ai/api/v1/usage",
    { headers },
    timeoutMs,
    fetchFn,
  );

  if (!usageRes.ok) {
    let message: string | undefined;
    try {
      const data = (await usageRes.json()) as OpenRouterUsageResponse;
      const raw = data?.error?.message;
      if (typeof raw === "string" && raw.trim()) {
        message = raw.trim();
      }
    } catch {
      // ignore parse errors
    }

    const suffix = message ? `: ${message}` : "";
    return {
      provider: "openrouter",
      displayName: "OpenRouter",
      windows: [],
      error: `HTTP ${usageRes.status}${suffix}`,
    };
  }

  const data = (await usageRes.json()) as OpenRouterUsageResponse;
  const windows: UsageWindow[] = [];

  // Process usage data if available
  if (data.data?.usage) {
    // Group usage by period and calculate totals
    const periodGroups: Record<string, { total: number; limit: number; models: string[] }> = {};

    for (const usage of data.data.usage) {
      const period = usage.period || "unknown";
      if (!periodGroups[period]) {
        periodGroups[period] = { total: 0, limit: usage.limit || 0, models: [] };
      }
      periodGroups[period].total += usage.usage || 0;
      if (usage.model_id && !periodGroups[period].models.includes(usage.model_id)) {
        periodGroups[period].models.push(usage.model_id);
      }
    }

    // Create windows for each period
    for (const [period, group] of Object.entries(periodGroups)) {
      const usedPercent = group.limit > 0 ? clampPercent((group.total / group.limit) * 100) : 0;
      const label =
        period === "monthly"
          ? "Month"
          : period === "daily"
            ? "Day"
            : period.charAt(0).toUpperCase() + period.slice(1);

      windows.push({
        label,
        usedPercent,
      });
    }
  }

  // Add balance information if available
  if (typeof data.data?.balance === "number") {
    windows.push({
      label: "Balance",
      usedPercent: 0, // Balance doesn't have a percentage
    });
  }

  // If no usage windows, try to get model info as a fallback
  if (windows.length === 0) {
    try {
      const modelsRes = await fetchJson(
        "https://openrouter.ai/api/v1/models",
        { headers },
        timeoutMs,
        fetchFn,
      );

      if (modelsRes.ok) {
        await modelsRes.json(); // Consume the response

        windows.push({
          label: "Models",
          usedPercent: 0,
        });
      }
    } catch {
      // Ignore model fetch errors
    }
  }

  return {
    provider: "openrouter",
    displayName: "OpenRouter",
    windows,
  };
}
