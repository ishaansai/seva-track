/**
 * sendSMS — tries Textbelt first, falls back to Twilio.
 *
 * Textbelt is the primary provider (no A2P registration needed).
 * Twilio is the fallback — it kicks in automatically once the A2P
 * 10DLC campaign (CM4e2f6309ad84e9df69d2f3b63888f9ae) gets approved,
 * which typically takes 2-3 weeks.
 */
import twilio from 'twilio';

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

async function sendViaTextbelt(to: string, body: string): Promise<void> {
  const key = process.env.TEXTBELT_KEY;
  if (!key) throw new Error('TEXTBELT_KEY not set');

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
  // Try Textbelt first
  if (process.env.TEXTBELT_KEY) {
    try {
      await sendViaTextbelt(to, body);
      return;
    } catch (err) {
      console.warn('[sms] Textbelt failed, falling back to Twilio:', err);
    }
  }

  // Fall back to Twilio
  await sendViaTwilio(to, body);
}
