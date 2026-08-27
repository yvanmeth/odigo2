const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-5'

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function extractText(data: { content?: { type: string; text?: string }[] }): string {
  return (data.content?.find(b => b.type === 'text')?.text || '')
    .replace(/```json|```/g, '').trim()
}

export async function callClaude(prompt: string, maxTokens = 2000, systemPrompt?: string): Promise<string> {
  const body: {
    model: string
    max_tokens: number
    messages: { role: string; content: string }[]
    system?: string
  } = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  }
  if (systemPrompt) body.system = systemPrompt
  const res = await fetch(CLAUDE_API, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) })
  const data = await res.json()
  return extractText(data)
}

export async function callClaudeWithImage(
  base64: string,
  mediaType: string,
  prompt: string,
  maxTokens = 1000,
): Promise<string> {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt },
      ] }],
    }),
  })
  const data = await res.json()
  return extractText(data)
}
