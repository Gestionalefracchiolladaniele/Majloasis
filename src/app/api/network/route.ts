import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Contact } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET — Mappa relazionale (C): trova CLUSTER di contatti che condividono un'azienda
// (corrente o passata, dalle esperienze in raw). Un cluster con ≥2 persone segnala
// un agganciamento caldo: conosci già qualcuno lì → la prossima è un'intro, non un cold.
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('contacts')
    .select('id, name, headline, company, score, status, rel_status, raw');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Pick<
    Contact,
    'id' | 'name' | 'headline' | 'company' | 'score' | 'status' | 'rel_status' | 'raw'
  >[];

  // company normalizzata → membri
  const clusters = new Map<
    string,
    { company: string; members: { id: string; name: string; score: number | null; rel_status: string }[] }
  >();

  for (const c of rows) {
    const companies = new Set<string>();
    if (c.company) companies.add(norm(c.company));
    for (const exp of pastCompanies(c.raw)) companies.add(norm(exp));

    for (const key of companies) {
      if (!key) continue;
      if (!clusters.has(key)) {
        // usa la prima forma "leggibile" incontrata come label
        const label = c.company && norm(c.company) === key ? c.company : key;
        clusters.set(key, { company: label, members: [] });
      }
      const cl = clusters.get(key)!;
      // evita doppioni dello stesso contatto nello stesso cluster
      if (!cl.members.some((m) => m.id === c.id)) {
        cl.members.push({
          id: c.id,
          name: c.name ?? '?',
          score: c.score,
          rel_status: c.rel_status,
        });
      }
    }
  }

  // Tieni solo i cluster con ≥2 membri (un solo contatto non è un "aggancio").
  const result = [...clusters.values()]
    .filter((c) => c.members.length >= 2)
    .map((c) => ({
      ...c,
      // un'azienda è "calda" se hai già almeno un contatto connesso lì
      warm: c.members.some((m) =>
        ['connesso', 'messaggiato', 'risposto', 'in_conversazione'].includes(m.rel_status),
      ),
    }))
    .sort((a, b) => b.members.length - a.members.length);

  return NextResponse.json({ clusters: result });
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Estrae i nomi delle aziende dalle esperienze passate nel raw Apify.
function pastCompanies(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const exp = (raw.experiences ?? raw.experience) as unknown;
  if (!Array.isArray(exp)) return [];
  const out: string[] = [];
  for (const e of exp) {
    if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>;
      const company = (o.companyName ?? o.company) as string | undefined;
      if (company && typeof company === 'string') out.push(company);
    }
  }
  return out;
}
