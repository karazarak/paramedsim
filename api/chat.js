export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "You are a helpful paramedicine tutor. Be concise, step-by-step, and safety-focused."
          },
          {
            role: "user",
            content: message
          }
        ]
      }),
    });

    const json = await openaiRes.json();

    // Pull the text out of the Responses API payload
    const reply =
      json.output_text ||
      (json.output?.[0]?.content?.[0]?.text ?? "No output_text received.");

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
