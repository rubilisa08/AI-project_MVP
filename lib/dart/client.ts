const DEFAULT_BASE_URL = "https://opendart.fss.or.kr/api";
const TIMEOUT_MS = 30_000;

/** DART_API_BASE exists so tests can point the client at a local fake server. */
function baseUrl(): string {
  return process.env.DART_API_BASE || DEFAULT_BASE_URL;
}

export function getDartApiKey(): string {
  const key = process.env.DART_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "DART_API_KEY가 설정되어 있지 않습니다. OpenDART(opendart.fss.or.kr)에서 인증키를 발급받아 환경변수에 추가하세요.",
    );
  }
  return key;
}

/** Maps OpenDART's numeric status codes to messages a user can act on. */
export function dartStatusError(status: string, message: string): Error {
  switch (status) {
    case "010":
    case "011":
    case "012":
    case "901":
      return new Error(`DART API 키가 유효하지 않습니다 (${status}): ${message}`);
    case "013":
      return new Error(
        "해당 조건의 재무 데이터가 없습니다. 회사명·사업연도·보고서 종류를 확인하거나, 아직 공시되지 않은 보고서일 수 있습니다.",
      );
    case "020":
      return new Error("DART API 일일 요청 한도를 초과했습니다. 내일 다시 시도하세요.");
    case "800":
      return new Error("DART 서버가 점검 중입니다. 잠시 후 다시 시도하세요.");
    default:
      return new Error(`DART API 오류 (${status}): ${message}`);
  }
}

/** GETs an OpenDART endpoint and returns the raw body. The key never appears in thrown messages. */
export async function dartFetch(path: string, params: Record<string, string> = {}): Promise<Buffer> {
  const url = new URL(`${baseUrl()}/${path}`);
  url.searchParams.set("crtfc_key", getDartApiKey());
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const reason = timedOut ? `${TIMEOUT_MS / 1000}초 안에 응답이 없었습니다` : error instanceof Error ? error.message : String(error);
    throw new Error(`OpenDART(${path}) 요청에 실패했습니다 — ${reason}. 잠시 후 다시 시도하세요.`);
  } finally {
    clearTimeout(timer);
  }
}
