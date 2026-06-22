import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken  = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM!; // e.g. "whatsapp:+14155238886"

export function getTwilioClient() {
  return twilio(accountSid, authToken);
}

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  const toFormatted = `whatsapp:+1${to.replace(/\D/g, '').replace(/^1/, '')}`;
  await client.messages.create({ from: fromNumber, to: toFormatted, body });
}
