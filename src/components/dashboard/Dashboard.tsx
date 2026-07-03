'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Contact, Job, Category, UserProfile, ContactStatus, CommentPost } from '@/lib/types';
import { api, type OutreachStats, type InsightStats } from '@/lib/api';
import { ContactCard } from './ContactCard';
import { ContactModal } from './ContactModal';
import { JobCard } from './JobCard';
import { CommentPostCard } from './CommentPostCard';
import { ProfileSetup } from './ProfileSetup';
import { Tracker } from './Tracker';
import { Insights } from './Insights';
import { OutreachSession } from './OutreachSession';
import { Copilot } from './Copilot';

type Tab = 'persone' | 'lavori' | 'commenta' | 'stats' | 'profilo';

const STATUS_FILTERS: { value: ContactStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'da_valutare', label: '📥 Da valutare' },
  { value: 'da_fare', label: '⭐ Da fare' },
  { value: 'fatto', label: '✅ Fatto' },
  { value: 'non_fare', label: '❌ Non fare' },
];

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('persone');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posts, setPosts] = useState<CommentPost[]>([]);
  const [findingPosts, setFindingPosts] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [insights, setInsights] = useState<InsightStats | null>(null);

  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openContact, setOpenContact] = useState<Contact | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const { contacts } = await api.contacts.list();
    setContacts(contacts);
  }, []);

  const loadPosts = useCallback(async () => {
    const { posts } = await api.comments.list();
    setPosts(posts);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, j, pst, cat, p, s, ins] = await Promise.all([
        api.contacts.list(),
        api.jobs.list(),
        api.comments.list(),
        api.categories.list(),
        api.profile.get(),
        api.outreach.stats(),
        api.stats(),
      ]);
      setContacts(c.contacts);
      setJobs(j.jobs);
      setPosts(pst.posts);
      setCategories(cat.categories);
      setProfile(p.profile);
      setStats(s);
      setInsights(ins);
    } catch (e) {
      setBanner(`Errore di caricamento: ${e instanceof Error ? e.message : e}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const visibleContacts =
    statusFilter === 'all' ? contacts : contacts.filter((c) => c.status === statusFilter);

  // Lookup id→contatto e quanti dei selezionati sono senza score (per "Valuta selezionati").
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const selectedMissingScore = [...selected].filter(
    (id) => contactById.get(id)?.score == null,
  ).length;

  // Contatti pronti per una sessione invii: "da_fare" non ancora invitati
  // (a freddo o già scaldati con like/commento).
  const readyToInvite = contacts.filter(
    (c) =>
      c.status === 'da_fare' &&
      ['nessuno', 'likato', 'commentato'].includes(c.rel_status),
  ).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkCategory(category: string) {
    if (!selected.size) return;
    await api.contacts.update([...selected], { category, status: 'da_fare' });
    setSelected(new Set());
    await loadContacts();
  }
  async function bulkStatus(status: ContactStatus) {
    if (!selected.size) return;
    await api.contacts.update([...selected], { status });
    setSelected(new Set());
    await loadContacts();
  }

  async function addCategory() {
    const name = prompt('Nome categoria (es. Finance):');
    if (!name?.trim()) return;
    const emoji = prompt('Emoji (opzionale):') || undefined;
    await api.categories.create(name.trim(), emoji);
    const { categories } = await api.categories.list();
    setCategories(categories);
  }

  async function collectNow(what: 'people' | 'jobs') {
    setCollecting(true);
    setBanner(null);
    try {
      const r = await api.collect(what);
      if (!r.ok) {
        setBanner(`Errore: ${r.error}`);
      } else if (what === 'people') {
        setBanner(
          `✓ Persone: ${r.profilesFound} trovati su Apify · ${r.profilesNew} nuovi · ${r.profilesSaved} salvati.` +
            (r.profilesSaved > 0 ? ' Premi "✨ Completa score" per valutarli.' : '') +
            (r.note ? ` ⚠️ ${r.note}` : ''),
        );
      } else {
        setBanner(
          `✓ Lavori: ${r.jobsFound} trovati · ${r.jobsNew} nuovi · ${r.jobsSaved} salvati.` +
            (r.note ? ` ⚠️ ${r.note}` : ''),
        );
      }
      await loadAll();
    } catch (e) {
      setBanner(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setCollecting(false);
  }

  // Tab "Commenta": scrape on-demand di post recenti su cui commentare a mano.
  async function findPosts() {
    setFindingPosts(true);
    setBanner(null);
    try {
      const r = await api.comments.find();
      if (!r.ok) {
        setBanner(`Errore: ${r.error}`);
      } else if (r.saved > 0) {
        setBanner(`✓ ${r.saved} nuovi post da commentare (${r.found} trovati, ${r.fresh} nuovi).`);
      } else {
        setBanner(`Nessun nuovo post. ${r.note ?? 'Riprova più tardi.'}`);
      }
      await loadPosts();
    } catch (e) {
      setBanner(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setFindingPosts(false);
  }

  // ids opzionale: valuta solo i profili selezionati (meno chiamate Gemini).
  async function backfillScores(ids?: string[]) {
    setBackfilling(true);
    setBanner(null);
    try {
      const r = await api.backfill(ids);
      if (!r.ok) setBanner(`Errore: ${r.error}`);
      else if (r.missing === 0) setBanner('✓ Nessun contatto senza score da valutare.');
      else setBanner(`✓ Score completati: ${r.fixed}/${r.missing} valutati.`);
      if (ids?.length) setSelected(new Set());
      await loadAll();
    } catch (e) {
      setBanner(`Errore: ${e instanceof Error ? e.message : e}`);
    }
    setBackfilling(false);
  }

  // Spunta in un colpo tutti i contatti senza score attualmente visibili.
  function selectMissingScore() {
    const ids = visibleContacts.filter((c) => c.score == null).map((c) => c.id);
    setSelected(new Set(ids));
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 14px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: 0 }}>
          Majloasis 🌴
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'persone' && readyToInvite > 0 && (
            <button onClick={() => setSessionOpen(true)} style={{ ...collectBtn, borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              ▶️ Sessione ({readyToInvite})
            </button>
          )}
          {tab === 'persone' && (insights?.missingScore ?? 0) > 0 && (
            <button
              onClick={() =>
                selectedMissingScore > 0
                  ? backfillScores([...selected].filter((id) => contactById.get(id)?.score == null))
                  : backfillScores()
              }
              disabled={backfilling}
              style={collectBtn}
              title="Valuta i profili senza score (tutti, o solo i selezionati). Clicca dopo 'Aggiorna persone'."
            >
              {backfilling
                ? 'Valuto…'
                : selectedMissingScore > 0
                  ? `✨ Valuta selezionati (${selectedMissingScore})`
                  : `✨ Completa score (${insights?.missingScore})`}
            </button>
          )}
          {(tab === 'persone' || tab === 'lavori') && (
            <button
              onClick={() => collectNow(tab === 'lavori' ? 'jobs' : 'people')}
              disabled={collecting}
              style={collectBtn}
            >
              {collecting
                ? 'Aggiorno…'
                : tab === 'lavori'
                  ? '↻ Aggiorna lavori'
                  : '↻ Aggiorna persone'}
            </button>
          )}
          {tab === 'commenta' && (
            <button
              onClick={findPosts}
              disabled={findingPosts}
              style={{ ...collectBtn, borderColor: 'var(--gold)', color: 'var(--gold)' }}
              title="Cerca post recenti (ultime ore) su cui commentare a mano"
            >
              {findingPosts ? 'Cerco…' : '🔄 Trova 10 post'}
            </button>
          )}
        </div>
      </header>

      <div style={{ marginTop: 14 }}>
        <Tracker stats={stats} />
      </div>

      {banner && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--text-mid)',
          }}
        >
          {banner}
        </div>
      )}

      {/* tabs */}
      <nav style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        {(['persone', 'lavori', 'commenta', 'stats', 'profilo'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: tab === t ? 'var(--bg-elevated)' : 'transparent',
              color: tab === t ? 'var(--on-card-high)' : 'var(--text-mid)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t === 'persone'
              ? '👤 Persone'
              : t === 'lavori'
                ? '💼 Lavori'
                : t === 'commenta'
                  ? '💬 Commenta'
                  : t === 'stats'
                    ? '📊 Stats'
                    : '⚙️ Profilo'}
          </button>
        ))}
      </nav>

      {loading && <p style={{ color: 'var(--text-low)' }}>Caricamento…</p>}

      {tab === 'persone' && !loading && (
        <>
          {/* filtri stato */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: `1px solid ${statusFilter === f.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: statusFilter === f.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: 'var(--text-mid)',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
            {/* scorciatoia: spunta tutti i profili senza score (per dividere la valutazione) */}
            {visibleContacts.some((c) => c.score == null) && (
              <button
                onClick={selectMissingScore}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: '1px solid var(--gold)',
                  background: 'transparent',
                  color: 'var(--gold)',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
                title="Seleziona tutti i profili senza score in questa vista"
              >
                ✨ Spunta senza score
              </button>
            )}
          </div>

          {/* barra azioni multiple (categorie in alto a destra) */}
          {selected.size > 0 && (
            <div
              style={{
                position: 'sticky',
                top: 8,
                zIndex: 10,
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 10,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 8 }}>
                {selected.size} selezionati
                {selectedMissingScore > 0 ? ` (${selectedMissingScore} senza score)` : ''} —
                azioni:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedMissingScore > 0 && (
                  <button
                    onClick={() =>
                      backfillScores([...selected].filter((id) => contactById.get(id)?.score == null))
                    }
                    disabled={backfilling}
                    style={{ ...barChip, borderColor: 'var(--gold)', color: 'var(--gold)' }}
                  >
                    {backfilling ? 'Valuto…' : `✨ Valuta selezionati (${selectedMissingScore})`}
                  </button>
                )}
                {categories.map((c) => (
                  <button key={c.id} onClick={() => bulkCategory(c.name)} style={barChip}>
                    {c.emoji ? `${c.emoji} ` : ''}
                    {c.name}
                  </button>
                ))}
                <button onClick={addCategory} style={barChip}>
                  ＋ Nuova
                </button>
                <span style={{ width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={() => bulkStatus('da_fare')} style={barChip}>
                  ⭐ Da fare
                </button>
                <button onClick={() => bulkStatus('fatto')} style={barChip}>
                  ✅ Fatto
                </button>
                <button onClick={() => bulkStatus('non_fare')} style={barChip}>
                  ❌ Non fare
                </button>
                <button onClick={() => setSelected(new Set())} style={barChip}>
                  Deseleziona
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onOpen={() => setOpenContact(c)}
                warmupDays={profile?.preferences?.warmup_days ?? 2}
              />
            ))}
            {!visibleContacts.length && (
              <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 30 }}>
                Nessun contatto. Compila il profilo e premi &quot;Aggiorna persone&quot;.
              </p>
            )}
          </div>
        </>
      )}

      {tab === 'lavori' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} onUpdated={() => api.jobs.list().then((r) => setJobs(r.jobs))} />
          ))}
          {!jobs.length && (
            <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 30 }}>
              Nessuna offerta ancora. Premi &quot;Aggiorna lavori&quot;.
            </p>
          )}
        </div>
      )}

      {tab === 'commenta' && !loading && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 12 }}>
            Post recenti su cui commentare a mano per farti notare. Il commento si genera a comando,
            poi apri il post e incolli tu.{' '}
            {(() => {
              const weekAgo = Date.now() - 7 * 86_400_000;
              const n = posts.filter(
                (p) => p.commented_at && new Date(p.commented_at).getTime() >= weekAgo,
              ).length;
              return n > 0 ? <strong style={{ color: 'var(--gold)' }}>✅ {n} commentati questa settimana.</strong> : null;
            })()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((p) => (
              <CommentPostCard key={p.id} post={p} onChanged={loadPosts} />
            ))}
            {!posts.length && (
              <p style={{ color: 'var(--text-low)', textAlign: 'center', marginTop: 30 }}>
                Nessun post ancora. Premi &quot;🔄 Trova 10 post&quot; per cercare post recenti su cui
                commentare.
              </p>
            )}
          </div>
        </>
      )}

      {tab === 'stats' && !loading && <Insights stats={insights} />}

      {tab === 'profilo' && !loading && (
        <ProfileSetup initial={profile} onSaved={() => api.profile.get().then((r) => setProfile(r.profile))} />
      )}

      <Copilot onActed={loadAll} />

      {sessionOpen && (
        <OutreachSession
          contacts={contacts}
          remainingToday={stats?.remainingToday ?? 15}
          onClose={() => setSessionOpen(false)}
          onDone={loadAll}
        />
      )}

      {openContact && (
        <ContactModal
          contact={openContact}
          categories={categories}
          onClose={() => setOpenContact(null)}
          onUpdated={async () => {
            await loadContacts();
            const fresh = (await api.contacts.list()).contacts.find((c) => c.id === openContact.id);
            setOpenContact(fresh ?? null);
            api.outreach.stats().then(setStats);
          }}
        />
      )}
    </main>
  );
}

const collectBtn: React.CSSProperties = {
  padding: '8px 13px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-high)',
  fontSize: 13,
  cursor: 'pointer',
};
const barChip: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--text-high)',
  fontSize: 12.5,
  cursor: 'pointer',
};
