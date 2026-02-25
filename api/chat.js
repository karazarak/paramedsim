export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });

    // Gemini REST endpoint (generateContent)
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `
You are a helpful paramedicine tutor for IV cannulation practice.
Be concise, step-by-step, and practical.
If the user asks something unsafe, explain why and give safer guidance.
User question: ${message}
`.trim();

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ]
      }),
    });

    const data = await resp.json();

    // Typical text location: candidates[0].content.parts[0].text
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("\n")
      || "No reply returned.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
