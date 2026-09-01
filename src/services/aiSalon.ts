export async function aiSalonChat(options: {
  message: string;
  regionConsent?: boolean;
  conversationHistory?: { role: string; text: string }[];
}): Promise<{ reply: string; cards: any[] }> {
  const res = await fetch('/api/ai-salon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error('AI salon request failed');
  return res.json();
}
