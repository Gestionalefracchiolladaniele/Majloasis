import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { askCopilot } from '@/lib/gemini';
import type { Contact } from '@/lib/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET — storico della chat copilota (persistente).
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('copilot_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

// DELETE — pulisce lo storico.
export async function DELETE() {
  const db = supabaseAdmin();
  await db.from('copilot_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return NextResponse.json({ ok: true });
}

// POST — nuova domanda. Body: { question }
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

  // 1. Contesto COMPATTO del pool (poche colonne, righe limitate → pochi token).
  const { data: rows } = await db
    .from('contacts')
    .select('id, name, headline, company, location, score, status, rel_status, category, gender_guess')
    .order('score', { ascending: false, nullsFirst: false })
    .limit(120);
  const contacts = (rows ?? []) as Pick<
    Contact,
    | 'id'
    | 'name'
    | 'headline'
    | 'company'
    | 'location'
    | 'score'
    | 'status'
    | 'rel_status'
    | 'category'
    | 'gender_guess'
  >[];

  const total = contacts.length;
  const summary = [
    `Totale contatti (top 120 per score): ${total}`,
    `Per stato: ${tally(contacts.map((c) => c.status))}`,
    `Per relazione: ${tally(contacts.map((c) => c.rel_status))}`,
    '',
    'CONTATTI (id · nome · ruolo · azienda · città · score · stato · rel):',
    ...contacts.map(
      (c) =>
        `${c.id} · ${c.name ?? '?'} · ${c.headline ?? '?'} · ${c.company ?? '?'} · ${c.location ?? '?'} · ${c.score ?? '—'} · ${c.status} · ${c.rel_status}`,
    ),
  ].join('\n');

  // 2. Carica storico recente per dare continuità.
  const { data: hist } = await db
    .from('copilot_messages')
    .select('role, content')
    .order('created_at', { ascending: true })
    .limit(12);

  // 3. Chiedi a Gemini.
  let reply;
  try {
    reply = await askCopilot(question, summary, (hist ?? []) as { role: 'user' | 'assistant'; content: string }[]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 4. Esegui l'eventuale azione proposta (riusa la logica di update contatti).
  let actionResult: string | null = null;
  const validIds = new Set(contacts.map((c) => c.id));
  if (reply.action?.contact_ids?.length) {
    const ids = reply.action.contact_ids.filter((id) => validIds.has(id));
    if (ids.length) {
      const patch =
        reply.action.type === 'update_status'
          ? { status: reply.action.value }
          : { category: reply.action.value };
      const { data, error } = await db.from('contacts').update(patch).in('id', ids).select('id');
      if (!error) actionResult = `✓ ${data?.length ?? 0} contatti aggiornati (${reply.action.value}).`;
    }
  }

  const finalAnswer = actionResult ? `${reply.answer}\n\n${actionResult}` : reply.answer;

  // 5. Salva la conversazione (storico).
  await db.from('copilot_messages').insert([
    { role: 'user', content: question },
    { role: 'assistant', content: finalAnswer },
  ]);

  return NextResponse.json({ answer: finalAnswer, didAction: Boolean(actionResult) });
}

function tally(values: string[]): string {
  const m: Record<string, number> = {};
  for (const v of values) m[v] = (m[v] ?? 0) + 1;
  return Object.entries(m)
    .map(([k, n]) => `${k}=${n}`)
    .join(', ');
}
