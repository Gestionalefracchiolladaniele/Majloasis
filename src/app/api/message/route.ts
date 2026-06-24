import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateMessage } from '@/lib/gemini';
import type { UserPreferences } from '@/lib/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST — genera il MESSAGGIO (DM post-accettazione) per un contatto.
// Body: { contactId, regenerate? }. Se esiste già un messaggio e regenerate
// non è true, lo restituisce dalla cache (niente chiamata Gemini sprecata).
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { contactId?: string; regenerate?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.contactId) {
    return NextResponse.json({ error: 'contactId required' }, { status: 400 });
  }

  const { data: contact, error } = await db
    .from('contacts')
    .select('name, headline, company, location, message')
    .eq('id', body.contactId)
    .single();
  if (error || !contact) {
    return NextResponse.json({ error: 'contact not found' }, { status: 404 });
  }

  if (contact.message && !body.regenerate) {
    return NextResponse.json({ message: contact.message, cached: true });
  }

  const { data: userRows } = await db
    .from('user_profile')
    .select('summary, preferences')
    .order('updated_at', { ascending: false })
    .limit(1);
  const summary: string | null = userRows?.[0]?.summary ?? null;
  const prefs: UserPreferences | null = userRows?.[0]?.preferences ?? null;

  try {
    const message = await generateMessage(contact, summary, prefs);
    await db.from('contacts').update({ message }).eq('id', body.contactId);
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
