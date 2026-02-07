import net from "node:net";
import { pickPrimaryTailnetIPv4, pickPrimaryTailnetIPv6 } from "../infra/tailnet.js";

export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }
  if (ip === "127.0.0.1") {
    return true;
  }
  if (ip.startsWith("127.")) {
    return true;
  }
  if (ip === "::1") {
    return true;
  }
  if (ip.startsWith("::ffff:127.")) {
    return true;
  }
  return false;
}

function normalizeIPv4MappedAddress(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }
  return ip;
}

function normalizeIp(ip: string | undefined): string | undefined {
  const trimmed = ip?.trim();
  if (!trimmed) {
    return undefined;
  }
  return normalizeIPv4MappedAddress(trimmed.toLowerCase());
}

function stripOptionalPort(ip: string): string {
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    if (end !== -1) {
      return ip.slice(1, end);
    }
  }
  if (net.isIP(ip)) {
    return ip;
  }
  const lastColon = ip.lastIndexOf(":");
  if (lastColon > -1 && ip.includes(".") && ip.indexOf(":") === lastColon) {
    const candidate = ip.slice(0, lastColon);
    if (net.isIP(candidate) === 4) {
      return candidate;
    }
  }
  return ip;
}

export function parseForwardedForClientIp(forwardedFor?: string): string | undefined {
  const raw = forwardedFor?.split(",")[0]?.trim();
  if (!raw) {
    return undefined;
  }
  return normalizeIp(stripOptionalPort(raw));
}

function parseRealIp(realIp?: string): string | undefined {
  const raw = realIp?.trim();
  if (!raw) {
    return undefined;
  }
  return normalizeIp(stripOptionalPort(raw));
}

/** Returns true if ip (IPv4) is inside the CIDR block (e.g. "100.64.0.0/24"). */
function isIpInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf("/");
  if (slash === -1) return false;
  const base = cidr.slice(0, slash).trim();
  const bits = parseInt(cidr.slice(slash + 1), 10);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipParts = ip.split(".").map((p) => parseInt(p, 10));
  const baseParts = base.split(".").map((p) => parseInt(p, 10));
  if (ipParts.length !== 4 || baseParts.length !== 4 || ipParts.some(isNaN) || baseParts.some(isNaN))
    return false;
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
  const ipNum = (ipParts[0]! << 24) | (ipParts[1]! << 16) | (ipParts[2]! << 8) | ipParts[3]!;
  const baseNum = (baseParts[0]! << 24) | (baseParts[1]! << 16) | (baseParts[2]! << 8) | baseParts[3]!;
  return (ipNum & mask) === (baseNum & mask);
}

export function isTrustedProxyAddress(ip: string | undefined, trustedProxies?: string[]): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized || !trustedProxies || trustedProxies.length === 0) {
    return false;
  }
  // Check for wildcard first
  if (trustedProxies.includes("*")) {
    return true;
  }
  return trustedProxies.some((proxy) => {
    const p = proxy.trim();
    if (p === "*") return true;
    if (p.includes("/")) {
      return isIpInCidr(normalized, p);
    }
    return normalizeIp(p) === normalized;
  });
}

export function resolveGatewayClientIp(params: {
  remoteAddr?: string;
  forwardedFor?: string;
  realIp?: string;
  trustedProxies?: string[];
}): string | undefined {
  const remote = normalizeIp(params.remoteAddr);
  if (!remote) {
    return undefined;
  }
  if (!isTrustedProxyAddress(remote, params.trustedProxies)) {
    return remote;
  }
  return parseForwardedForClientIp(params.forwardedFor) ?? parseRealIp(params.realIp) ?? remote;
}

export function isLocalGatewayAddress(ip: string | undefined): boolean {
  if (isLoopbackAddress(ip)) {
    return true;
  }
  if (!ip) {
    return false;
  }
  const normalized = normalizeIPv4MappedAddress(ip.trim().toLowerCase());
  const tailnetIPv4 = pickPrimaryTailnetIPv4();
  if (tailnetIPv4 && normalized === tailnetIPv4.toLowerCase()) {
    return true;
  }
  const tailnetIPv6 = pickPrimaryTailnetIPv6();
  if (tailnetIPv6 && ip.trim().toLowerCase() === tailnetIPv6.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Resolves gateway bind host with fallback strategy.
 *
 * Modes:
 * - loopback: 127.0.0.1 (rarely fails, but handled gracefully)
 * - lan: always 0.0.0.0 (no fallback)
 * - tailnet: Tailnet IPv4 if available, else loopback
 * - auto: Loopback if available, else 0.0.0.0
 * - custom: User-specified IP, fallback to 0.0.0.0 if unavailable
 *
 * @returns The bind address to use (never null)
 */
export async function resolveGatewayBindHost(
  bind: import("../config/config.js").GatewayBindMode | undefined,
  customHost?: string,
): Promise<string> {
  const mode = bind ?? "loopback";

  if (mode === "loopback") {
    // 127.0.0.1 rarely fails, but handle gracefully
    if (await canBindToHost("127.0.0.1")) {
      return "127.0.0.1";
    }
    return "0.0.0.0"; // extreme fallback
  }

  if (mode === "tailnet") {
    const tailnetIP = pickPrimaryTailnetIPv4();
    if (tailnetIP && (await canBindToHost(tailnetIP))) {
      return tailnetIP;
    }
    if (await canBindToHost("127.0.0.1")) {
      return "127.0.0.1";
    }
    return "0.0.0.0";
  }

  if (mode === "lan") {
    return "0.0.0.0";
  }

  if (mode === "custom") {
    const host = customHost?.trim();
    if (!host) {
      return "0.0.0.0";
    } // invalid config → fall back to all

    if (isValidIPv4(host) && (await canBindToHost(host))) {
      return host;
    }
    // Custom IP failed → fall back to LAN
    return "0.0.0.0";
  }

  if (mode === "auto") {
    if (await canBindToHost("127.0.0.1")) {
      return "127.0.0.1";
    }
    return "0.0.0.0";
  }

  return "0.0.0.0";
}

/**
 * Test if we can bind to a specific host address.
 * Creates a temporary server, attempts to bind, then closes it.
 *
 * @param host - The host address to test
 * @returns True if we can successfully bind to this address
 */
export async function canBindToHost(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const testServer = net.createServer();
    testServer.once("error", () => {
      resolve(false);
    });
    testServer.once("listening", () => {
      testServer.close();
      resolve(true);
    });
    // Use port 0 to let OS pick an available port for testing
    testServer.listen(0, host);
  });
}

export async function resolveGatewayListenHosts(
  bindHost: string,
  opts?: { canBindToHost?: (host: string) => Promise<boolean> },
): Promise<string[]> {
  if (bindHost !== "127.0.0.1") {
    return [bindHost];
  }
  const canBind = opts?.canBindToHost ?? canBindToHost;
  if (await canBind("::1")) {
    return [bindHost, "::1"];
  }
  return [bindHost];
}

/**
 * Validate if a string is a valid IPv4 address.
 *
 * @param host - The string to validate
 * @returns True if valid IPv4 format
 */
function isValidIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    const n = parseInt(part, 10);
    return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
  });
}

export function isLoopbackHost(host: string): boolean {
  return isLoopbackAddress(host);
}
