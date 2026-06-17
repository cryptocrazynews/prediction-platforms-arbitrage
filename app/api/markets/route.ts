import { NextResponse } from 'next/server';
import { buildPayload } from '@/lib/aggregate';

// Always run on the server (adapters use server-only fetch + env vars).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const payload = await buildPayload(force);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
