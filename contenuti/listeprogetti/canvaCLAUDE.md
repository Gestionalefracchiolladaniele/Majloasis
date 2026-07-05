# CLAUDE.md — Content Factory

Riferimento unico dell'app. Design → [ARCHITECTURE.md](ARCHITECTURE.md); storico build → [PROGRESS.md](PROGRESS.md); setup → [README.md](README.md).

---

## 1. Cos'è

Content factory per **marketing organico multi-app** (5–10 app, volume medio): genera **caroselli PNG** + **video**, ognuna con design system, descrizione, tono e audience propri. Contenuti **veri** (ricerca con fonti tracciate) → **review umana** → approvazione. Automazione via GitHub Actions; dashboard Vercel mobile-friendly.

- **Principio cardine:** *Gemini scrive SOLO le parole; Satori disegna in modo deterministico.* Mai testo dentro un'immagine generata da AI (lettere sbagliate, brand incoerente). Testo vero + font veri → sempre nitido.
- **Veridicità:** ricerca (passo 1) con Google Search grounding → fonti reali (uri+title) in `content_pieces.research`, mostrate in dashboard. Niente si pubblica senza approvazione.
- **2 layer per slide:** LAYER 1 = sfondo (`designed`|`ai`|`stock`), LAYER 2 = testo Satori.
- **2 template LAYER 2** (minimal/bold RIMOSSI): **`visual` = `editorial` + icone** — stesso layout premium (sistema a ruoli, layout centrato, keyword col box accent, intro keyword gigante obliqua + watermark, cta banda diagonale + pillola sotto titolo, numerazione solo-teaching, `@handle` in basso a dx), `visual` in più disegna l'**icona Phosphor** (chip + watermark) scelta da Gemini via `copy.iconName` — NON SVG generati da AI. Icona inesistente → nessuna icona. **Titolo = Inter, corpo = Lora** (serif, contrasto premium).
- **Kit social** (`content_pieces.social`): caption (hook+valore+CTA, 150–200 parole), 3–5 hashtag di nicchia (IG dal 12/2025 max 5), primo commento, alt text per slide, orario. Da Gemini, modificabile in Review.
- **Lingua IT/EN** (estendibile): default per app (`generation_config.language`), override per generazione ("Genera ora"). Gemini produce TUTTO nella lingua; salvata nel `prompt_snapshot`.

---

## 2. Stack

Next.js 15 (App Router) · React 19 · TS strict · Tailwind + shadcn/ui · Supabase (Postgres + Storage + RLS + Realtime) · Gemini 2.5 Flash-Lite (grounding + responseSchema JSON) · Satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG) · @phosphor-icons/core · Remotion (video, Chromium headless) · GitHub Actions · pnpm workspace (monorepo). Node ≥ 22, pnpm 10.

---

## 3. Mappa dei file

### Root
- `package.json` — workspace; scripts `dev/build/start/lint/typecheck/gen`; `pnpm.overrides` forza una sola versione React.
- `pnpm-workspace.yaml` (`packages/*`) · `.npmrc` (hoist next/react/tailwind, `strict-peer-dependencies=false`).
- `tsconfig.json` — `moduleResolution: bundler`, `paths` (`@/*`, `@content-factory/*`), niente `baseUrl` (deprecato TS7). I package estendono questo.
- `next.config.mjs` — vedi §11. · `tailwind.config.ts` — token shadcn, `darkMode:["class"]`, animate (ESM). · `.env.example` (`.gitignore` esclude `.env*`).

### `app/` (Next App Router) — pagine `dynamic = "force-dynamic"`
- `layout.tsx` — root: `globals.css`, metadata, viewport+themeColor; `<html lang="it">`, dark default in `:root`.
- `globals.css` — tema (§9): `:root` soft-dark, `.light` soft-light, aloni indaco, scrollbar, safe-area.
- `(dashboard)/layout.tsx` — conta i `ready`, monta `DashboardShell`.
- `(dashboard)/page.tsx` — **Home** ("Nuova app" → `CreateAppDialog`, + "Genera ora").
- `apps/[slug]/page.tsx` + `app-editor.tsx` — **App detail**: Design System editing a click (font/mood/angoli + chip colori copia-incolla); config template grafico, orari multipli, lingua; **coda argomenti** con bottone **"Genera 5 con AI"** (`generateAppTopics` → accoda allo stato, salvi tu). Componenti: **`RealPreview`** (PNG reale debounced + selettore Editorial/Visual), **`PaletteImporter`** (HEX/JSON), **`MascotEditor`** (SVG + pos/size/opacity + "auto su tutte le slide"), **`useWebFonts`** (link Google Fonts), `DesignPreviewCss` (fallback).
- `review/page.tsx` + `review-queue.tsx` — **Review**: immagine drag-and-drop (`DragPositioner`) + overlay live (`SlidePreview editingImage`) + cache-bust (`bustCache`) + "Usa come sfondo"; **drag TESTO** (`TextPositioner` → `copy.pos`); `SlideMascotControls`; **`SocialPanel`** (kit social: copia/modifica/rigenera, "Scarica pacchetto"); selettore template **Editorial/Visual** (cambio live).
- `generate/page.tsx` + `generate-form.tsx` — **Genera ora** (selettore Lingua, default app).
- `history/page.tsx` + `history-table.tsx` — **Storico**.
- `api/*/route.ts` — 16 handler (§6; incl. `app/topics` = genera topic on-brand con AI).

### `components/`
- `ui/` — shadcn: button, card, input, textarea, label, badge (success/warning/info), separator, select, tabs, dialog, switch, `toast.tsx` (provider+stack auto-dismiss, no dep esterne; `useToast()`).
- `dashboard-nav.tsx` (sidebar/drawer responsive, badge coda, realtime) · `dashboard-shell.tsx` (`ToastProvider`+`useRealtime()`+nav).
- `status-badge.tsx` · `slide-preview.tsx` (dataUrl live → image_url → fallback CSS; `editingImage` = overlay live x/y/size) · `create-app-dialog.tsx` (→ `/api/app/create`) · `color-swatches.tsx`, `page-header.tsx`, `mock-banner.tsx`.

### `lib/`
- `data.ts` (**`server-only`**) — query: `getApps/getAppBySlug/getDesignSystem/getTemplates/getContentPieces(filter)/getContentPiece/getSlides/getContentWithRelations/getAppsWithStats/getRecentJobs/usingMockData`.
- `display.ts` — label/varianti badge, liste `ALL_*` (incl. `ALL_LANGUAGES/LANGUAGE_LABEL/LANGUAGE_FLAG`), `FORMAT_ASPECT`, `formatDate`, `createdByLabel`.
- `api-client.ts` — fetch client: `generateContent(language)`, `renderPreview(designOverride)`, `updateContentStatus`, `bulkUpdateStatus`, `archiveContent`, `saveSlideCopy/Image/Mascot`, `saveSocialKit/regenerateSocial`, `saveApp`, `createApp`, `saveDesignSystem`.
- `design-options.ts` — opzioni a click (client-safe): `FONT_CHOICES` (= `FONT_OPTIONS` di `fonts.ts`), `MOOD_CHOICES`, `RADIUS_CHOICES`, `CATEGORY_LABEL`. Separato per non importare il package render nei client.
- `utils.ts` — `cn()`.

### `hooks/use-realtime.ts`
Con chiavi Supabase sottoscrive `postgres_changes` (content_pieces/generation_jobs/slides) → `router.refresh()`; in mock fallback su focus + polling 15s. SDK lazy. Ritorna `{ realtime }`.

### `packages/core/src/` (`@content-factory/core`)
- `types.ts` — Row/Insert/Update + `Database` (stile supabase-js) + tipi jsonb (GenerationConfig, Research, PromptSnapshot, SlideCopy{+pos,+role,+iconName}, BgSource, SocialKit, TextPos, SlideRole, ContentLanguage…).
- `mock-data.ts` — seed in memoria (2 app FitTrack/BudgetWise, design system, 3 template, 1 carosello ready 3 slide + job). Stessi UUID/slug del SQL.
- `supabase.ts` — `getServerClient/getBrowserClient` (reale se chiavi, **mock** altrimenti = query builder + storage in memoria, store su `globalThis`). Helper `normalizeText`, `contentFingerprint`, `isSupabaseConfigured`, `getMockStore`, `resetMockStore`.
- `gemini.ts` — `runResearchStep` (passo 1 grounding+fonti, nella lingua), `runStructureStep` (passo 2 JSON: slide+kit social, `maxOutputTokens`, parse tollerante `parseSlidesJson`), `runGeminiPipeline`, `checkDuplicate`, `generateWithDedup`, **`generateTopics`** (auto-refill: N topic on-brand in una chiamata; prompt che NON nomina mai l'app, taglio editoriale, lingua rigorosa; `responseSchema {topics[]}`, `normalizeTopics`). responseSchema passo 2 include `iconName` (Phosphor kebab-case, ~20 esempi nel prompt; vuoto se astratta). **`strict`** (true se chiave presente): fallimento reale dopo retry → PROPAGATO, mai mock in produzione. `callGeminiWithRetry` (backoff+jitter su 503/429/500). **`callWithKeyRotation`** = rotazione multi-chiave (`geminiKeyPool` legge `GEMINI_API_KEY`/`_2`/`_3`/`_4`; su 429 di quota passa alla chiave successiva → quota free sommata tra account). **`throttleGemini`** (`GEMINI_MIN_INTERVAL_MS` def. 15s) = distanza minima tra chiamate reali per non prendere 429 inutili. Mock bilingue. SDK lazy.
- `pipeline.ts` — `runPipeline` (§5): **auto-refill `topics_queue`** (coda ≤ `TOPIC_REFILL_THRESHOLD=4` e automazione → `generateTopics(16)`, accoda e persiste subito; best-effort), **consumo topic** (`removeFromQueue`: il topic usato è RIMOSSO, non più riciclato in fondo), lock concorrenza, `render_hash` post-render.
- `render-cache.ts` — `renderHash({copyHash,templateName,format,bgEngine,mascotKey?})`: firma PNG per cache (skip ri-render se invariato; `mascotKey` busta).
- `index.ts` ri-esporta pipeline + render-cache.

### `packages/render/src/` (`@content-factory/render`)
- `render.ts` — `renderSlide` (LAYER1 + immagine custom + mascotte + LAYER2 Satori→SVG→resvg→PNG; **throws** se satori/resvg assenti) + `renderCarousel`. Template via `templateName` (registry), passa `language`/`total`, ombra testo, immagine custom tra sfondo e testo. **`asBackground`** → immagine = LAYER 1 a piena slide + velo (`overlay`), ignora size/x/y. **Mascotte:** la posa è risolta una volta (`templateMascotSvg` da `mascot.poses[copy.mascotPose]` con fallback `svg`) e PASSATA AL TEMPLATE (`mascotSvg` prop) → il template la disegna in posizione RELATIVA al testo (sopra intro/cta, watermark teaching). `buildMascotTag` (LAYER 1.6) resta solo come fallback per override di posizione MANUALE (`slide.mascot.x/y`). Icone Phosphor composte dal template, non qui. Import lazy.
- `icon-loader.ts` — `loadPhosphorIcon({name,weight?,color})`: risolve l'SVG via `require.resolve` sui subpath degli `exports` (`@phosphor-icons/core/assets/<weight>/<name>-<weight>.svg` — NB `./package.json` NON è negli exports → risolvere ogni file). Applica colori brand (`fill="currentColor"` root + `fill` su ogni path, mantiene `opacity=0.2` duotone) → data-URI. Fuzzy alias estesi (`salmon`→`fish`, `person-calm`/`meditate`/`mindful`→`flower-lotus`, `breathe`→`wind`, `emotion`→`smiley`…). **`null` se non esiste** (nessun fallback). Cache per (name|weight). ~1.500 icone × 6 pesi.
- `fonts.ts` — font loader REALE con cache singleton (globalThis): `.ttf` da `public/fonts/` → Google Fonts CDN → ArrayBuffer (mai vuoto). `loadFromGoogle` accetta ttf/otf/woff (non woff2), multi-UA. **`resolveFamily(name, role)`** — fallback per ruolo: `heading`→**Inter**, `body`→**Lora** (serif elegante = contrasto premium col titolo sans). `GOOGLE_FONTS` include Lora/Source Serif 4. `FONT_OPTIONS` per la UI. I template chiedono il nome-famiglia **risolto** (`resolveFamily(fonts.heading,"heading")` / `(fonts.body,"body")`). **Inter 400/500/700/800** + **Lora 400/500/600/700** committati in `public/fonts/` (Lora = corpo serif, anche per il video offline; script `scripts/noit-mascot/fetch-lora.mts`).
- `backgrounds/designed.ts` — sfondo premium: mesh gradient 4 blob seedati, grana `feTurbulence`, vignettatura, light source DIREZIONALE che alterna lato, glow accento opposto, firma cromatica per-slide (`rotateHue` ±12°). Accenti dal mood. **NB**: rimossi i due accenti geometrici (il `<rect>` "firma brand" in alto-sx e l'`accentBar` in basso) — confliggevano coi nuovi elementi dei template (barra progresso, linea gradient, @handle) sembrando duplicati. · `ai.ts` (Imagen o placeholder), `stock.ts` (Unsplash/Pexels o placeholder).
- **2 template** (Satori, 4:5/1:1/9:16; `minimal.tsx`/`bold.tsx` ELIMINATI). **`visual` = `editorial` + ICONE**: stesso codice/layout, `visual` in più disegna l'icona Phosphor (chip + watermark). Caratteristiche condivise (sistema a ruoli + restyling 2026):
  - **Layout CENTRATO** (titolo H+V) su tutte le slide; keyword evidenziata col box accent (`splitKeyword`).
  - **Numerazione SOLO-TEACHING**: intro=copertina, cta=chiusura, le teaching contano `total-2` → "01/04". Barra progresso + numero discreto "NN / TT" (no pillola): SOLO teaching.
  - **`intro`**: keyword GIGANTE (×1.5) col box, titolo leggermente OBLIQUO (`rotate(-3deg)`), watermark icona grande centrato dietro; "Swipe →" a sx + `@handle` a dx sulla stessa riga in basso. Solo titolo (niente corpo).
  - **`teaching`**: chip icona + watermark centro-destra + numero gigante in trasparenza che alterna lato + linea gradient accent sotto il titolo + corpo breve (Lora). Barra progresso in alto.
  - **`cta`**: banda accent DIAGONALE (`rotate(-8deg)`) dietro al titolo; pillola CTA subito SOTTO il titolo (non in fondo); eyebrow "IN SUMMARY". Nessuna icona. **CTA fallback**: se `copy.cta` manca, usa "Scopri di più"/"Learn more" (la slide finale ha SEMPRE un bottone).
  - **`@handle`** = `@<nome app>` (lowercase, no spazi) in basso a destra su TUTTE le slide → riflette il nome app (rinominabile da dashboard).
  - Entrambi leggono `copy.role` (Gemini o dedotto), `copy.pos` (drag), `language`, `total`. Freccia "→" in SVG. **NB Satori**: mai `undefined` nei valori di stile → spread condizionale.
  - **Icone `visual`** via `loadPhosphorIcon(copy.iconName)`; manca → niente icona (layout si adatta).
  - **Mascotte nel template** (`mascotSvg` prop, da render.ts): disegnata in posizione RELATIVA al testo come `<img>` data-URI — **intro/cta** sopra il blocco testo (size altezza `width*0.27`); **teaching** watermark a sinistra (`width*0.34`, opacity ~0.06). **`mascotViewBoxAspect(svg)`** legge h/w dal viewBox → l'`<img>` rispetta le proporzioni native (no squash; bug risolto: prima `height` fissa schiacciava le mascotte alte tipo Stoppy 224×380). `onAccent` (`isLight(accent)?scuro:bianco`) per il testo su keyword box/eyebrow/CTA → leggibile con qualsiasi accento.
  - `templates/registry.ts` — template come DATO: `{editorial, visual}`, `resolveTemplate` (minimal/bold storici → editorial), `TEMPLATE_NAMES`, default **`editorial`**; contiene `DIMS`. Aggiungere layout = importarlo qui, senza toccare `render.ts`.
  - **`templates/visual-tokens.ts`** — UNICA fonte di verità del DESIGN "visual", condivisa PNG↔VIDEO: `isLight`/`shade`/`onAccentColor`, `resolveRole`, `splitKeyword`, `mascotViewBoxAspect`, **`visualMetrics(format,role)`** (tutte le misure tipografiche/layout come frazioni di width/height) + `visualLabels` + **`accentFill`/`onAccentFillColor`/`wantsAccentGradient`** (accent a GRADIENTE rosa→blu per le app con `style_tokens.accentGradient`, es. M&M — vedi §14). Modulo PURO (niente React/fs) → importabile sia da `visual.tsx` (Satori/Node) sia dal bundle Remotion (Chromium). `visual.tsx` lo importa (niente più funzioni duplicate); il video importa il sottopath `@content-factory/render/templates/visual-tokens.js` (NON il barrel, per non tirare dentro resvg/satori). Se cambia il design qui, PNG e video cambiano INSIEME. `package.json` espone `"./*.js"` oltre a `"./*"` perché l'exports field non applica l'extensionAlias.

### `packages/video/src/` (`@content-factory/video`)
- `render-video.ts` — `renderCarouselVideo` (bundle→selectComposition→renderMedia h264; fallback mock mp4 se Remotion/Chromium assenti). Riceve `templateName`+`language`. Pre-carica TUTTO lato Node (il bundle gira in Chromium, niente `fs`/satori/resvg) → `inputProps`: **`preloadIcons`** (per `visual`, `loadPhosphorIcon`→`{dataUri, svg inline, nome risolto}` per slide → il video anima l'INTERNO dell'icona per famiglia), **`preloadMascots`** (`{a, b, sparkle}` per slide: posa Gemini `a` + "compagna" coerente `b` da `POSE_COMPANION` per il cambio posa nella slide + overlay sparkle se presente → data-URI/SVG), **`preloadBackgrounds`** (il VERO `generateDesignedBackground` del PNG → resvg→PNG→data-URI per slide, `seed` per-slide = stessa firma cromatica del carosello), **`loadFontFaceCss`** (Inter+Lora `.ttf`→base64→blocco `@font-face`). `bundle()` usa **`webpackOverride`** con `extensionAlias .js→.tsx` (webpack standalone non legge next.config); entryPoint via `fileURLToPath` (su Windows `.pathname` rotto).
- `Root.tsx` (`RemotionRoot`, `FPS`) — registra "Carousel" + **`registerRoot(RemotionRoot)`** in fondo (indispensabile per `bundle()`).
- `compositions/Carousel.tsx` (`CarouselVideo`, `VIDEO_DIMS`, `DEFAULT_FRAMES_PER_SLIDE=105`) — **il PNG `visual.tsx` SCOMPOSTO IN LIVELLI ANIMATI** (Opzione C, non più un design separato): stessa fonte di verità del design via `@content-factory/render/templates/visual-tokens.js` (colori derivati, metriche tipografiche per ruolo/formato, `splitKeyword`), **sfondo reale** `designed.ts` (`props.bgImages[]`) animato Ken Burns, **font reali** Inter/Lora embeddati (`props.fontCss` `@font-face`). Ogni elemento si anima da solo: titolo **parola-per-parola** (`TitleWordByWord`, stagger) col **respiro** continuo + **glow** della keyword all'arrivo, keyword box pop elastico, mascotte float/breathe (`props.mascots[]`), icone pulse/rotate (`props.icons[]`), banda CTA che entra, barra progresso che si riempie, numero gigante parallax, **pillola CTA con glow pulsante** (chiusura d'impatto). `templateName="visual"`→icone (mai su cta). Import lazy.
  - **Durate per-RUOLO** (`slideDurationFrames`/`slideTimeline`): intro **75fr (2.5s)**, teaching/cta **105fr (3.5s)** → le `Sequence` non sono equidistanti; la durata totale è la SOMMA (non count×perSlide) — riusata in `render-video.ts` e `Root.tsx` (`calculateMetadata`).
  - **Transizione fra slide** (`sceneIn`/`sceneOut`→`sceneOpacity`+`sceneShift`): lo **sfondo è OPACO da frame 0** (copre il nero); TUTTO il contenuto sta in un wrapper che fa reveal d'ingresso + lift d'uscita → cross-dissolve fluido. **Fix lampo iniziale**: prima il footer "Swipe →"/`@handle` aveva solo l'opacità d'uscita → appariva su nero nei primi ms; ora eredita il reveal dal wrapper. **Parallax**: lo sfondo deriva meno del contenuto (`parX` opposto).
  - **Effetti "wow"**: **punch zoom** SOLO sull'intro (`introPunch`); **keyword/CTA shimmer PRONUNCIATO** (`shimmerBg`: banda di luce stretta e brillante che attraversa il box accent = luccichio metallico netto); **icone con l'INTERNO animato** (`AnimatedIcon`: SVG INLINE — non `<img>` — animato per **famiglia di movimento** dal nome, `iconMotionFamily`: spin/tick/beat/pulse/ring/arrow/wobble/float → copre TUTTE le Phosphor; orologio=lancetta che scatta, cuore=battito…); **watermark icona anche su TEACHING** (centro-destra tenue, come PNG — prima era solo sull'intro), animato.
  - **Corpo (teaching) parola-per-parola** (`BodyWordByWord`, stagger 2fr) come il titolo — niente più blocco unico.
  - **Mascotte: 2 pose per slide con CROSS-FADE** (`VideoMascot{a,b,sparkle}`): parte con la posa Gemini `a`, a ~55% della slide vira sulla "compagna" coerente `b` (`POSE_COMPANION` in render-video → coppie tra pose VISIVAMENTE distinte: alcune mascotte hanno pose identiche, es. noit `thinking===curious`, che davano "nessun cambio" → coppie scelte per garantire il cambio; se `b` risolve allo stesso SVG → `b=null`, mai glitch). Media ~2 pose/slide. Disattivabile (`mascot.poseSwap=false`). Niente più squash blink (rimbalzava tutta la figura).
  - **Sparkle orbitanti** (solo mascotte che le hanno nell'app, es. **noit**): overlay SVG `mascot.sparkleSvg`+`mascot.sparkle=true` nel design system (3 stelle dal codice `noit-skia.tsx`), inline nel video e animate a **twinkle** (pulse/scale sfasati per stella). Le altre mascotte: nessuno sparkle.
  - **Verificato** (render reale stoppy/noit/poof/divinai): frame 0 = solo sfondo, punch intro, shimmer netto, icona interna in movimento, watermark teaching, corpo word-by-word, cambio posa visibile su tutte, stelle attorno a noit.

### `packages/db/migrations/`
`0001` extensions (pgcrypto, pg_trgm) · `0002` schema (6 tabelle + indici + trigger + CHECK) · `0003` RLS (service role bypassa) · `0004` storage (bucket privati `content-images`/`content-videos`) · `0005` seed (opz.) · `0006` `slides.image` jsonb · `0007` `content_pieces.template_name` · `0008` `slides.render_hash` (cache) · `0009` `slides.mascot` jsonb (mascotte app vive in `design_systems.style_tokens.mascot`) · `0010` `content_pieces.social` jsonb. NB: `copy.pos`/`copy.role`/`copy.iconName` e `generation_config.language` vivono nei jsonb esistenti → nessuna migration.

### `scripts/`
- `run-generation.ts` — entrypoint CI + `pnpm gen`. Args `--app --topic --kind --format --count --trigger`. Senza args = cron (per app legge `generation_config`, chiama `runPipeline`). Riepilogo ok / saltati (lock) / falliti; exit 1 se qualcosa **fallisce** (skipped no).
- **Script di gestione/diagnosi DB** (sola REST, nessuna migration; lanciare con `node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/<file>`): `inspect-config.ts` (stampa `generation_config`+`topics_queue`+brand di ogni app + stima minuti CI), `set-video-config.ts` (imposta `videos_per_run`/`carousels_per_run` su tutte), `enrich-descriptions.ts` (descrizioni app arricchite), `test-refill.ts <slug>` (prova `generateTopics` su un'app, sola lettura).
- `*.sql` (SQL Editor Supabase): `diagnose.sql`, `make-buckets-public.sql` (bucket pubblici + policy public-read), `cleanup-zombie.sql` (rimuove content_pieces `generating` senza PNG).

### `.github/workflows/`
`generate-scheduled.yml` (**1 cron mattutino `0 6 * * *`** = 08:00 estate / 07:00 inverno; 1 run/giorno per risparmiare il setup runner + diversificare; il `pnpm/action-setup` NON pinna `version` → la prende da `packageManager` in package.json) · `generate-dispatch.yml` (**workflow_dispatch** = trigger MANUALE on-demand: input `app/topic/kind(carousel|video|both)/format/count` → `run-generation.ts`; è il modo per generare un **video a mano** dai runner CI: Actions → "Generate (dispatch)" → Run workflow) · `keep-alive.yml` (heartbeat settimanale anti-sospensione 60gg). **NB: il cron del `.yml` è l'UNICO trigger orario; l'orario in dashboard (`generation_config.times`) NON fa partire nulla (GitHub non legge il DB).**

---

## 4. Modello dati — `packages/core/src/types.ts`

Multi-tenant, tutto legato a `app_id`.
- **apps** — `name, slug, description, target_audience, tone_of_voice, topics_queue(string[]), generation_config(jsonb: frequency, time, times(string[] = più orari/giorno), carousels_per_run, videos_per_run, slides_per_carousel, formats[], language('it'|'en', default app), bg_engine, template, model_research, model_structure)`.
- **design_systems** — `colors{primary,secondary,bg,text,accent}, fonts{heading,body}, logo_url, style_tokens{radius,mood,mascot?,…}, is_default`. **`mascot`** (`Mascot`): `{svg, poses?, size?, x?, y?, opacity?, autoAll?}` — SVG riusabile, auto su tutte le slide di default (`autoAll`). **`poses`** (`Record<string,string>` nome→SVG): pose alternative della mascotte (es. `idle/happy/eating/wink/curious/thinking/listening/excited/eyes_closed`); il render usa `poses[copy.mascotPose]` se presente, altrimenti `svg` (posa di default).
- **templates** — `name, slot_schema, engine:'satori'`, globali o per app.
- **content_pieces** — `topic, kind('carousel'|'video'|'both'), format('4:5'|'1:1'|'9:16'), status, research(jsonb; fonti con `status?:'ok'|'dead'|'unknown'` da "Verifica fonti"), bg_engine, template_name, social(jsonb), video_url, content_fingerprint, topic_norm, archived_at, prompt_snapshot(incl. language), created_by`. **`social`** (`SocialKit`): `{caption, hashtags[], firstComment, altTexts[], bestTime}` — `bestTime` deterministico (orari app), il resto da Gemini.
- **slides** — `position, copy{titolo,corpo,cta,step,pos?,role?,iconName?,mascotPose?}, copy_hash, render_hash, bg_source, image{url,size(0..1),x,y,fit,radius,opacity,asBackground?,overlay?}, mascot, image_url`.
  - **`image`** NON entra in `content_fingerprint` (anti-dup = solo testo) ma SÌ in `copy_hash` → cambiarla forza il ri-render.
  - **`render_hash`** = `copy_hash`+template+format+bg+mascotKey: invariato + `image_url` presente → cache (salta ri-render).
  - **`mascot`** (`SlideMascot`): `{enabled?, size?, x?, y?, opacity?}` override per-slide (`enabled:false` nasconde; `null` = default app).
  - **`copy.pos`** (`TextPos` `{x,y}` 0..1): drag in review. In `copy_hash`, non nel fingerprint.
  - **`copy.role`** (`SlideRole`: `intro|teaching|comparison|cta`): da Gemini o dedotto (1ª=intro, ultima=cta, resto=teaching). Guida i micro-layout; NON in fingerprint/copy_hash.
  - **`copy.iconName`** (string, kebab-case): solo template `visual` (assente/non trovata → nessuna icona). NON in fingerprint; **SÌ in `copy_hash`** → cambiare icona busta la cache render (corretto un bug per cui i PNG senza icona restavano congelati).
  - **`copy.mascotPose`** (string, enum 9 pose): posa/espressione della mascotte coerente col TONO della slide, scelta da Gemini (`happy/excited` positive, `curious/thinking` domande, `wink` consigli, `eyes_closed` calma, `eating` solo cibo, `idle` neutro). Il render risolve l'SVG da `mascot.poses[mascotPose]` (fallback `svg`). NON in fingerprint; **SÌ in `copy_hash`**.
- **generation_jobs** — `trigger, status, attempts, next_retry_at, logs, error`.

`status`: `draft → generating → ready → approved/rejected → published/archived`.

---

## 5. Pipeline — `runPipeline` (frontend + CI, UNICA)

0. **Lock concorrenza** (solo `trigger=cron`): app con job `running` recente (≤15min) → `skipped` (on-demand procede sempre).
1. Crea `generation_job` (running).
2. Carica app+design system, pesca topic, risolve lingua (`input.language` → `cfg.language` → 'it').
3. Gemini passo 1 (ricerca+fonti) → passo 2 (JSON slide + kit social).
3c. Anti-duplicato (`content_fingerprint`) → "salta e rigenera".
4. Insert `content_piece` (+`template_name`, +`social` con `bestTime` deterministico, +`prompt_snapshot` con language) + `slides` (generating).
4b. **Ruota `topics_queue`** (se topic dalla queue: usato in fondo → cron pesca il successivo).
5/6. Render PNG 2 layer (template dal registry + font reali + ombra + immagine custom; `visual` carica icone da `copy.iconName`) → upload `content-images` → `image_url` + `render_hash`.
6b. Se video|both: Remotion (`templateName`+`language`; pre-carica icone se `visual`) → `content-videos` → `video_url`.
7. Status `ready` (Realtime aggiorna). Errore → job `failed` + `next_retry_at` (+15min).

**Gemini passo 2:** `responseSchema` → `{slides[], social}`; slide = `titolo/corpo/cta/role/altText/iconName`. **`maxOutputTokens`** (~600/slide, max 8192) evita troncamenti. **`parseSlidesJson`** recupera le slide complete bilanciando le graffe se l'output è troncato. Mock rispetta la lingua.

---

## 6. API routes (POST JSON; `getServerClient` reale/mock)

- `/api/generate` `{appId, topic?, kind?, format?, bgEngine?, language?, carousels?, videos?}` → `runPipeline` N volte → `{ok, isMock, created[]}`.
- `/api/render` `{copy, format, bgEngine, appId, slideId?, position?, templateName?, language?, image?, designOverride?}` → `{ok, isMock, dataUrl|null, note?}` (lazy; null → fallback CSS). **`designOverride`** `{colors?, fonts?, style_tokens?}` = modifiche non salvate fuse sopra al design system (anteprima live). `templateName` `editorial|visual`.
- `/api/content/status` `{contentPieceId, status}` (approved|rejected|published|ready).
- `/api/content/bulk` `{contentPieceIds[], status}` (approved|rejected).
- `/api/content/archive` `{contentPieceId}` → archiviazione leggera (`archive/archive-one.ts` `archiveContentPiece`, riusata dal bulk).
- `/api/content/bulk-archive` `{contentPieceIds[]}`.
- `/api/content/template` `{contentPieceId, templateName}` → cambia template + ri-render sullo stesso copy (no Gemini); cache `render_hash` salta le slide invariate con `image_url`.
- `/api/content/variant` `{contentPieceId, format?, templateName?}` → variante (stesso copy, no Gemini): nuovo content_piece `ready` (eredita fingerprint/research) + slide clonate + PNG nel nuovo formato/template. Richiede che format o template cambi.
- `/api/content/validate-sources` `{contentPieceId}` → HEAD (fallback GET) su ogni `research.sources[].uri`, marca `status:'ok'|'dead'|'unknown'`, persiste.
- `/api/content/social` — `{contentPieceId, social}` SALVA (hashtag max 5); `{contentPieceId, regenerate:true}` RIGENERA con Gemini riusando la `research` esistente, nella lingua (`prompt_snapshot.language`), `bestTime` preservato. → `{ok, social, isMock?}`.
- `/api/slide/upload` (multipart `{file, appSlug?}`) → valida MIME/peso (png/jpeg/webp, ≤8MB), upload `content-images/uploads/` → `{ok, url, path}`.
- `/api/slide/save` `{slideId, copy?, image?, mascot?}` → +copy_hash, ri-render (lazy) + render_hash (incl. mascotKey). Ogni campo opzionale; `image:null` rimuove, `mascot.enabled:false` nasconde.
- `/api/app/create` `{name, description?, target_audience?, tone_of_voice?}` → app (slug univoco) + design system default → `{ok, slug, appId}`.
- `/api/app/save` `{appId, name?, description?, target_audience?, tone_of_voice?, topics_queue?, generation_config?}`. **`name`** = rinomina app (si riflette come `@handle` nelle slide); lo `slug` resta invariato (identità tecnica: URL pagina + path PNG su Storage). Campo "Nome app" nell'editor.
- `/api/app/topics` `{appId, count?, avoid?}` → `{ok, topics, isMock}`. Genera `count` (default 5) topic on-brand con `generateTopics` (Gemini), **senza salvarli**: l'editor li accoda allo stato locale (riordinabili/rimovibili), persistiti col pulsante "Salva". Bottone "Genera 5 con AI" nella Card "Coda argomenti".
- `/api/design/save` `{designSystemId, colors?, fonts?, style_tokens?}`.

---

## 7. Mock vs reale

Senza `.env.local` **tutto gira su dati finti realistici**, con le STESSE funzioni: `supabase.ts` store in memoria, `gemini.ts` copy/fonti finte, sfondi `ai`/`stock` placeholder. Con le chiavi gli stessi client passano ai servizi reali — **mai rami "se mock" nella logica**. PNG reali servono Satori/resvg installati (incluso binario nativo Windows `@resvg/resvg-js-win32-x64-msvc`); altrimenti preview = fallback CSS e `slide/save` salva comunque il testo. **Bucket Storage pubblici** (§12); DB protetto da RLS.

---

## 8. Convenzioni e regole IMPORTANTI

- **Una sola pipeline** (`runPipeline`): mai duplicarla.
- **Import lazy** di satori/resvg/remotion: SEMPRE `await import(...)` in try/catch.
- **Store mock** su `globalThis` (non `let` di modulo) → condiviso RSC↔route handler.
- **`lib/data.ts` è `server-only`**: i client lo importano solo `import type`; mutazioni via `api-client.ts` → `/api/*`.
- **Mock**: niente join SQL (solo select/insert/update/delete + eq/neq/in/is/order/limit/single/maybeSingle → aggrega in JS). `.insert/update/delete().select()` = "ritorna la riga mutata": `select()` è **no-op sulla modalità** (non deve declassare una mutazione pendente a query — bug storico: ritornava la prima riga del seed).
- **Pagine** `dynamic = "force-dynamic"`.
- **Anti-duplicato**: fingerprint testo → "salta e rigenera". **Archivio leggero**: rimuove media, conserva `prompt_snapshot`+fingerprint, status `archived`.
- **`topics_queue`** si auto-consuma solo se il topic veniva dalla queue (`input.topic` assente). On-demand non la tocca.
- **Cache render = `render_hash`** (non solo `copy_hash`): firma include template+format+bg. Chi ri-renderizza salva sempre `render_hash`; chi può saltare confronta firma + `image_url`. **`hashCopy` include `iconName` e `copy.pos`** (oltre a titolo/corpo/cta/step) → cambiare icona o trascinare il testo busta la cache (prima `iconName` ne era fuori → PNG senza icona restava congelato: bug risolto).
- **Lock concorrenza** best-effort: solo `cron` salta (≤15min, ignora zombie). On-demand → `skipped` mai.
- **Select Radix**: nessun `SelectItem value=""` (crasha); "tutti" usa `"__all__"`.
- **React keys**: in mock id ripetibili → key composta `${id}-${i}`.
- **Icone `visual`**: SOLO Phosphor reali, MAI SVG da AI. Gemini sceglie il nome (`copy.iconName`); inesistente → niente icona.
- **Mascotte multi-app**: ogni app ha mascotte + pose proprie in `style_tokens.mascot.{svg,poses}` (estratte dal codice sorgente dell'app, NON immagini AI). Gemini sceglie la posa per slide (`copy.mascotPose`); `iconName`+`mascotPose`+`pos` entrano in `copy_hash` (bustano la cache render). Le mascotte rispettano l'aspect-ratio del viewBox (no squash).
- **Remotion** gira in Chromium → niente `fs` nel componente: carica risorse LATO NODE prima del bundle (icone, mascotte, [TODO] sfondo+font), passa via `inputProps`. `bundle()` richiede `webpackOverride` (`extensionAlias .js→.tsx`), `registerRoot()`, `fileURLToPath` (Windows).
- **Satori**: mai `undefined` come valore di stile (`.trim()` crasha) → spread condizionale.
- Chiavi MAI nel codice (`.env*` in `.gitignore`; CI/Vercel = Secrets/Env Vars).

---

## 9. Tema / UI

- **Default soft dark** (`:root`): sfondo `#0f1117`, testo off-white, accento indaco `#6366f1`. Chiara = `.light`. Token HSL shadcn.
- Sfondo non piatto (aloni indaco), card translucide (`bg-card/80 backdrop-blur`), scrollbar discrete.
- **Mobile**: sidebar→drawer sotto `md`; `env(safe-area-inset-*)`; input `text-base` (no zoom iOS) + `sm:text-sm`; tap target generosi; filtri/azioni full-width su schermo stretto; tab app distribuite; `themeColor`.

---

## 10. Comandi & Env

| Comando | Uso |
|---|---|
| `pnpm install` | installa il workspace |
| `pnpm dev` | dashboard dev → localhost:3000 |
| `pnpm build`/`start` | build prod / servirla (start richiede build) |
| `pnpm lint`/`typecheck` | ESLint / `tsc --noEmit` |
| `pnpm gen [--app --topic --kind --format --count]` | pipeline (CI+locale) |

Env (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY` (+ opz. `GEMINI_API_KEY_2`/`_3` = chiavi extra per la rotazione/quota, `GEMINI_MIN_INTERVAL_MS` = throttle, `GEMINI_MODEL_*`, `UNSPLASH_KEY`/`PEXELS_KEY`). Chiavi multiple = nomi DISTINTI (righe con lo stesso nome si sovrascrivono). Formato chiavi 2026: `AQ.…` o `AIzaSy…`, entrambi validi.

---

## 11. Config build (`next.config.mjs`) — gotcha risolti

- `transpilePackages` per i 3 package monorepo (TS puro).
- `serverExternalPackages` per resvg/satori/remotion.
- `webpack.resolve.extensionAlias` `.js`→`.ts`/`.tsx`: i package importano con `.js` (corretto ESM/CI) ma su disco sono `.ts`. **Non rinominare in `.ts`.**
- `webpack.externals` (solo server) per resvg/satori/remotion → l'`import()` lazy lo risolve Node a runtime (no bundle dei `.node`).
- `tailwind.config.ts` ESM → plugin con `import`, MAI `require()` (`ReferenceError`).
- **Font Satori**: i template chiedono il nome-famiglia di `resolveFamily`, lo stesso con cui `fonts.ts` registra i `.ttf`. CI offline → `public/fonts/<Famiglia>-<peso>.ttf`.
- **`webpack.ignoreWarnings`** per `icon-loader.ts`: il `require.resolve(subpath)` con subpath costruito a runtime (asset SVG Phosphor lato Node) genera *"Critical dependency: the request of a dependency is an expression"* — warning benigno, silenziato SOLO su quel file.

---

## 12. Deploy & automazione

- **Supabase**: progetto, migration **0001→0010**, URL+anon+service key. **Rendi pubblici i bucket** (`scripts/make-buckets-public.sql`): servono al renderer e i PNG vanno sui social (DB protetto da RLS).
- **Vercel**: import repo, env vars, deploy. Render PNG/`generate` nelle serverless; render **video** per i runner CI.
- **GitHub** (repo PRIVATO **`Gestionalefracchiolladaniele/content-factory`**): push, Secrets (stesse env), Actions. `generate-scheduled` (1 cron mattutino), `generate-dispatch` (on-demand), `keep-alive`. I Secrets sono cifrati e mascherati nei log; `.env.local` MAI committato (`.gitignore` esclude `.env*`). **Mai far leggere le chiavi all'assistente** (finirebbero nella chat); copiarle da `.env.local` ai Secrets direttamente.
- Capacità (ARCHITECTURE §6): solo PNG/giorno rientra nei 2.000 min privati; video ogni giorno → repo pubblico o Remotion Lambda.

---

## 13. Troubleshooting

- *"Could not find a production build"* su `pnpm start` → usa `pnpm dev` (o `pnpm build` prima).
- *"Can't resolve './x.js'"* → manca/rotto `extensionAlias`.
- *"Unexpected character … .node"* → manca un pacchetto negli `externals` server.
- Warning peer deps (React 19) → attesi, non bloccano.
- `baseUrl deprecated` nell'editor → riavvia TS Server.
- *"two children with the same key"* in Genera ora → id mock ripetuti → key `${id}-${i}` (§8).
- Generazioni assenti in Review/Storico (mock) → bug `.insert().select()` (risolto rendendo `select()` no-op).
- Mutazioni mock non riflesse → store su `globalThis`.
- **Slide senza PNG** (`image_url`/`render_hash` null, "0 slide") → satori/resvg non installati o render in errore. `pipeline.ts` logga `[pipeline] RENDER FALLITO`. Reinstalla nel package render (incl. binario nativo resvg). Diagnosi: `scripts/diagnose.sql`.
- *"No fonts are loaded"* → font non recuperati. Verifica `public/fonts/Inter-{400,500,700,800}.ttf` (il loader accetta ttf/otf/woff).
- **Immagine custom non appare** → bucket privato: `scripts/make-buckets-public.sql`. `slide/save` logga `[slide/save] render fallito`.

---

## 14. Stato & note

Tutti i 7 blocchi di costruzione completati (PROGRESS.md; storico dettagliato delle sessioni in ARCHITECTURE §12). **App operativa su dati reali** (Supabase + Gemini collegati, app test "noit"). Niente pagina auth (uso singolo → Deployment Protection di Vercel). `@google/generative-ai` deprecato ma ancora usato (migrazione a `@google/genai` = enhancement futuro). Note aperte in ARCHITECTURE §11 (pubblicazione social automatica, font custom, fallback Puppeteer).

**Migration da applicare ora: 0010** (Visual + video non richiedono migration). typecheck + lint puliti.

Stato attuale (frutto di ricerche caroselli/icone/caption 2026):
- Template `editorial` (TESTO) + `visual` (= editorial + icone Phosphor); `minimal`/`bold` eliminati.
- Font reali in Satori; sfondi premium (mesh + grana + luce direzionale + firma per-slide); ombra testo.
- Immagini custom per slide (size/pos/fit + "usa come sfondo"); drag immagine e testo in review; mascotte SVG (app + override per-slide).
- Cache render (`render_hash`); varianti; rigenera da ricetta; bulk reject/archive; validazione fonti; lock concorrenza; rotazione `topics_queue`.
- Kit social (caption + hashtag nicchia + primo commento + altText + orario); lingua IT/EN.
- Video Remotion reale (icone + **mascotte** animate, pre-caricate lato Node); 3 bug Remotion preesistenti risolti (entryPoint Windows, `registerRoot`, `webpackOverride`).
- Creazione app da dashboard; editing Design System family-friendly (a click + chip colori + preview PNG reale); orari multipli (cron 3 fasce).

**Restyling template 2026 (sessione corrente):** entrambi i template riprogettati con un layout coerente e d'impatto, frutto di ricerca caroselli ad alto rendimento 2026 (tipografia oversize, color-blocking, gerarchia forte).
- `visual` riscritto come `editorial` + icone → un solo layout, una sola fonte di verità; editorial allineato.
- **Layout CENTRATO** ovunque; keyword col box accent; **intro** keyword gigante (×1.5) + obliqua + watermark icona grande centrato + "Swipe →"/`@handle` sulla stessa riga; **cta** banda diagonale + pillola sotto il titolo + fallback CTA; **teaching** chip + watermark + numero gigante + linea gradient + corpo breve.
- **Numerazione SOLO-teaching** (01/04); barra progresso + numero discreto (no pillola "NN/TT"); rimossa la pillola eyebrow su teaching.
- **`@<nome app>`** in basso a destra su tutte le slide; **rinomina app** da dashboard (`/api/app/save` con `name`, slug invariato).
- **Corpo = Lora** (serif, `DEFAULT_BODY_FAMILY`; `resolveFamily(name, role)`); titolo = Inter. Corpo breve (prompt Gemini: 1 frase max ~14 parole).
- **Fix cache**: `iconName`+`pos` in `hashCopy` (icone non più "congelate"). **Alias icone estesi** (es. `person-calm`→`flower-lotus`).
- Rimossi gli accenti geometrici dello sfondo `designed` (rect "firma brand" alto-sx + accentBar basso); ombra testo più leggera; rimossa la barretta duplicata nel fallback CSS di `slide-preview.tsx`. `webpack.ignoreWarnings` per il warning benigno di `icon-loader`.

**Mascotte multi-app + pose via Gemini (sessione corrente):** 4 app nel DB con mascotte propria estratta dal codice sorgente dell'app (traduzione Skia/react-native-svg → SVG statici, 9 pose; verificate a video con resvg). Gemini sceglie la posa per slide.
- App: **noit** (axolotl viola), **stoppy** (panda verde, da `stopfap/src/components/stoppy-skia.tsx`), **poof** (sigaretta oro/ambra, da `stopsmoke/.../Poof.tsx`), **divinai** (orbo mistico oro/viola, da `caromanzia-initial-setup/.../DivineMascot.tsx` — astratto, 4 varianti d'orbo mappate sulle pose). Tutte template `visual`, colori brand autentici dei rispettivi CLAUDE.md, sfondo scuro+alone (il bg dev'essere SCURO perché il gradiente `designed` "respiri").
- `SlideCopy.mascotPose` + `Mascot.poses` (types.ts); `gemini.ts` schema+prompt+parser (`normalizeMascotPose`, enum 9 pose) + intro riceve `iconName`; `pipeline.ts` `hashCopy` include `mascotPose`; `render.ts` risolve la posa e la passa al template (`mascotSvg`); `visual.tsx` la disegna relativa al testo + `mascotViewBoxAspect` (no squash) + `onAccent`.
- **Video**: `render-video.ts` `preloadMascots` + `Carousel.tsx` la disegna animata. Script generatori pose: `scripts/noit-mascot/build-*.mjs`; preview PNG `preview-app.mts`, preview video `preview-video.mts`. Tutto via API REST (nessuna migration).

**Video riallineato al PNG (Opzione C, sessione corrente):** il video NON è più un design separato — è il PNG `visual.tsx` **scomposto in livelli animati**, con UNA sola fonte di verità per il design.
- **Modulo condiviso** `packages/render/src/templates/visual-tokens.ts` (puro, no React/fs): colori derivati, `visualMetrics(format,role)` con tutte le misure tipografiche/layout, `splitKeyword`, `mascotViewBoxAspect`. Importato da `visual.tsx` (Satori) E da `Carousel.tsx` (Remotion, via sottopath `@content-factory/render/templates/visual-tokens.js`). `render/package.json` aggiunge `"./*.js"` agli exports.
- **Sfondo identico**: `render-video.ts` `preloadBackgrounds` chiama il VERO `generateDesignedBackground` → resvg→PNG→data-URI per slide (`seed` per-slide = stessa firma cromatica), passato come `inputProps.bgImages`; `Carousel.tsx` lo anima Ken Burns. **Font reali**: `loadFontFaceCss` (Inter+Lora `.ttf`→base64) → `inputProps.fontCss` (`@font-face` iniettato; Chromium non ha i font di sistema). `@resvg/resvg-js` aggiunto a `packages/video` deps.
- **Ogni elemento si anima da solo**: titolo parola-per-parola (`TitleWordByWord`), keyword box pop elastico, mascotte float/breathe, icone pulse/rotate, banda CTA che entra, barra progresso che si riempie, numero gigante parallax. **`DEFAULT_FRAMES_PER_SLIDE=105`** (3.5s/slide a 30fps).
- **Verificato**: render mp4 reale su stoppy (panda) + divinai (orbo mistico); frame "a regime" ≈ PNG (sfondo/keyword/font/mascotte/icone coincidono). typecheck + lint puliti. `RENDERVIDEO.md` resta come storico del piano (ora attuato).

**Rifinitura video "wow" + fix lampo iniziale (sessione corrente):**
- **Bug risolto**: nei primi ms si vedevano "Swipe →"/`@handle` su schermo nero. Causa: lo sfondo entrava con `opacity:bgEnter` (da 0) mentre il footer aveva solo l'opacità d'USCITA → testo visibile prima dello sfondo. Fix: sfondo **opaco da frame 0**; tutto il contenuto avvolto in un wrapper con reveal d'ingresso (`sceneOpacity`/`sceneShift`).
- **Durate per-ruolo** (`slideDurationFrames`/`slideTimeline` in Carousel.tsx): intro **2.5s (75fr)**, teaching/cta **3.5s (105fr)**. La durata totale è la somma per-ruolo (non count×perSlide) — `render-video.ts` `durationFrames` e `Root.tsx` `calculateMetadata` usano la stessa timeline.
- **Transizioni fra slide**: cross-dissolve (ingresso+uscita coordinati sul wrapper contenuto, sfondo che resta). **Parallax** sfondo vs primo piano. **Entrate raffinate**: keyword col **glow** che svanisce all'arrivo, titolo con **respiro** continuo, icona watermark con rotazione lenta in loop, **pillola CTA con glow pulsante**. Ampiezze sottili (eleganza, non caos).
- Verificato a video (frame 0 = solo sfondo; transizione; regime ≈ PNG) su stoppy+divinai. typecheck + lint puliti.

**Rifinitura video iterazione 2 + app M&M (sessione corrente):**
- **Mascotte: 2 pose/slide con cross-fade** (sostituisce lo squash-blink, BOCCIATO perché "rimbalzava tutta la figura"): `VideoMascot{a,b,sparkle}`; `a`=posa Gemini, `b`=compagna coerente (`POSE_COMPANION` in render-video), vira a ~55% slide → media 2 pose/slide. **GOTCHA**: alcune pose sono SVG identici (noit `thinking`===`curious`!) → `POSE_COMPANION` punta a pose DISTINTE (`curious→happy`…); se `b` risolve allo stesso SVG → `b=null`. Disattivabile `mascot.poseSwap=false`.
- **Corpo teaching parola-per-parola** (`BodyWordByWord`); **shimmer pronunciato** (banda di luce netta che attraversa keyword+CTA); **punch zoom** intro; **icone con l'INTERNO animato** (`AnimatedIcon`, SVG inline + `iconMotionFamily`: spin/tick/beat/pulse/ring/arrow/wobble/float → tutte le Phosphor); **watermark icona anche su teaching**.
- **Sparkle orbitanti di noit** (le 3 stelle ATTORNO, da `noit-skia.tsx`, non quelle addosso): overlay `mascot.sparkleSvg`+`sparkle:true` (solo noit), inline+twinkle nel video.
- **Nuova app `madame-monsieur`** (AI virtual try-on/beauty, repo `Madame & Monsieur/`): flusso COMPLETO (carosello+video), lingua EN. Colori brand = **focus blu+rosa+gold** (dall'app `src/lib/tokens.ts`): bg `#0D0A1E`, **primary blu `#22C1F5`** (Monsieur), **secondary rosa `#E84DD8`** (Madame), **accent gold `#EAC84A`** (firma del brand: la & del logo, box keyword, CTA), text `#F2ECFF`. Niente mascotte-personaggio → **logo "M&M"** come "mascotte": font VERO dell'app **Playfair Display italic** (da `design for mm`, scaricato in `public/fonts/`), glifi "M&M" convertiti in **PATH** con `@shuding/opentype.js` (& oro, M bianche) → SVG vettoriale puro (un `<image>` raster annidato NON si renderizza in Satori). `mascot.poseSwap=false` (logo fermo). Render completo 6 slide (intro+4 teaching+cta) carosello+video (600fr) verificato.
- **FitTrack/BudgetWise** (seed mock) RIMOSSE dal DB reale → app reali: noit, stoppy, poof, divinai, **madame-monsieur**.
- **Trigger video manuale via GitHub**: già pronto (`generate-dispatch.yml` `workflow_dispatch` `kind:video|both` → `run-generation.ts` `--kind`). Actions → "Generate (dispatch)" → Run workflow. Serve i GitHub Secrets.
- **Caroselli PNG verificati intatti** dopo tutto il lavoro video (le animazioni vivono solo in `packages/video`; le uniche modifiche al codice condiviso PNG sono ADDITIVE: `LoadedIcon.svg`, `visual-tokens.ts`, exports). Render completo end-to-end (carosello + video) VERIFICATO su M&M.

**Brand M&M: accent a GRADIENTE rosa→blu + logo Georgia + centratura (sessione corrente):** identità M&M raffinata su feedback utente (PNG + video, tutti i formati).
- **Accent a due colori (gradiente rosa→blu).** M&M non ha un accento singolo ma l'identità blu (Monsieur) + rosa (Madame). Nuovo flag `style_tokens.accentGradient: true` (solo M&M) → in `visual-tokens.ts` (fonte condivisa PNG↔video) le helper **`accentFill(colors, styleTokens, angle=90)`** (gradiente lineare `secondary`→`primary`, cioè rosa→blu, se richiesto; altrimenti tinta `accent`), **`onAccentFillColor`** (bianco col gradiente, regola luminanza altrimenti), **`wantsAccentGradient`**. `visual.tsx` e `Carousel.tsx` usano **`accentBg`** (gradiente) per i background (keyword box, eyebrow, banda+pillola CTA, linee) e **`accentSolid`** (= `secondary`=rosa col gradiente) per gli elementi mono-colore che NON possono avere un gradiente (icona Phosphor, chip/bordo, freccia, barra progresso, glow/shimmer/boxShadow). Le **altre 4 app** (accentGradient assente) restano col loro **accent solido** — verificato (noit lavanda, stoppy verde… invariate). `render.ts` e il registry passano `styleTokens` al template; `render-video.ts` lo passa in `inputProps` e colora le icone preload con la tinta giusta.
- **Sfondo `designed` rosa+blu (no oro).** Per `accentGradient` la tinta-accento dello sfondo (`bgAccentSource`) diventa il rosa, e il glow non è più un singolo alone accent ma **DUE aloni opposti**: rosa in basso + blu in alto (`accentGlow`+`accentGlow2`, `twoColorBg`). Il video eredita automaticamente (`preloadBackgrounds` già passa `tokens`). Le altre app: singolo glow accent→primary come prima.
- **Logo M&M col font ESATTO dell'app = Georgia Bold Italic.** L'app (RN: `BeforeAfterSlider`/`MnMWatermark`/logo) usa `fontFamily:'Georgia'` italic 700 come font di SISTEMA (l'app non committa font; il mockup `design for mm` la sostituisce con Playfair). Ora il logo usa la VERA Georgia: `scripts/noit-mascot/build-mm-logo-georgia.mts` legge `C:/Windows/Fonts/georgiaz.ttf` (Georgia Bold Italic), converte "M&M" in **PATH** con `@shuding/opentype.js` → SVG di sole FORME (il `.ttf` NON finisce nel repo → **legale**: Georgia è proprietaria Microsoft, non ridistribuibile, ma usarla in locale per disegnare e committare i path è lecito). Colori: **M rosa `#E84DD8` / & oro `#EAC84A` / M blu `#22C1F5`** (la & resta oro per scelta utente). viewBox ~650×178 → wide.
- **Logo molto più piccolo + ben posizionato.** `visual.tsx` riconosce un logo **wide** (`mascotViewBoxAspect < 0.8`, più largo che alto) e lo dimensiona vincolando la **LARGHEZZA** (intro/cta ~28%, watermark teaching ~24%) invece dell'altezza — prima un logo orizzontale finiva al ~70-89% (era pensato per mascotte verticali tipo Stoppy).
- **Intro+CTA centrati verticalmente.** Erano ancorati in alto (`justifyContent:flex-start`); ora `center` per TUTTI i ruoli, sia in `visual.tsx` sia in `Carousel.tsx` (`padTopBlock` uniformato).
- **Verificato**: PNG intro/teaching/cta su 4:5 + 1:1 + 9:16 (gradiente, logo, sfondo rosa/blu, centratura ok); non-regressione delle altre 4 app (modalità `solid`). typecheck pulito. Video allineato nel codice (stesse helper/`accentBg`/`accentSolid`, centratura) — render mp4 non eseguito in locale (disco pieno, limite d'ambiente; il codice compila).

---

## 15. Messa in produzione GitHub + auto-refill topics + automazione (sessione 2026-06-10)

Sessione di **collegamento a GitHub e messa a punto dell'automazione reale** (cron, quantità, topic). Repo: `https://github.com/Gestionalefracchiolladaniele/content-factory` (PRIVATO).

### Repo GitHub + Secrets + Actions
- `git init` + commit iniziale + push su repo **privato**. Verificato che `.env.local` (chiavi reali) NON sia committato: in staging solo `.env.example` (il `.gitignore` esclude `.env*`). Nessun `node_modules`/`.next`.
- **GitHub Secrets** configurati dall'utente (Supabase URL/anon/service, GEMINI_API_KEY, ecc.) → i workflow leggono le chiavi da lì (in CI non c'è `.env.local`). I Secrets sono cifrati e mascherati nei log.
- **Fix CI `ERR_PNPM_BAD_PM_VERSION`**: `pnpm/action-setup` aveva `version: 10` che confliggeva con `packageManager: pnpm@10.33.0` in `package.json`. Rimosso `version` da entrambi i workflow → usa la versione da `package.json`. (Warning Node 20 deprecato = innocuo, ignorato.)
- **Run `Generate (dispatch)` testato con successo** (carosello noit). Automazione GitHub **funziona**.

### Cron: 1 sola run mattutina (NON 3)
- `generate-scheduled.yml` → **1 cron `0 6 * * *`** (06 UTC = 08:00 estate / 07:00 inverno). Motivi: (1) paga il setup del runner UNA volta sola invece di 3 (risparmio minuti CI); (2) genera i 4 contenuti/app in un colpo pescando topic consecutivi dalla coda → massima diversificazione; (3) **il sistema NON pubblica in automatico** (si ferma a `ready` in Coda Review) → non serve generare a più orari per pubblicare a più orari, pubblichi tu quando vuoi. **L'orario nel `generation_config` (dashboard) NON comanda il cron**: il trigger è SOLO il `cron:` nel `.yml` (GitHub non legge il DB). I `times` in dashboard restano metadati (es. `bestTime` social).
- **Config quantità**: tutte e 5 le app a **`carousels_per_run: 1` + `videos_per_run: 3`** (= 4 contenuti/app/run, 15 video totali). Impostata via REST (`scripts/set-video-config.ts`), non via migration.
- **Conti minuti CI** (piano privato = 2000/mese): il dato osservato è ~6:30 per UNA run con pochi video. Con 3 video × 5 app la durata va MISURATA con un run reale prima di concludere se rientra. Se sfora → repo pubblico (Actions illimitate) o ridurre i video. **Generare ≠ pubblicare** (review umana resta).
- **NON è un bug**: l'utente ha notato "genera PNG invece del video" su un run delle ~12:00 → era PRIMA del commit che attiva i 3 video (le altre 4 app avevano `videos_per_run: 0`). Il log mostra noit che genera il video correttamente ("Video renderizzato: …/video.mp4"). Il motore video è a posto.

### Auto-refill topics (Gemini riempie `topics_queue` da solo)
- **Problema risolto**: 4 app su 5 avevano la coda topic VUOTA → la pipeline ripiegava su `topic = "Novità — <app>"` (riga in `pipeline.ts`) → i contenuti "parlavano dell'app stessa" invece dell'argomento. M&M (coda piena) funzionava.
- **`generateTopics(input)` in `gemini.ts`** (+ export nel barrel `index.ts`): genera N topic on-brand in UNA sola chiamata (così il modello li vede insieme e li diversifica; una sequenza di chiamate separate darebbe topic quasi identici, stateless). Mock-fallback + `strict` come gli altri passi. `responseSchema` `{topics:string[]}`, `normalizeTopics` deduplica ed esclude gli `avoid`.
- **Prompt chiave** (la cura del bug off-brand): argomenti di VALORE sul PROBLEMA dell'utente, **MAI nominare l'app** né le sue funzioni ("niente «come <app> ti aiuta»"), taglio editoriale come una rivista, lingua RIGOROSA (prima ignorava `en` → usciva italiano), esempio di topic buoni in-prompt. Verificato su Poof/Divinai/Stoppy: topic editoriali, lingua corretta, zero menzioni dell'app.
- **Aggancio in `pipeline.ts`**: PRIMA di pescare il topic, se `input.topic == null` (automazione) e `topicsQueue.length <= TOPIC_REFILL_THRESHOLD (4)` → `generateTopics(count=TOPIC_REFILL_COUNT=16)`, accoda e persiste SUBITO (`update topics_queue`). 16 topic ≈ 4 giorni (4 contenuti/giorno). Best-effort: se fallisce, la pipeline prosegue con la coda attuale. `avoid` = coda attuale (TODO possibile: aggiungere lo storico dei `content_pieces` per anti-ripetizione di lungo periodo).
- **Decisione numero**: 16 (non 5) → batch raro = coda stabile + Gemini diversifica meglio vedendo 16 idee insieme. Costo Gemini trascurabile (free tier).

### Descrizioni app arricchite (più contesto = topic/contenuti migliori)
- Intuizione utente: descrizioni ricche → Gemini lavora meglio (vale per topic E ricerca E scrittura). `description`/`target_audience`/`tone_of_voice` delle 5 app espanse (`scripts/enrich-descriptions.ts`, via REST). M&M era già ricca; noit era pochissimo → la più arricchita.
- **Stoppy = app NoFap** (dipendenza da pornografia): inquadrata in registro **SAFE/non esplicito** (crescita personale, autodisciplina, focus, energia, relazioni sane) → topic social pubblicabili senza ban né volgarità. Verificato: refill Stoppy produce topic safe ("building self-discipline", "reclaiming your time"…).

### Bottone "Genera 5 con AI" in dashboard
- **`/api/app/topics`** (`{appId, count?, avoid?}` → `{ok, topics, isMock}`): legge l'app, chiama `generateTopics`, ritorna i topic SENZA salvarli. `generateAppTopics` in `lib/api-client.ts`.
- **UI in `app-editor.tsx`** (Card "Coda argomenti"): bottone che accoda i topic generati allo stato locale (riordinabili/rimovibili); persistiti solo col pulsante "Salva" (come la coda manuale). Esclude i topic già in coda (`avoid`). `CardDescription` aggiornata (auto-refill soglia 5 + generazione manuale). **Nessuna migration/SQL**: `topics_queue` è jsonb esistente.

### Fix script `pnpm gen` in locale
- `package.json` script `gen`: ora `node --env-file-if-exists=.env.local ./node_modules/tsx/dist/cli.mjs scripts/run-generation.ts`. Prima `tsx scripts/...` NON caricava `.env.local` → girava sempre in MOCK in locale (leggeva le app finte FitTrack/BudgetWise dello store mock). Su GitHub Actions non serviva (le var arrivano dai Secrets via `env:`). `--env-file-if-exists` ignora il file in CI dove non c'è.

### Quota Gemini free tier + ROTAZIONE multi-chiave + throttle
- **Diagnosi (importante):** il free tier Gemini ha una quota **GIORNALIERA bassa per progetto/modello** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, osservato **~20/giorno** su `gemini-2.5-flash-lite` senza billing). Il run da 5 app × 4 contenuti = ~40 chiamate (2/contenuto) + auto-refill → dopo ~20 chiamate **tutto 429** ("1 ok, 19 falliti"). Il testo dell'errore dice `PerDay` ma a tratti sembra ricaricarsi a gocce → fuorviante; il limite vero è giornaliero. **Le pause da sole NON bastano** (non aggirano un tetto giornaliero).
- **Billing scartato:** l'utente non vuole rischi di costo; per alcuni modelli il billing fa pagare dalla prima chiamata e le regole Google cambiano spesso → **niente billing**.
- **Soluzione = ROTAZIONE multi-chiave** (free, lecita): più chiavi di **account diversi** → la quota si somma (la quota è per-progetto, NON per-chiave: 2 chiavi dello stesso account NON raddoppiano). `gemini.ts` **`callWithKeyRotation(firstKey, label, run)`**: legge `GEMINI_API_KEY`, `_2`, `_3`, `_4` da env (`geminiKeyPool`), prova `run(key)` su ognuna; su **429 di quota** (`isQuotaError`) passa alla successiva, altri errori propagano. Applicata a TUTTI e 3 gli step (ricerca, struttura, `generateTopics`) — il client `GoogleGenerativeAI` va ricreato per chiave dentro la callback. Verificato: chiave 1 esaurita → passa alla 2 → genera. **3 chiavi ≈ 60 richieste/giorno gratis.**
- **GOTCHA formato chiavi 2026:** Google ha cambiato il formato delle API key. Le nuove "auth key" iniziano con **`AQ.`** (~53 char), NON più `AIzaSy` (~39). Entrambi i formati funzionano col metodo `?key=` dell'SDK `@google/generative-ai` (verificato: `AQ.` → HTTP 200). Quindi una chiave `AQ.…` è valida, non un errore.
- **`.env.local` / Secrets**: le chiavi multiple vanno con **nomi distinti** (`GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`) — righe con lo STESSO nome si sovrascrivono (ne vince una). Workflow + `.env.example` aggiornati. Su GitHub: le chiavi vanno nei **Secrets** (cifrati), non Variables; il workflow le legge con `${{ secrets.GEMINI_API_KEY_2 }}` ecc.
- **Throttle** (`throttleGemini`, `GEMINI_MIN_INTERVAL_MS` default 15s): distanza minima tra chiamate reali (process-wide, stato su `globalThis`) per non ammassare le richieste e prendere 429 inutili. In mock (niente chiave) NON si attiva. Complementare alla rotazione: il throttle distribuisce, la rotazione somma le quote.

### Topic CONSUMATI (rimozione, non più riciclo)
- `pipeline.ts`: il topic usato ora viene **RIMOSSO** dalla coda (`removeFromQueue`, prima `rotateQueue` lo spostava in fondo). Motivo: con l'auto-refill la coda si rifornisce da sola → riciclare vecchi topic darebbe solo duplicati (scartati dall'anti-dup, sprecando chiamate Gemini, preziose con la quota stretta). Il check auto-refill gira a OGNI contenuto (runPipeline è chiamato 1×/contenuto) leggendo la coda fresca dal DB → quando scende a ≤4 ricarica +16: la coda non si svuota mai.

### Script utility aggiunti (`scripts/`)
- `inspect-config.ts` — stampa `generation_config` + `topics_queue` + brand di ogni app + stima minuti CI. `set-video-config.ts` — imposta `videos_per_run`/`carousels_per_run` su tutte le app. `enrich-descriptions.ts` — salva le descrizioni arricchite. `test-refill.ts <slug>` — prova `generateTopics` su un'app (sola lettura, stampa i topic). Tutti via `node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/<file>`. (Script diagnostici usa-e-getta `diagnose-gemini`/`probe-rate`/`test-key3` creati e rimossi a fine diagnosi.)

**Stato**: typecheck + lint puliti. App reali: noit, stoppy, poof, divinai, madame-monsieur (tutte 1 carosello + 3 video, coda topic auto-rifornita + consumata). Rotazione 3 chiavi (~60 req/giorno free) + throttle + auto-refill on-brand. **Da fare (utente):** aggiungere `GEMINI_API_KEY_2`/`_3` ai GitHub Secrets; (consigliato) rigenerare le chiavi esposte in chat. **Aperto:** MISURARE i minuti reali di un run con 15 video; bug estetico **keyword lunga** (evidenziatura non copre la keyword troppo lunga in `visual.tsx`) — rimandato.
