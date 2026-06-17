import { NextResponse } from 'next/server';
import { buildPayload } from '@/lib/aggregate';
import { env } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Triggered by Vercel Cron (see vercel.json). Optionally protect with
// CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`.
export async function GET(request: Request) {
  if (env.cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  const payload = await buildPayload(true);
  return NextResponse.json({
    ok: true,
    refreshedAt: payload.generatedAt,
    markets: payload.markets.length,
    arbs: payload.arbs.length,
  });
}
