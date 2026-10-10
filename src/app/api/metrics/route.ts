import { NextResponse } from 'next/server';
import { getMetricsSummary, clearMetrics } from '@/lib/ai/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
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

export async function DELETE() {
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
