import { getAuthToken } from './api';

export async function aiSalonChat(options: {
  message: string;
  regionConsent?: boolean;
  conversationHistory?: { role: string; text: string }[];
  conversationState?: { intent?: string; location?: string; salonId?: string; salonName?: string; serviceId?: string; serviceName?: string; date?: string; time?: string; pendingQuestion?: string; lastResolvedContext?: string };
}): Promise<{
  reply: string;
  cards: any[];
  intent?: string;
  entities?: any;
  needsClarification?: boolean;
  conversationState?: any;
}> {
  const token = getAuthToken();
  const res = await fetch('/api/ai-salon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...options }),
  });
  if (!res.ok) throw new Error('AI salon request failed');
  return res.json();
}
