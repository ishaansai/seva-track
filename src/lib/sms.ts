export async function sendSMS(to: string, body: string): Promise<void> {
  const key = process.env.TEXTBELT_KEY;
  if (!key) throw new Error('TEXTBELT_KEY env var is not set');

  // Normalize to 10-digit US number (Textbelt wants digits only, no +)
  const digits = to.replace(/\D/g, '');
  const normalized = digits.startsWith('1') ? digits : '1' + digits;

  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, message: body, key }),
  });

  const json = (await res.json()) as { success: boolean; error?: string; quotaRemaining?: number };
  if (!json.success) {
    throw new Error(`Textbelt error: ${json.error ?? 'unknown'}`);
  }
}
