import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { intervention_id, outcome } = await req.json();

    if (!intervention_id || !outcome) {
      return NextResponse.json(
        { error: 'intervention_id and outcome are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intervention_id)) {
      await supabase
        .from('interventions')
        .update({
          outcome,
          outcome_at: new Date().toISOString(),
        })
        .eq('id', intervention_id)
        .eq('user_id', user.id);
    }

    // Instrumentation logging (event only, no content)
    console.log(
      '[INSTRUMENTATION_EVENT]',
      JSON.stringify({
        event: 'intervention_outcome_recorded',
        outcome,
        at: new Date().toISOString(),
      })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Intervention outcome recording error:', err);
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }
}
