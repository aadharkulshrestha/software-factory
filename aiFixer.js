const OpenAI = require("openai");

const client = new OpenAI({
  apiKey:
    "", // Set your OpenRouter API key here or use environment variable
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Autonomous Software Factory",
  },
});

async function aiFix(log) {
  const prompt = `
You are an automated production self-healing system.

An error occurred in production:

Service: ${log.service}
Error Code: ${log.error_code}

Your job:
- Give a direct, specific fix action.
- No generic advice.
- No "check logs" or "investigate".
- Output only the fix step.

Examples:
UI_WARNING → Adjust CSS margin or alignment.
API_TIMEOUT → Increase timeout or retry request.
AUTH_FAILURE → Refresh token or fix auth config.

Now give the fix:
`;

  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}

module.exports = aiFix;
