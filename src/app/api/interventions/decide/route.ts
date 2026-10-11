import { NextResponse } from 'next/server';
import { decideIntervention, DeciderContext } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import { mergeSettings } from '@/lib/settings/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // No Supabase (local dev) or no session: still answer from the request body.
    let user: { id: string } | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    try {
      supabase = await createClient();
      user = (await supabase.auth.getUser()).data.user;
    } catch {
      user = null;
    }

    let userProfile = body.user_profile;
    let memories = Array.isArray(body.memories) ? body.memories : [];
    const interventionsToday = Array.isArray(body.interventions_today)
      ? body.interventions_today
      : [];
    const recentOutcomes = Array.isArray(body.recent_outcomes)
      ? body.recent_outcomes
      : [];

    if (user && supabase) {
      if (!userProfile) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          userProfile = {
            quiet_start: profile.quiet_start,
            quiet_end: profile.quiet_end,
            timezone: profile.timezone,
            nudge_level: profile.nudge_level,
          };
        }
      }

      if (memories.length === 0) {
        const { data: dbMemories } = await supabase
          .from('memories')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active');
        if (dbMemories) memories = dbMemories;
      }
    }

    if (typeof body.timezone === 'string' && body.timezone) userProfile = { ...(userProfile || {}), timezone: userProfile?.timezone || body.timezone };

    const context: DeciderContext = {
      settings: body.settings ? mergeSettings(body.settings) : undefined,
      user_profile: userProfile,
      current_time: body.current_time,
      memories,
      interventions_today: interventionsToday,
      recent_outcomes: recentOutcomes,
      daily_cap: body.daily_cap ?? 2,
    };

    const result = decideIntervention(context);

    // If decision is not silent and user is logged in, record in Supabase interventions table
    if (result.decision !== 'silent' && user && supabase) {
      const { data: inserted } = await supabase
        .from('interventions')
        .insert({
          user_id: user.id,
          kind: result.kind,
          decision: result.decision,
          source_fact_ids: result.source_fact_ids || [],
          text: result.text || '',
          why: result.why || '',
          channel: 'in_app',
          shown_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      return NextResponse.json({
        ...result,
        id: inserted?.id || `inv_${Date.now()}`,
      });
    }

    return NextResponse.json({
      ...result,
      id: `inv_${Date.now()}`,
    });
  } catch (err: any) {
    console.error('Intervention decider API error:', err);
    return NextResponse.json(
      {
        decision: 'silent',
        reason: 'Error occurred in intervention processing; defaulting to silence',
      },
      { status: 500 }
    );
  }
}
