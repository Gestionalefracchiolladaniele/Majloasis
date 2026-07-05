---
numero: 007
tema: "Contract Review Agent — un sistema AI che analizza contratti; la chiave non è il modello, è la pipeline scomposta"
formato: 🔵 Authority (build-in-public, ragionamento tecnico da builder)
voce: asciutto da engineer, inglese
stato: PUBBLICATO (testo Opzione 1 finale + infografica v6 con 2 fix: deploy generico non Vercel-only, queue = Redis)
data_pubblicazione:
immagine: infografica architettura "Contract Review Agent" sul NOSTRO stack — versione FINALE v6 (destra): 5 step (async queue, Extract/Google Document AI, Segment&Embed/pgvector, Analyze per clause/Claude+grounding+retry, Summarize, Grounded Q&A), Human review su low-confidence, Data Supabase, DevOps GitHub→Actions→Vercel, barra Security. Niente card "AI Services"/"Reliability" duplicate. Voto: infografica 9.5, stack 9.
fonte_riferimento: post r/ArtificialInteligence "I Built an AI Agent That Reviews Contracts and Highlights Legal Risks" (adattato: stesso sistema, stack nostro, niente Azure)
---

# Post 007 — "Contract Review Agent" (architettura sul nostro stack)

> Adattamento del post-riferimento Reddit (Contract Review Agent / Azure) → ricreato sul NOSTRO
> stack, senza Azure, senza pricing. Bucket Authority (al muro serviva: troppo Growth).
> Tesi presa dal post originale + dal nostro principio di batching: NON dare all'LLM tutto in una
> chiamata, scomponi in step checkable → output affidabili. **Safe:** tema neutro (contract review),
> zero LinkedIn/scraping. Apre la "linea Authority" 007→009→011.

## Testo (pronto da pubblicare)

```
Everyone has the same models now. The difference is the system around them.

Upload a contract. It reads every clause, flags the risky ones, ties each flag to the exact line, and leaves the final call to a human.

The model is one box. The system is the product.
```

## Note di costruzione
> **Versione "uno che ne sa" (aura ~9.5):** riscritta da "presento il mio progetto" a "ecco cosa ho
> imparato sul campo". Vende l'INSIGHT, non il prodotto. (Versione precedente "I built a..." = aura 8,
> da bravo builder; archiviata.)
- **Apre con l'insight, non col prodotto** ("confident, wrong answers") → ferma lo scroll, suona da senior.
- **Racconta il fallimento prima della soluzione** ("looks fine in a demo, fails the day it counts") =
  vissuto, non vendita. È il marchio di chi ne sa.
- **Limite ammesso** ("still struggles with badly scanned tables. honest work, not magic") = il segnale
  di aura più forte e più raro. ⚠️ Deve restare VERO/plausibile: con Google Document AI le tabelle in
  scansioni storte sono notoriamente il punto debole → difendibile. Se non convince, sostituire con un
  limite reale.
- **"The trick isn't the model"** ora è implicito nella struttura (scomporre batte l'unica call) +
  nel nostro batching su Majloasis. Fa salvare ai tecnici.
- **Disclaimer come value-prop, non come scusa** ("doesn't replace a lawyer / hands one a head start /
  the human still makes the call"). Alza la credibilità coi founder + eco del tema "judgment is the
  job" (lega a 003 e ai futuri 009/011). "quoted" richiama il grounding (cita il testo esatto).
- **La riga "boring parts" copre 4 lacune IN MODO IMPLICITO** (aura tecnica senza spiegone): (1)
  retrieval/embeddings → "clauses get embedded"; (2) Q&A solo dal documento → "from the exact passage,
  not the model's memory"; (3) grounding/anti-allucinazione → "every risk points to the line that
  triggered it"; (4) gestione errori/rate-limit → "retries quietly when a call fails". Chi capisce
  coglie i segnali (RAG vero), chi non capisce non si spaventa. Disinnesca i commenti-trappola.
- **Diagramma volutamente SEMPLICE:** embeddings/retry/grounding NON vanno nell'infografica (la
  renderebbero densa/illeggibile) → la profondità la porta il testo. Voto aura: infografica sola 7.5,
  con questa riga ~9.
- **Stack in una riga** ancora il testo all'infografica (Claude nominato, come deciso; niente Apify/
  Gemini/pricing).
- **Voce:** frasi corte, niente em dash, inglese (Dubai), zero motivazionale. Allineata a 003/004/005.

## Valutazione del prodotto (per memoria interna, NON nel post)
- **7.5/10** come prodotto reale (idea/utilità 8, fattibilità 9, difendibilità 6, rischio legale 7).
  Funzionale e NON fuffa SE: (1) grounding — ogni rischio cita il testo esatto della clausola;
  (2) posizionato come assistente, mai sostituto dell'avvocato; (3) Q&A risponde solo dal documento.
- **Pricing reale (solo per noi):** Google Document AI ~$1.5/1000 pagine; Claude ~$0.10–0.50 a
  contratto (Haiku/Sonnet per clausola, Opus per il summary); Supabase/Vercel free a volumi bassi.
  Dev/test ≈ $0–10/mese; uso reale ~$0.10–0.50/contratto. **Nel post NON va pricing.**

## Come funzionerebbe (flusso, per memoria)
1. Upload PDF/DOCX → Supabase Storage.
2. Google Document AI → testo + layout (regge scansioni).
3. Segmentazione in clausole singole (per heading/numerazione) ← passo anti-allucinazione.
4. Claude analizza UNA clausola alla volta (tipo, rischio, perché) citando il testo esatto.
5. Risk scoring aggregato (alto/medio/basso).
6. Summary finale generato DAI risultati strutturati (non dal raw).
7. Q&A → retrieval sulle clausole → Claude risponde solo da quel contratto.
8. Dashboard Next.js: summary, clausole, rischi, chat Q&A.

## Immagine — infografica architettura (versione DESTRA scelta)
- **Usa la versione DESTRA** (vibrant, verticale): step centrali 1→4 con badge numerati e gradienti,
  più leggibile e scroll-stopping della sinistra.
- ⚠️ **Mini-fix se rigeneri:** in "AI Services" il primo box (Google Document AI) deve avere il **logo
  Google**, non l'icona Claude/Anthropic (nella versione vista era duplicata).
- ⚠️ È a colori (non B/N come 003/004/005). Eccezione giustificata: post-pilastro tecnico, infografica
  densa B/N sarebbe meno leggibile. Stessa logica del 006.
- **Alt text:** *"Architecture diagram of a Contract Review Agent: Next.js frontend, Python/FastAPI
  backend with 4 steps (ingestion, document intelligence, AI analysis, results API), Claude and Google
  Document AI, Supabase storage and auth, GitHub Actions to Vercel."*

**Prompt infografica (v3 vibrant — già usato, rigenerabile):** vedi cronologia chat / o rigenerare dal
diagramma: titolo "Contract Review Agent", sottotitolo "AI contract analysis on a modern serverless
stack", formato 4:5, gradiente indigo→violet, accento blue/teal/coral, 4 step-card numerate, gruppi
AI Services (Google Document AI + Anthropic Claude API), Data Storage (Supabase Storage + Postgres),
Auth (Supabase Auth), DevOps strip (GitHub → GitHub Actions → Vercel → Live App), Monitoring, Security.
NIENTE pricing/piani. Loghi reali. Spelling perfetto.

## Follow-up legati
- È il primo della linea Authority 007 → 009 (judgment) → 011 (modello giusto per il task).
- Riusabile come asset/lead-magnet "come progetto un sistema AI affidabile" (pool idee README).
