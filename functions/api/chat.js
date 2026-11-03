
export async function onRequestPost({ request, env }) {
  try {
    // Check that the Groq API key is configured
    if (!env.GROQ_API_KEY) {
      return Response.json(
        { error: "Missing GROQ_API_KEY Cloudflare secret." },
        { status: 500 }
      );
    }

    // Read the request body
    const body = await request.json();
    const messages = body.messages;

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "A valid messages array is required." },
        { status: 400 }
      );
    }

    // Send the request to Groq
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: body.temperature ?? 0.3
        })
      }
    );

    const data = await groqResponse.json();

    // Handle Groq errors
    if (!groqResponse.ok) {
      return Response.json(
        {
          error:
            data.error?.message ||
            "Groq API request failed."
        },
        { status: groqResponse.status }
      );
    }

    // Get the AI response
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return Response.json(
        { error: "Groq returned an empty response." },
        { status: 502 }
      );
    }

    // Send the reply back to your website
    return Response.json({ reply });

  } catch (error) {
    return Response.json(
      {
        error: error.message || "Internal server error."
      },
      { status: 500 }
    );
  }
}
