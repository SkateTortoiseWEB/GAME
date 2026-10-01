// Times one answer-check against your configured LLM and prints exactly what came back.
// Run:  npm run check-llm      (reads .env.local; the key is never printed)
const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const key = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL || "gpt-5-nano";
const timeout = Number(process.env.LLM_TIMEOUT_MS) || 15000;
const effort = process.env.LLM_REASONING_EFFORT || (/^(gpt-5|o\d)/.test(model) ? "minimal" : "");

if (!key) {
  console.error("LLM_API_KEY is empty. Fill it in .env.local first.");
  process.exit(1);
}
console.log(`endpoint: ${base}\nmodel: ${model}\nreasoning_effort: ${effort || "(not sent)"}\ntimeout: ${timeout}ms\n`);

const body = {
  model,
  response_format: { type: "json_object" },
  ...(effort ? { reasoning_effort: effort } : {}),
  messages: [
    { role: "system", content: 'Reply with JSON only: {"valid": boolean, "canonical": string|null}. Decide if the answer is a real member of the category.' },
    { role: "user", content: JSON.stringify({ category: "Cities in Europe", answer: "berlin" }) },
  ],
};

const started = Date.now();
try {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status} in ${Date.now() - started}ms`);
  console.log(text.slice(0, 600));
  console.log(res.ok ? "\nWorks. Anything over ~3000ms will feel slow in the game." : "\nThe provider rejected the request; the message above says why.");
} catch (e) {
  console.log(`FAILED after ${Date.now() - started}ms: ${e.name}: ${e.message}`);
  if (e.cause) console.log("cause:", e.cause.code || e.cause.message || e.cause);
}
