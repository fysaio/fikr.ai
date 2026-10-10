import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/ai/gateway/admin';
import { getMetricsSummary, clearMetrics } from '@/lib/ai/metrics';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;
  try {
    const summary = getMetricsSummary();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;
  try {
    clearMetrics();
    return NextResponse.json({ success: true, message: 'Telemetry metrics cleared' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to clear metrics' },
      { status: 500 }
    );
  }
}
