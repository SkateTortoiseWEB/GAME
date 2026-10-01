import { getStore } from "./store";

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Hard cap on AI answer checks so a script or a viral day can't run up the bill. Cached and listed answers
 * never reach this; only a genuinely new answer asks the AI. Past either cap the checker says it is busy and
 * the player loses nothing.
 */
export async function takeAiCheck(date: string, deviceId: string): Promise<boolean> {
  const store = getStore();
  const perDevice = num(process.env.AI_DEVICE_DAILY_CAP, 250);
  const global = num(process.env.AI_GLOBAL_DAILY_CAP, 20000);
  if ((await store.bumpCounter(`ai:${date}:${deviceId}`)) > perDevice) return false;
  return (await store.bumpCounter(`ai:${date}:all`)) <= global;
}
