import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return false;
}

/**
 * Validates a user-supplied news URL before the server fetches it, to reduce SSRF risk:
 * only http(s), no localhost/private IP literals, and DNS resolution is checked too
 * (a public hostname can still resolve to a private IP).
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`올바르지 않은 URL입니다: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`지원하지 않는 URL 프로토콜입니다: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("로컬 호스트 주소는 허용되지 않습니다.");
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("사설 IP 대역은 허용되지 않습니다.");
    }
    return url;
  }

  const { address } = await lookup(hostname).catch(() => {
    throw new Error(`호스트를 확인할 수 없습니다: ${hostname}`);
  });
  if (isPrivateIp(address)) {
    throw new Error("사설 IP로 확인되는 호스트는 허용되지 않습니다.");
  }

  return url;
}
