import crypto from "node:crypto";

function buildDataCheckString(params: URLSearchParams) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = params.get("auth_date");

  if (!hash || !authDate) {
    return { ok: false as const, reason: "Missing hash or auth_date" };
  }

  const dataCheckString = buildDataCheckString(params);
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) {
    return { ok: false as const, reason: "Invalid Telegram signature" };
  }

  const authDateUnix = Number(authDate);
  const ageInSeconds = Math.floor(Date.now() / 1000) - authDateUnix;

  if (Number.isNaN(authDateUnix) || ageInSeconds > 60 * 60 * 24) {
    return { ok: false as const, reason: "Telegram auth data is too old" };
  }

  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  return {
    ok: true as const,
    user
  };
}

