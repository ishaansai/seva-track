import twilio from 'twilio';

async function sendViaVonage(to: string, body: string): Promise<void> {
  const apiKey = process.env.VONAGE_API_KEY!;
  const apiSecret = process.env.VONAGE_API_SECRET!;
  const from = process.env.VONAGE_FROM ?? '19714168924';
  const digits = to.replace(/\D/g, '');
  const normalized = digits.startsWith('1') ? digits : '1' + digits;

  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, to: normalized, from, text: body }),
  });

  const json = (await res.json()) as { messages: { status: string; 'error-text'?: string }[] };
  const msg = json.messages?.[0];
  if (!msg || msg.status !== '0') {
    throw new Error(`Vonage: ${msg?.['error-text'] ?? 'unknown error'} (status ${msg?.status})`);
  }
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  );
  const normalized = '+1' + to.replace(/\D/g, '').replace(/^1/, '');
  await client.messages.create({
    from: process.env.TWILIO_SMS_FROM!,
    to: normalized,
    body,
  });
}

async function sendViaTextbelt(to: string, body: string, key: string): Promise<void> {
  const digits = to.replace(/\D/g, '');
  const normalized = digits.startsWith('1') ? digits : '1' + digits;

  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, message: body, key }),
  });

  const json = (await res.json()) as { success: boolean; error?: string; quotaRemaining?: number };
  if (!json.success) {
    throw new Error(`Textbelt: ${json.error ?? 'unknown error'}`);
  }
}

export async function sendSMS(to: string, body: string): Promise<void> {
  // Try Vonage first (primary provider — no per-IP rate limit)
  if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
    try {
      await sendViaVonage(to, body);
      return;
    } catch (err) {
      console.warn('[sms] Vonage failed, trying Textbelt:', err);
    }
  }

  // Try Textbelt keys in order
  const textbeltKeys = [
    process.env.TEXTBELT_KEY,
    process.env.TEXTBELT_KEY_2,
  ].filter(Boolean) as string[];

  for (const key of textbeltKeys) {
    try {
      await sendViaTextbelt(to, body, key);
      return;
    } catch (err) {
      console.warn(`[sms] Textbelt key ...${key.slice(-6)} failed, trying next:`, err);
    }
  }

  // Fall back to Twilio
  console.warn('[sms] All Textbelt keys exhausted, falling back to Twilio');
  await sendViaTwilio(to, body);
}
