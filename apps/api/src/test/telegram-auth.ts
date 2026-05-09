import crypto from "node:crypto";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

function buildDataCheckString(entries: Array<[string, string]>) {
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function createTelegramInitData(user: TelegramUser, botToken = process.env.TELEGRAM_BOT_TOKEN ?? "test-token") {
  const entries: Array<[string, string]> = [
    ["auth_date", `${Math.floor(Date.now() / 1000)}`],
    ["query_id", "AAHdF6IQAAAAAN0XohDhrOrc"],
    ["user", JSON.stringify(user)]
  ];
  const dataCheckString = buildDataCheckString(entries);
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams(entries);
  params.set("hash", hash);
  return params.toString();
}

export function telegramHeaders(user: TelegramUser) {
  return {
    "x-telegram-init-data": createTelegramInitData(user)
  };
}
