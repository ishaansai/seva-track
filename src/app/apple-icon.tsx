import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size    = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{
      background: '#f97316',
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '40px',
      fontSize: 110,
    }}>
      🫶
    </div>,
    { ...size }
  );
}
