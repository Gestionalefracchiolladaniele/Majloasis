---
numero: 006
tema: "L'AI cita Reddit più di Google/Wikipedia (40.1%) → ho costruito un bot che legge Reddit per estrarre segnali di mercato AI"
formato: 🟡 Conversion (lead-magnet) + 🟢 Growth (newsjacking dato Reddit)
voce: asciutto da engineer + presa di posizione misurata, inglese
stato: bozza (pronta da pubblicare — DOPO test runtime del bot, vedi avvertenze)
data_pubblicazione:
immagine: infografica dell'utente "Where AI gets its facts" (classifica domini citati dagli LLM, fonte Semrush 2025) — usare quella come visual del post
lead_magnet: parola "signals" → si manda l'accesso al bot Telegram. CTA da pari a pari, "no funnel".
---

# Post 006 — "AI cites Reddit more than Google. So I read Reddit first."

> Combinazione: dato controintuitivo (amo) + bot Redictra (prova che hai *costruito*, non
> solo commentato) + lead magnet (CTA che genera contatti founder, target Dubai).
> Bucket primario: Conversion (il muro ne aveva bisogno, vedi log). Funziona anche come Growth.
> Safe: zero scraping LinkedIn, zero dashboard. Si parla di API ufficiale Reddit + AI engineering.

---

## ⚠️ PRIMA di pubblicare (non saltare)
1. **Il bot deve girare end-to-end.** Lo stato del progetto è "compila, non testato in runtime".
   Se posti la CTA e poi chi scrive "signals" non riceve nulla → bruci credibilità *e* i contatti
   founder che ti servono. Testa /start → /preview con un digest reale, poi pubblica.
2. **Il dato 40.1% NON è una "quota di torta".** L'infografica (Semrush, 150k citazioni, giu 2025)
   dice: Reddit è il **dominio più frequente** tra le fonti citate dagli LLM (compare nel 40.1%
   delle citazioni), davanti a Wikipedia 26.3% e Google 23.3%. Le percentuali NON sommano a 100
   (sono sovrapposte). → **Mai scrivere "40% di tutto ciò che l'AI dice viene da Reddit"**: è falso
   e un founder tecnico te lo smonta nei commenti. Dì "il sito più citato", non "il 40% di tutto".
3. **Attribuisci la fonte (Semrush 2025).** È già nella tua infografica. Non spacciarla per ricerca tua.
4. **Consegna del bot a mano.** Mai automatizzare i DM (regola del progetto). Quando scrivono,
   mandi tu il link al bot.

---

## VERSIONE A — lead-magnet pieno (CONSIGLIATA per generare contatti)

```
When ChatGPT, Claude or Perplexity cites a source, Reddit shows up more than any other site on the internet.

More than Wikipedia. More than Google. (Semrush, 150k citations, 2025.)

Reddit is the single most cited domain online. It shows up in 40.1% of all AI citations.

So I built something that reads it for me.

Every morning at 6am it goes through the real Reddit conversations on AI and pulls out the only things that matter:

What people are frustrated by. What they keep asking for and nobody ships. Where the market is splitting with no winner yet. Where there's white space.

Not the news. The signal under the news.

It runs on one AI call a day, free tier, official Reddit API. The hard engineering wasn't the AI. It was making it honest: on quiet days it says "people are talking but nothing concrete today" instead of inventing a trend. Most tools would rather lie than look empty.

I use it every morning before I open anything else.

I'm giving it away. No newsletter, no funnel, no upsell.

Comment "Redictra" and I'll send it to you.
```

## VERSIONE B — senza CTA (modo soft, se non vuoi chiedere il commento)
> Stessa storia, ma l'asset è nel post stesso (build-in-public puro). Più alta come aura,
> non genera lista. Usala se questo mese hai già fatto un lead-magnet (la regola dice ~1 ogni 5-6).

```
When ChatGPT or Perplexity cites a source, Reddit shows up more than any other site on the internet.

More than Wikipedia. More than Google. (Semrush, 150k citations, 2025.)

That's not trivia. It's where unfiltered demand lives now. Not in blog posts. In people complaining, asking, arguing in the comments.

So I built a thing that reads it for me every morning at 6am and pulls out four things: what people are frustrated by, what they keep asking for and nobody ships, where the market is splitting with no winner, where there's white space.

Not the news. The signal under the news.

One AI call a day, free tier, official Reddit API. The hard part wasn't the AI. It was making it honest: on quiet days it admits "nothing concrete today" instead of inventing a trend.

Most tools would rather lie than look empty. That's the whole bug in this industry.
```

---

## Note di costruzione
- **Hook a doppio colpo** ("more than Wikipedia. More than Google.") → frase corta, controintuitiva,
  combacia ESATTAMENTE con la tua infografica → l'immagine non ripete, conferma. Stop-scroll forte.
- **La riga del 40.1% è formulata in modo VERO**: "shows up in 40.1% of all AI citations" (= frequenza,
  Reddit è il dominio più citato), NON "40% of everything AI cites traces back to Reddit" (falso: le %
  non sommano a 100, smontabile). Tieni questa formulazione esatta. Vedi avvertenza #2.
- **Riframing immediato** ("isn't trivia / signal under the news"): non resti sul dato, lo *usi*.
  Questo è ciò che separa l'autorità dal repost di una statistica.
- **La prova ("So I built something")**: il pivot che trasforma un'opinione in build-in-public.
  Sei l'unico nel feed che ha *agito* su quel dato → questo è il cuore della forza del post.
- **Il momento-engineer ("one AI call a day, free tier, official Reddit API")**: tre dettagli veri
  che fanno salvare il post ai tecnici e dicono "è serio" ai founder. Coerente col tema $0 del muro.
- **L'onestà come feature** ("on quiet days it says nothing concrete"): è il dettaglio che NON puoi
  inventare → suona come uno che ha costruito davvero. Chiusura B ("rather lie than look empty")
  è la riga più citabile: la tua presa di posizione sul settore.
- **CTA da pari a pari** ("No newsletter, no funnel, no upsell. Comment 'Redictra'."): spiazza,
  dichiara che non sei un growth-hacker → alza la credibilità coi founder (regola lead-magnet #3).
- **Parola "Redictra"** (= il nome del prodotto): scelta deliberata. Più "promozionale" di una parola
  tematica come "signals", ma fa BRANDING (la gente ripete il nome del tuo tool) → coerente con
  l'obiettivo autorità + far ricordare il tuo lavoro. Alternativa più soft: "signals". Tieni "Redictra"
  se ci tieni al nome.
- **Voce:** frasi corte, niente em dash, inglese (Dubai), zero motivazionale. Allineata a 003/004.
- **Safe:** Reddit via API ufficiale, AI engineering sotto vincoli. Nessun accenno a LinkedIn/scraping.

## Immagine
- **Usa la tua infografica "Where AI gets its facts"** (classifica completa dei domini citati dagli
  LLM, reddit.com 40.1% in cima, fonte Semrush 2025). È più autorevole di una quote-card: mostra la
  classifica intera → l'hook "more than Wikipedia, more than Google" è verificabile a colpo d'occhio.
- **Alt text:** *"Infographic 'Where AI gets its facts': ranking of the top domains cited by LLMs like
  ChatGPT and Perplexity. Reddit is #1 at 40.1%, ahead of Wikipedia 26.3% and Google 23.3%. Source: Semrush, 2025."*
- ⚠️ È l'unico post del muro NON in B/N (l'infografica è a colori). Va bene: è newsjacking, l'immagine
  è il dato stesso, non una quote-card del brand. Eccezione consapevole, non un drift di stile.
- 💡 Bonus che l'infografica regala: **linkedin.com è solo al 5.9%** in classifica. Gancio per un
  eventuale follow-up ("l'AI cita Reddit, non i blog/LinkedIn"), ma TIENILO FUORI da questo post per
  non disperdere l'unica idea.

## Follow-up legati
- Authority successivo (safe): "come tengo un bot onesto — perché 'no signal today' è una feature,
  non un bug" → approfondisce la riga più forte di questo post.
- Personal: legare il bot al percorso Dubai (lo uso per capire dove c'è spazio nel mercato AI lì).
- Dopo questo Conversion, il mix mensile è più bilanciato (vedi log README).
