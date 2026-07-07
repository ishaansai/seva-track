import twilio from 'twilio';

export async function sendSMS(to: string, body: string): Promise<void> {
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
