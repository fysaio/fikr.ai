import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profiles, memories, tasks, entries, sessions, checkins] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id),
        supabase.from('memories').select('*').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('entries').select('*').eq('user_id', user.id),
        supabase.from('focus_sessions').select('*').eq('user_id', user.id),
        supabase.from('checkins').select('*').eq('user_id', user.id),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      profile: profiles.data?.[0] || null,
      memories: memories.data || [],
      tasks: tasks.data || [],
      entries: entries.data || [],
      focus_sessions: sessions.data || [],
      checkins: checkins.data || [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="gist-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Export failed' },
      { status: 500 }
    );
  }
}
