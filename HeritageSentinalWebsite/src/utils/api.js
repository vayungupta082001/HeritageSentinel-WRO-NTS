// src/utils/api.js
/**
 * Send a question to the MUSE backend (/api/ask).
 * Returns { text: string }.
 */
export async function askMuse({ question, language = 'en-US' }) {
  const res = await fetch('/api/ask', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ question, language }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`MUSE API error ${res.status}: ${err}`);
  }

  return res.json(); // { text: "..." }
}
