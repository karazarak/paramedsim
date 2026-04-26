// Vercel Serverless Function: /api/chat
// Calls Google Gemini generateContent.
// Set GEMINI_API_KEY in Vercel Project Settings → Environment Variables.

export default async function handler(req, res) {
  // Helpful: quick check without exposing the key
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      note: "POST { message } to get a reply."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel environment variables" });
    }

    // ✅ Newer model available to new users
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const system = "You are a helpful paramedicine tutor for IV cannulation. Be concise, step-by-step, and practical.";

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: system }] },
          { parts: [{ text: message }] }
        ]
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Gemini API error",
        details: data
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") ||
      "No reply returned.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
