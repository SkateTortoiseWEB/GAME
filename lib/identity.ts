import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { DEVICE_RE } from "./session";

const COOKIE = "li_id";

/**
 * Identity is an httpOnly cookie issued by the server (1 year). It limits casual replays and carries
 * the streak, but clearing cookies or using a private window starts fresh; only accounts fix that.
 */
export async function getDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && DEVICE_RE.test(existing)) return existing;
  const id = randomBytes(18).toString("base64url");
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
