# DOPIT — ADHD Focus Companion App

> **Rebrand note (Noit → Dopit):** this app was rebranded from *Noit* (axolotl / emotional-eating) to **Dopit** (a brain buddy for ADHD focus). The domain shifted from "cravings" to "focus blockers / getting unstuck", the palette from purple to warm pink/rose (see `src/lib/theme.ts`, from `adhd app/*.html`), and copy/persona to an ADHD focus coach. **DB field names were intentionally kept** (`sessions.food`, `mood_before/after`, `mode 'feed'|'breathe'`) to avoid a risky column rename — they now hold the focus-blocker text, energy 1-5, and chat/reset mode. The app & mascot name live in `src/lib/brand.ts` (`APP_NAME`/`MASCOT_NAME = 'Dopit'`). **Much of the historical detail below still describes the old Noit internals** (kept for reference); identifiers like `Noit`/`NoitMini`/`noitVariantForMood` survive as back-compat aliases.

## 🧩 Mascot — Dopit (pink ADHD brain, Skia)
`src/components/Mascot.tsx` is the real mascot: a **1:1 Skia port of `adhd app/mascotte-adhd.html`** (the light-pink anthropomorphic brain — gyri folds, two feet, two hands with fingers, 4 sparkle stars, blush cheeks, big eyes). Rendered with **`@shopify/react-native-skia`** (GPU, single `<Canvas>`) — NOT `react-native-svg`, because the large animated SVG crashed natively on real Android (see §Device-test findings).
- **Conversion method (verbatim coords):** SVG `viewBox="56 16 368 416"` → root `<Group>` applies `translate(-VB_X*scale, (-VB_Y+floatY)*scale) + scale` (`scale = size/368`). `<ellipse>` → `<Oval rect(...)>` via `ovalRect([cx,cy,rx,ry])`; `<path d>` → `<Path path>` SAME string; gradients → Skia `<RadialGradient>`/inline. Brain gyri (~25 paths) clipped to the brain oval via `Skia.Path.Make().addOval(...)` (ellipse clip, not a box). Right hand = left hand mirrored `translate(480) scaleX(-1)`.
- **9 variants** (`MascotVariant` = `idle/listening/thinking/eating/happy/excited/wink/curious/eyes_closed`): **shared body**, only eyes/brows/mouth swap per state via `eyesFor`/`browFor`/`mouthFor`. `happy`=^^ + open smile · `excited`=star eyes · `wink`=L star + R closed · `eating`=X eyes + small "o" mouth · `eyes_closed`=soft arcs · `curious`=pupils up-left + raised brows · `thinking`=raised brows + flat mouth.
- **Animations (Reanimated → `useDerivedValue` → Skia transform, GPU):** `floatY` ±11px, `blink` (long-open + quick close, only on open-eyed states), sparkle `sp` pulse (opacity 0.35→1). All hooks are top-level in the component (no hooks in render-helpers). **Props** `glow` (white radial aura), `showSparkles` (4 stars), `static` (skip all animation — used by `NoitMini`).
- **API unchanged:** keeps `state/size/glow/showSparkles/static/crown`. `Noit.tsx` re-exports it as both `Noit` and `Dopit`; `NoitMini` wraps it static. The previous Noit Skia mascot (`noit-skia.tsx`) was deleted.
- **Visual preview:** `mascot-preview.html` (repo root) renders all 9 states as SVG → screenshot to PNG with headless Chrome (the SVG geometry matches the Skia output 1:1).

---

Axolotl mascot **Noit** eats emotional cravings via 10-min AI chat. Target 18-28 EN. Zero shame, never clinical.
**Stack:** Expo 54 / RN 0.81 / TS strict / Expo Router / Supabase+Google OAuth · Zustand · AsyncStorage · **Gemini 2.5 Flash-Lite** (single-shot + synthetic typewriter) · Reanimated 4 · **Noit mascotte = `@shopify/react-native-skia` 2.2.12** (migrazione COMPLETA, `Noit` ora wrapper di `NoitSkia` — vedi §Skia Migration) · react-native-svg solo per asset statici leggeri (stelle bg, icona Google) · **expo-updates 29** (EAS Update OTA) · expo-linear-gradient · RevenueCat (TODO) · **pnpm**

## ⚙️ Skia Migration (✅ CODICE COMPLETO — in attesa validazione device finale)
**🔴 Motivazione (confermata su device):** il Noit SVG (`react-native-svg` + ~10 shared value Reanimated, ~60 nodi) **CRASHA NATIVAMENTE** l'app su Android reale (Xiaomi). Test diagnostico (vedi §Device-test findings): step onboarding con `<NoitSkia>` regge, step con `<Noit>` SVG crasha. ⇒ Skia OBBLIGATORIA. **Decisione: riscrittura COMPLETA in Skia, TUTTE le mascotte.** Piano in **`HANDOFF-SKIA.md`**.
**Approccio conversione 1:1 (basso rischio visivo):** Skia e SVG condividono coordinate + path string. `<Ellipse cx cy rx ry>` → `<Oval rect(cx-rx, cy-ry, 2rx, 2ry)>` (helper `ovalRect([cx,cy,rx,ry])` tupla per `max-params`) · `<Path d="...">` → `<Path path="...">` STESSA stringa · `<Circle>`/`<Line>` identici · `rotate(a cx cy)` → `<Group transform={[{rotateZ: a*π/180}]} origin={{x:cx,y:cy}}>`. **ViewBox mapping:** Skia non ha viewBox → root `<Group>` applica `translate(-VB_MIN_X*scale, (-VB_MIN_Y+floatY)*scale) + scale` dove `scale = canvasW/240` (uniforme, 240*1.05=252). **Ogni coordinata interna = stesso numero dell'SVG.** Animazioni riusano le STESSE shared value Reanimated (stesso timing) via `useDerivedValue` → GPU. `<Canvas>` su nativo NON richiede Provider.
**✅ Stato attuale (codice fatto, da validare su device):**
- **`src/components/noit-skia.tsx`** — **TUTTE le 9 varianti** (`idle` `happy` `curious` `wink` `excited` `listening` `thinking` `eating` `eyes_closed`), conversione 1:1 da `Noit.tsx`. `eating` con geometria-corpo diversa (body rx96/ry102, X-eyes 4 Line, guance 32×24, bocca scura, fin/piedi riposizionati). `listening`/`thinking` con `tilt` + ear-fin laterali. Tutte le anim riusate: `breathe`/`jiggle`/`blink`/`finL`/`finR`/`floatY`/`tilt`/`antenna`/`sp1-3`. **Aura** (RadialGradient Skia, stessi stop dell'SVG, Canvas overlay separato) + **3 sparkle stars** animate, props `glow`/`showSparkles`/`static` rispettate. `NoitVariant` ora DEFINITO qui (canonical); `tsc` 0 err, eslint 0 err (solo 2 warning `exhaustive-deps` intenzionali = pattern effect-split identico a Noit.tsx).
- **`src/components/Noit.tsx`** — ora **wrapper di ~20 righe**: `export function Noit(props) { return <NoitSkia {...props} /> }` + ri-esporta `NoitVariant`/`NoitProps=NoitSkiaProps`. ⇒ **TUTTE le ~13 schermate passano a Skia senza modifiche** (importano ancora `@/components/Noit`). SVG originale preservato in git history. (filename PascalCase `Noit.tsx` tenuto per non rompere i ~13 import.)
- **`NoitMini.tsx`** invariato (usa `Noit` → ora NoitSkia static). Usi TEMP ripristinati: auth `<Noit happy 180>`, onboarding step1 `<Noit idle 200>`.
**⚠️ Residuo (dopo validazione device):** rimuovere diagnostici TEMP — `crash-screen.tsx` + ErrorBoundary/global handler in `_layout.tsx` (TENUTI di proposito durante la build di verifica come safety net per errori JS; rimuovere SOLO dopo conferma "zero crash su tutte le schermate") → build preview finale.

## 🏗️ Build & EAS Update (device testing)
**Profili EAS** (`eas.json`): `preview` (APK Android installabile diretto, `environment: preview`, channel `preview`, NO Metro/dev-server, standalone) · `production` (.aab store, NO install diretta) · `development` (dev-client + Metro, legge `.env` locale) · `simulator`.
**Comando test device:** `pnpm build:preview:android` → APK su cloud EAS (~10-20min, link/QR su expo.dev → Builds). **PC spegnibile** dopo upload/queued (build gira sul cloud Expo). Prima build può chiedere keystore Android → yes (auto-gestito).
**EAS Update (OTA) configurato** — flusso "build 1 volta + `eas update` poi": `expo-updates@29.0.18` installato · `app.config.ts` ha `updates.url: https://u.expo.dev/<projectId>` + `android.runtimeVersion: {policy: 'appVersion'}`. Iterazione JS (NoitSkia, schermate): `eas update --branch preview --message "..."` → riapri app → scarica nuovo JS, **niente ri-build**. ⚠️ Update OTA aggiorna SOLO JS — nuova dep nativa / config nativa → serve nuova build. Skia/Noit è puro JS sopra Skia già compilato → sempre `eas update`. `runtimeVersion=appVersion` ⇒ un update va solo su build con stessa app version.
**Env preview su EAS** (caricate, `environment: preview`, NON legge `.env` locale): `EXPO_PUBLIC_SUPABASE_URL` (plaintext) · `EXPO_PUBLIC_SUPABASE_ANON_KEY` (sensitive) · `EXPO_PUBLIC_GEMINI_API_KEY` (sensitive) · `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (plaintext) · `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (plaintext). **`SUPABASE_SERVICE_ROLE_KEY` MAI in env client** (no prefix `EXPO_PUBLIC_`, escluso dal bundle). Comandi: `eas env:create/list/delete --environment preview`.
**⚠️ Audit device-reale (preventivo, da verificare su build):** (1) safe area — `edge-to-edge` attivo ma root non applica insets, check notch/home-bar per schermata; (2) Google Sign-In Android release richiede SHA-1 in Google Console (debug≠release); (3) keyboard — `react-native-keyboard-controller` installato, verificare usato in food/chat/reflect/reminder; (4) Android 13+ `POST_NOTIFICATIONS` runtime perm in `registerForPushNotifications`; (5) **font mismatch:** `app.config.ts` carica solo **Inter** ma design dice DM Sans — verificare cosa usa il testo; (6) expo-image caching su 134 PNG food.

## 📱 Device-test findings (build preview #1 — Xiaomi/Android)
**✅ NoitSkia idle resa OK** (corpo/piumini/bib/forchetta/occhi visibili, conversione SVG→Skia corretta). **✅ Auth Google nativo funziona** (login liscio sul device). NoitSkia non crasha.
**🐛 Blink occhi "cadono giù e risalgono" → FIXATO:** in `noit-skia.tsx` il `<Group>` occhi aveva SIA `transform={eyeTransform}` (translate→scaleY→translate) SIA `origin={{x:100,y:100}}` → doppia traslazione. **Fix: rimosso `origin`** (il translate manuale dentro eyeTransform già fa il pivot). ⚠️ Regola Skia: per scale-attorno-a-punto usa translate/scale/translate manuale SENZA origin; per rotate-attorno-a-punto usa `rotateZ` + `origin` (NO translate manuale). Piumini/mani usano correttamente rotateZ+origin.
**🔴🔴 CRASH = IL NOIT SVG (`react-native-svg`) sul device reale — CONFERMATO con test diagnostico.** Percorso della diagnosi: (1) sospettate notifiche push → fix projectId+try/catch NON ha risolto; (2) ErrorBoundary + global ErrorUtils handler aggiunti → **crash resta SECCO senza schermata rossa** = crash NATIVO, non JS (nessun try/catch JS può fermarlo); (3) test isolante decisivo: sostituito `<Noit>` SVG con `<NoitSkia>` nello **step 1 onboarding** → **step 1 con NoitSkia REGGE, step 2 con Noit SVG CRASHA appena ci si arriva**. ⇒ **`react-native-svg` (il Noit grande ~60 nodi animati) crasha nativo su questo Android.** L'intuizione utente "troppi SVG" era giusta nella sostanza (è SVG, anche se 1 alla volta — il singolo Noit grande basta a far crashare il device). **Le altre ipotesi (notifiche/insert/nav) sono SCAGIONATE** (utente nuovo non chiama nemmeno `bootstrapUserSession`; con NoitSkia lo stesso percorso non crasha). **CONSEGUENZA: serve convertire TUTTE le mascotte dell'app in Skia.** Vedi `HANDOFF-SKIA.md` per il piano.
**⚠️ Push notif fix comunque tenuto** (projectId + try/catch in `push-notifications.ts` e `_layout.tsx`): non era la causa del crash ma è hardening corretto per quando FCM sarà configurato. **ErrorBoundary + global handler** (`crash-screen.tsx` + `_layout.tsx`): TEMP diagnostici, **da rimuovere** a crash risolto (ma utili per catturare errori JS futuri).
**⚠️ EAS Update funziona** (dopo la 2ª build con expo-updates dentro): `eas update --branch preview` arriva sul device (confermato — blink corretto = bundle nuovo attivo). Iterazione: pubblicare update, poi sul telefono chiudere completamente app → riaprire (scarica) → richiudere → riaprire (applica). ⚠️ `expo config` può crashare su PowerShell Windows con `0xC0000409` (stack buffer overrun, processo Node corrotto) → riaprire il terminale risolve; in alternativa lanciare `eas update` da un altro shell.
**TODO Skia residuo:** convertire le 8 varianti mancanti + swap globale (vedi `HANDOFF-SKIA.md`). **Layout pagina auth:** troppo spazio al centro (schermata di test TEMP, si ripristina con `<Noit>`→`<NoitSkia>` dopo migrazione — non fixare ora).

## Mascot — Noit
Chubby axolotl (Kirby). Body `#BCA8EE` · Belly `#D8C8FA` 60% · Cheeks `#F2B8CC` · Fins/Plumes `#A484D4`/`#C8B4F4` · Eyes `#1E1240` · Mouth `#F5A0B8` · Sparkle `#F5E060` · Aura radial white 28%→0. **ViewBox `-20 -22 240 252`** (height `size * 1.15`) — extended margins per mai tagliare mani/piedi/forchetta/piumini.
**9 variants** (`NoitVariant`): `idle` · `listening` (head tilt + L fin up) · `thinking` · `eating` (X eyes, puffy cheeks 26×19, open mouth) · `happy` (^^ eyes, open mouth) · `excited` (star eyes r=15) · `wink` (L star + R closed) · `curious` (pupils up-left) · `eyes_closed` (downward arc, BreatheScreen).
**Animations** (ora Skia: shared value Reanimated → `useDerivedValue` → `transform` dei `<Group>` su GPU; NON più `useAnimatedProps` SVG): `breathe` 1→1.034 @3.6s · eating 1.02↔1.12 @560ms + `jiggle` 0.97↔1.05 X/Y opposti · `blink` scaleY→0.07 @4.8s · `finL/R` ±8°/5° @3.6s · `float` 0→-7px @4s · `tilt` 0→-6° @4.2s · `antenna` (drives plume-tip stars sway) `rotate(antenna*0.6, 100 30)` ±5° @4s · `sparkle` 0→1 @2.4s delays 0/800/1500ms. **⚠️ Regola transform Skia:** scale-attorno-a-punto (blink/breathe) = translate→scale→translate manuale SENZA `origin`; rotate-attorno-a-punto (piumini/fin/tilt) = `rotateZ` + `origin` SENZA translate manuale.
**useEffect split (critical):** `[state]` → `breathe`/`jiggle`/`tilt` (re-trigger eating wobble); `[]` mount only → `blink`/`finL/R`/`floatY`/`antenna`/`sp1/2/3`. **Static mode** (`static` prop): skip all `useEffect`, force `glow=false` + `showSparkles=false`. Safe per liste/chip — usata via `<NoitMini>` wrapper.
**`eating` geometry** (Kirby puff): body `rx 96 ry 102 cy 118`, **head plumes scaled up**, belly `rx 68 ry 72 cy 130`, cheeks `rx 32 ry 24` cx 48/152, **fins fuori** cx 10/190 cy 130 rx 32 ry 18, **piedi sotto** cy 214 rx 22 ry 12. Mouth: dark ellipse rx 22 + pink interior + dark tongue.
**✦ Signature (4 memorabili):**
- **Axolotl head plumes** (3) — sostituiscono le "orecchie laterali" precedenti. Posizionate IN ALTO sulla testa, anatomia axolotl reale. Piumino sinistro cx 82 cy 18 rotate -22° · centro cx 100 cy 14 (slightly taller) · destro cx 118 cy 18 rotate +22°. Two-tone outer `#A484D4` rx 9 ry 15 + inner highlight `#C8B4F4` rx 6 ry 11. **Eating state**: scaled up + repositioned. Antenna+stella RIMOSSA.
- **3 tiny stars on plume tips** — `#F5E060` con bordo `#E8C830` su ogni punta dei piumini (left ≈ 74,0 · center ≈ 100,-7 più grande · right ≈ 126,0). Animate via `antennaProps` (rotate `antenna*0.6` around `(100,30)`) per soft sway. Coordinate diverse per `eating` state.
- **Bib** white `#FFFFFF` + bordo viola `#7B5BA9` 2px. **Visibile in TUTTI gli stati** (incluso `eating` con geometria scalata: cx 60-140 y 152-200, straps extended cx 10/190). Standard: y 142-188 con 2 horizontal straps che partono dal centro lati del bib (y 160) e si curvano fino ai lati del corpo (x 24/176 y 146). Stitching subtle `opacity 0.35`. **Stella gialla `#F5E060`** centrata (bordo `#E8C830`, shine `#FFF4A0`).
- **Forchetta vera verticale** (no più rotate 18°) — posizionata SULLA mano destra (fin cx 172 cy 118). Grip CENTRATO a y 112-124 (= centro fin) cosicché la mano "stringe il punto medio". `<G transform>` solo `translate(14 12)` in eating. **4 rebbi sopra** `#E8E4F4` strokeWidth 4 con outline `#5C3E9C` 1.4 (visibilità) → fork head plate arrotondata + white highlight → **shaft `#E8E4F4`** strokeWidth 5 con outline scuro + white highlight → **grip wrap `#5C3E9C`** strokeWidth 7 al centro + 3 grip texture lines `#BCA8EE` → **stella `#F5E060` pommel sotto** (larger) + shine `#FFF4A0`. Visibile in ogni stato.
- **Eye sparkle** (`Circle r=2.5 fill=white opacity=0.95`) top-left dentro ogni pupilla su `idle`/`listening`/`curious`/`thinking`/`wink`; r=3 in `excited`.

**Props:** `state` · `size` · `crown?` · `showSparkles?` · `glow?` · `static?` (disable anim/aura/sparkles).

## Colors & Typography
Source: `noit-design/*.html`. Purple (NOT orange). | BG gradient `#9272C2→#6A4AAC(55%)→#5C3E9C` `<PurpleBg />` 160° | Accent `#7B5BA9`/`#5C3E9C` btn/tab | Text `#2B1A52` / `rgba(43,26,82,0.52)` cards/muted | Card `rgba(255,255,255,0.92)` | Glow `rgba(255,255,255,0.14)` top | Mood Good/Mixed/Hard `#E6FAF0/#1A6B44`·`#FFF5E6/#7A5010`·`#FFE6F0/#8A1840` chips | Delta up `#1A6B44/rgba(26,107,68,0.12)` · down `#8A1840/rgba(138,24,64,0.12)` · neutral `rgba(43,26,82,0.55)/0.08` | Danger `#E05C5C` crisis |
`<PurpleBg />`: L1 gradient 160° start(0.15,0) end(0.85,1) · L2 top glow h=40%. **DM Sans** 500-700. Radii: cards 20-26px · btn 18-22px · tag 12-14px.

## Tabs (4): Home · History · Insights · Profile
**PulseCard ovunque** (`useSyncPulse`): wrap a tutte le card di Home/History/Insights/Profile (no più solo Home).
TabBar (`src/components/TabBar.tsx`): bg `rgba(255,255,255,0.92)` · active `#5C3E9C` · inactive `rgba(92,62,156,0.38)` · h=88 absolute. Session opens as `/session` modal (no Noit tab).

**Home** — greeting + check-in card (idle/happy → `/session`) + `<TodayMoodDisplay />` in PulseCard (**mood BEFORE → AFTER** ultima sessione via `useRecentSessions()`: NoitMini before+after, freccia con delta pill +/- colorata, meta row con food+duration+timeAgo) + streak row (3 cards) + week bars + recent top 5 (`formatDuration(s.duration)`). All `useSyncPulse()`. `useFocusEffect` reload.

**History** — range `2W/1W/1M` + 📅 `<CalendarPicker>` + "+" → `/session`. **Mode tabs** `All N / 💬 Feed N / 🌬️ Breathe N` + **trash icon button** (`marginLeft: 'auto'` nel ModeTabs row) → entra in **select mode**. Row: date badge + mode icon + food + recap preview + `formatDuration · time` + **mood column** (NoitMini before 26px → freccia → NoitMini after 32px). **Tap row → `<SessionDetailModal>` full-screen.** Tutte le row in `<PulseCard>`. Filter client-side da `useRecentSessions()`.
**Select mode (multi-delete):** trash button toggle. Header bar in alto sulla lista mostra "N selected" + Cancel/Delete buttons. Ogni row mostra checkbox `#7B5BA9` a sinistra, tap on row → toggle selezione (non più apre detail). Delete confirm Alert → `Promise.all(deleteSession())` parallelo → reload. Border viola 2px su row selezionate. Bottom bar destra `#E05C5C` per delete confirm.

**SessionDetailModal** (`src/components/SessionDetailModal.tsx`) — full-screen `PurpleBg` + hero (back btn + mode chip + date + time). Card: title food + **mood row** (Before NoitMini 56px → freccia + delta → After NoitMini 56px) + stats row (Duration, Mood shift). **Recap-only** (Noit's recap box). **Niente sezione Conversation** — i messages non sono più persistiti.

**Insights** — range + calendar + Mode tabs. Cards:
- **Mood chart adattivo** (dual line): bucket si adattano al range (1W=7 giorni, 2W=7 bucket di 2d, 1M=7 bucket di ~4d, calendar adattivo via `buildMoodSeries(rows, since, now)`). Linea **after solida** `#5C3E9C` + fill gradient, linea **before tratteggiata** `rgba(123,91,169,0.5)` strokeDasharray `4 5`. Guide lines a mood 1/3/5. Labels sotto.
- **Average mood card** con **switch interno (Mood / Best time)** `<SwitchTabs>`:
  - View `mood`: Before NoitMini → freccia + deltaPill → After NoitMini + footer "Average across N sessions"
  - View `bestTime`: `<BestTimePanel>` mostra "You feel best after sessions started" + range orario (es. "4pm – 8pm") + deltaPill positivo, + mini bar chart 6 bucket (best bucket evidenziato `#5C3E9C`, negativi `rgba(138,24,64,0.45)`). Empty state se <3 sessioni.
- **Heatmap weekday × hour bucket** (7 righe × 6 fasce `12a/4a/8a/12p/4p/8p`, color scale 0 → 0.28 → 0.58 → `#5C3E9C`, count in cella se >0)
- **Cravings card** con **switch (Top / Mood)**:
  - View `top`: bar list `food · barBg · N×` (count-based)
  - View `mood`: `<MoodByCravingPanel>` mostra per food top 5: count, avg before→after, delta pill verde/rosso/neutro

**Profile** — first name + 🔔 bell (apre `NotificationCenter`, badge rosso unread) + Noit hero (`streak` 🔥 + total sessions) + 3 stat cards in PulseCard (avg mood, total time, member since) + menu in PulseCard. `useFocusEffect` → `loadStreak` + `loadRecentSessions`.

**Settings (4 voci, no dev):** **Notifications** `<Switch>` aggiorna `user.notifications_enabled` + `registerForPushNotifications()` + schedula reminder. Quando ON: inline TimePicker con **3 preset editabili** (☀️/🌤/🌙) — **tap card seleziona** (set `check_in_time` + ri-schedula), **2° tap sulla card già selezionata apre edit inline** (TextInput HH:MM autoFocus, onBlur/Submit → `normalizeTime` + persist in `user.reminder_presets` JSONB). Hint dinamico: "Tap to select · tap again to edit" / "Type a time like 08:30 — done auto-saves". **Subscription** → `PaywallModal`. **Privacy & data** → `PrivacyModal` full-screen `PurpleBg` (Export CSV + Delete account + link policy). **Help & Support** → `HelpModal` full-screen `PurpleBg` + Noit `happy` + 5 FAQ + `support@noit.app`.

**Sign out** — `Alert.alert` conferma → `cancelSessionReminder()` fire-and-forget → `signOut()` (auth-store ora clear locale IMMEDIATAMENTE prima di chiamare `supabase.auth.signOut()` per evitare race) → `router.replace('/')` come belt-and-suspenders. `_layout.tsx` listener gestisce comunque il redirect via `onAuthStateChange`.

**Reminder time picker UI fix:** chip ha `overflow: 'hidden'` + `minWidth: 0`, TextInput `width: '100%'` + `includeFontPadding: false`. Niente più overflow visivo quando si edita. Long-press su qualsiasi chip apre edit (anche unselected).

## Session Flow (`src/app/session.tsx`)
```
food → mood-before → choice (Feed | Breathe + Continue) →
  ├─ Feed:    Kirby eat anim → Gemini chat → end-mood → end (AI recap from chat)
  └─ Breathe: 5min inhale/hold/exhale → end-mood → reflect (text) → end (AI from reflection)
```
`Phase`: `food → mood → choice → active → end-mood → reflect? → end`
**Zero-orphan DB pattern (refactored):** `startSession` NON inserisce più in DB. Sessione vive in-memory con `id: 'local-...'`. INSERT avviene SOLO al completamento del flusso end (`endSession`/`endBreatheSession`) via `insertCompletedSession(args)` con tutti i campi compresi `created_at` originale. Qualsiasi exit (back gesture, modal "Leave", app kill) → zero righe orfane in DB. `discardActiveSession()` è ora solo reset in-memory (no DB call). `deleteSession` esportato per uso in History.
**Exit safety — `ExitConfirmModal`**: durante `active`, tap back → modal "Leave session?" con Noit `curious` 90px + "Keep going" (purple) / "Exit without saving" (dark red). Tap exit → reset in-memory + `router.replace('/(tabs)/home')`.
**Food picker** (no preset grid): Noit `curious` + free `TextInput` + live preview (90×90 + capitalized label) + 5 popular presets. `resolveFood(input)`.
**Mood picker (NoitMini swap)**: 5 white cards con `<NoitMini state={noitVariantForMood(o.m)} size={42}>` invece di emoji 😞🙁😐🙂😄. Selected = white bg + purple 2px border. Reused mood-before/after.
**Choice screen**: 2 white cards (Talk/Breathe) — select-then-Continue. `starting` flag → "Starting…" + opacity 0.5.
**ChatScreen (Feed) — `playEatingSequence()` replayable:** (1) `curious` → food fade-in spring + bob + rotate ±6°; (2) @900ms `excited` → @1400ms `eating`; (3) @1500ms 2 wind rings; (4) food shrink/rotate/arc/fade; (5) Kirby linger puffed; (6) @2900ms `happy` → @3700ms `listening`. Replay button. Status: "Thinking…"/"Mmm…"/"Yum!"/"Replying…"/"Listening". 10-min progress bar · Crisis banner static. Timeouts in `timeoutsRef` cleared on every call.
**BreatheScreen:** 5-min countdown. Noit (210px, no sparkles): `happy` inhale/exhale, `eyes_closed` hold. Body puff scale 1.1↔0.95. Double aura. Breath cloud 70×40 fuori aura: inhale ty -110→-40, exhale ty -40→-130. Phases: inhale 4s / hold 4s / exhale 6s auto-advance. 3 dots, active 22px pill. "Finish" bottom.
**ReflectScreen (Breathe only):** Noit `curious` 130px + "What just happened?" + **NoitMini recap row** ("You came in feeling [NoitMini 28px] · now [NoitMini 32px]") sostituisce gli emoji. Multiline TextInput. "Save reflection" + "Skip". Passa `reflection` a `endBreatheSession(mood_after, reflection)` → `interpretBreatheReflection()`.
**EndScreen**: feed `endSession(moodAfter)`; breathe `endBreatheSession(moodAfter, reflection)`. **End chip con NoitMini** (24px) + label ("Calmer than before"/"Steady"/"You showed up") sostituisce emoji 😌🙂🤝.
**Messages NON persistiti**: `endSession`/`endBreatheSession` salvano `messages: []` in DB. Solo `recap_text` resta. Risparmio storage + privacy migliore.

## Onboarding (`src/app/onboarding.tsx`) — 7 steps
Render-conditional `{step===N && <Step/>}` in `<SlideStep key={step}>` (translateX dir×60→0 + opacity, 460ms). Save solo step 7: upserts `subscription_status='plus'` + `role_completed=true`.
(1) Meet Noit `idle` (2) How it works `happy` 3 feature cards (3) Name+Birth year `curious` hard block <18 (4) Craving time `wink` (5) Feeling topics `excited` 10 chips (6) Disclaimer `idle` 2 checkboxes (7) Paywall `happy`+crown → `<PaywallSheet>` (Annual €3.99/mo · Monthly €7.99/mo · 7-day trial). Single source `src/components/PaywallModal.tsx`.

## Key Features
**Streak:** giorni consecutivi ≥1 session. Milestones 3/7/14/30/60/100. `fetchStreak(userId)` — `toLocalYmd()` (NON UTC) + Set O(1) + handles "started yesterday" + while-loop backward. Rising-edge milestone in `loadStreak`: `prevStreak` vs nuovo → milestone → `pickStreakMilestone` + `insertNotification`.
**MoodCheckin (NoitMini swap):** 5 cards con `<NoitMini state={noitVariantForMood(o.mood)} size={36}>` invece di emoji. `AnimatedMoodNoit` wrappa NoitMini in `Animated.View` con scale: idle=shared pulse, selected=spring 1.25→1.07. emojiBtn allargato 48→56px per ospitare Noit. Upserts `daily_moods`. `flat` prop per PulseCard.
**Sync pulse** (`use-pulse.ts`): module-level `makeMutable(1.0)`, single anim drive tutti i `PulseCard`.
**Crisis** (`checkCrisis()`): client-side BEFORE ogni Gemini call. Keywords: suicide/kill myself/end it/self harm/cutting/not worth living/want to die/hurt myself/no reason to live.

## Pricing
| Free €0 — 1 session/day, 7 days history | Plus Annual €3.99/mo yearly — unlimited, insights, custom Noit | Plus Monthly €7.99/mo — same |

## Database (`supabase/schema.sql` + `migrations/fase3_*.sql`)
- **`users`** — id, email, name, avatar_url, role, role_completed, subscription_status(`free|plus|pro`), premium_expires_at, notifications_enabled, check_in_time, **push_token**, **reminder_presets jsonb** (`{morning,afternoon,evening}` default `09:00/14:00/21:00`), birth_year, craving_time, topics(text[]), disclaimer_accepted, created_at
- **`sessions`** — id, user_id, food, mode(`feed|breathe`), duration(sec), mood_before/after(1-5), recap_text, messages(jsonb — sempre `[]` per nuove session), context(jsonb), created_at
- **`daily_moods`** — id, user_id, date, mood(1-5), unique(user_id, date)
- **`notifications`** — id, user_id, type(`session_reminder|daily_check_in|streak_milestone`), title, message, read, **data(jsonb)**, created_at

RLS: `auth.uid()=user_id` su tutte + **DELETE policies** (GDPR self-service). Trigger `on_auth_user_created` → auto-crea `users` row. Indexes: `sessions_user_created`, `sessions_user_mode_created`, `sessions_user_mood_after`. **Migration FASE 3 NON va aggiornata per le ultime modifiche** (stats derivate calcolate client-side, messages già jsonb).

## Food Registry (`src/lib/food-registry.ts`)
134 Kenney PNGs (CC0) in `src/assets/food-kit/`. `FOOD_REGISTRY` 134 entries · `ALIASES` ~80 synonyms · `POPULAR_PRESETS` (Pizza/Burger/Coca/Chocolate/Ice cream). **`resolveFood(input)`** 5-tier: exact alias → key/dashed → partial contains → substring → **Jaccard trigram fuzzy** (default `burger`). `getFoodImage(food)` wrapper.

## Gemini (`src/lib/gemini.ts`)
**Model: `gemini-2.5-flash-lite`** in tutti i call (1000 req/day free vs 20 di flash). Qualità identica per chat brevi, throughput ~400 tok/s. Pay-as-you-go: $0.10 input / $0.40 output per 1M tokens (6× più economico di flash).

**Persona v4 — friend naturale, conversazione vera, no terapia:**
- WHO: chubby axolotl, emotional support friend, like a buddy texting at midnight
- VOICE: real person not chatbot, contractions, casual phrasing, natural reactions, match energy
- HOW: 2-3 complete sentences, **40-60 words**, end every sentence with `.!?` (NEVER trailing dots/ellipsis), end with one natural open question
- DO NOT QUOTE USER'S WORDS BACK in quotation marks (sounds robotic) · don't analyze every line · just respond like a friend
- IF WEIRD/CASUAL/OFF-TOPIC: roll with it like a friend would, no therapy framing
- IF ADVICE REQUESTED: gently redirect to what's underneath
- IF HARSH/ANGRY: stay calm, don't flinch, no lecture
- EMOJI: drop in occasional emoji (`🌊 🍕 😅 ☁️ ✨ 💜 🙌` etc) when it fits the moment — max 1 per reply, not every reply
- AVOID: clinical jargon (triggers/coping/emotional eating), "you should/have you tried", food moralizing, "...", "…"

**Architecture refactor — single-shot + synthetic typewriter:** lo streaming raw Gemini chunk-by-chunk causava bug ("Sometimes you" tagliato, "......" filler). Ora:
1. `generateNoitReply(ctx, signal)` chiama `generateContent` (NON `generateContentStream`) — un solo shot completo
2. **Auto-retry** con budget maggiore se `finishReason === 'MAX_TOKENS'` || ends trailing dots || no terminator. First call `maxOutputTokens: 300`, retry: 500
3. **Cleanup deterministico** su testo completo: `truncateToWordLimit(120 abs)` + `trimDanglingClause` (strip `[.…]{2,}\s*$`, collapse internal, close with `.` if no terminator)
4. `streamConversation` wrappa: chiama `generateNoitReply` → `playbackAsTypewriter(text, onChunk, signal)` che splitta in `/\S+\s*/g` tokens ed emette ogni 35ms — **effetto typing naturale ma testo sempre completo e validato**
5. AbortSignal interrompe sia generazione che playback
6. Fallback "Sorry, I got distracted for a second!" se eccezione (es. quota 429)

**Config:** `temperature: 0.95` + `topP: 0.95` per output naturale/vario. `ABSOLUTE_MAX_WORDS=120`.

**`buildSessionPrompt`** snello: persona + context (food/mood + prior sessions) + conversation history + "Just continue the conversation naturally — like a friend texting back. 2-3 sentences, 40-60 words. End every sentence with proper punctuation (no trailing dots). Output only the reply text."

**`generateRecap` v2 (logica corretta, lunghezza invariata 70w):** filtra messaggi vuoti, calcola `moodArc` (lifted/shifted/steady da delta), prompt journal entry FOR you FROM Noit. Rules: quote ONE concrete user word (no invent), name emotion under craving (not food), reference mood arc honestly, NO affermazioni generiche/advice/"next time", se conversation breve/silent → be honest don't fabricate. `maxOutputTokens 180` temperature 0.7. `truncateToWordLimit(80)`.

**Functions:** `streamConversation(ctx, onChunk, onDone, signal)` (single-shot + typewriter playback) · `generateNoitReply(ctx, signal)` (internal, full reply with retry) · `playbackAsTypewriter(text, onChunk, signal)` (35ms per token via `sleep(ms, signal)`) · `streamBreathingGuide(phase, ...)` · `generateRecap(ctx)` (rifatto v2) · `interpretBreatheReflection(ctx)` · `generateInsight(patterns)` · `generateMilestoneMessage(days)` · `checkCrisis(text)` · `truncateToWordLimit(text, max?)` · `trimDanglingClause(text)`.

**Session-store integration:** `sendMessage` riceve `onDone(finalCleanText?)` — se il testo finale differisce dall'accumulato (cleanup ha modificato), sostituisce la bubble messaggio finale via `set((s) => ({ messages: s.messages.map(...) }))` come safety net. In pratica raramente triggera ormai perché il typewriter playback riproduce SOLO il testo già validato.

## Notifications system
Tipi: `session_reminder` · `daily_check_in` · `streak_milestone`.
**Message UUID** (`session-store.newMsgId()` — counter + Date.now() + Math.random base36). `Message.id` obbligatorio.
**NotificationCenter** (~165 righe) — Modal full-screen `PurpleBg`. Header back + "Mark all read". White cards (unread bordo purple). Item: emoji + title + body 2-line + timeAgo + dot. **Long-press → delete**. Empty Noit `happy`. Footer hint.
**Push** (`src/lib/push-notifications.ts`): `registerForPushNotifications()` · `savePushToken(userId, token)` · `scheduleDailySessionReminder(timeStr)` (Expo DAILY) · `cancelSessionReminder()` · `sendLocalNotification()`.
**Templates** (`src/lib/notification-templates.ts`): zero Gemini cost. `DAILY_BY_WEEKDAY` 14 (Lun/Mer/Ven motivation, Mar/Gio breath, Dom/Mer/Sab check-in) · `STREAK_MILESTONES` 6 · `RETURN_TEMPLATES` 3 inactive ≥3d. Token replacer `{name}`/`{streak}`/`{days}`/`{topFood}`.
**Daily runner** (`maybeCreateDailyNotification`): idempotente via `Storage.getString('noit.last_daily_notif')`. Inactivity ≥3 → return notif. Else daily by weekday.
**Bootstrap `_layout.tsx`** post profile load: realtime subscribe + preload + savePushToken + maybeCreateDailyNotification. Cleanup `realtimeUnsub` on sign-out.

## Data export & Account deletion (GDPR)
**CSV espanso** (`src/lib/data-export.ts`) — `exportUserDataAsCsv(userId)`: parallel fetch + `fetchSessionStats` 3 range (all-time/30d/7d). Sezioni:
- `=== ACCOUNT ===` (incl. `reminder_presets`, `topics`, `disclaimer_accepted`)
- `=== HISTORY — SESSIONS ===` · `=== HISTORY — DAILY MOODS ===`
- `=== INSIGHTS — SUMMARY ===` (totals, avg before/after/delta, best_time_of_day per range)
- `=== INSIGHTS — TOP CRAVINGS (mood by craving) ===` (food, count, avg_before, avg_after, avg_delta)
- `=== INSIGHTS — MOOD SERIES OVER TIME ===` (bucket label, before, after)
- `=== INSIGHTS — BEST TIME OF DAY ===` (time_of_day, range_label, avg_mood_delta)
- `=== INSIGHTS — WHEN YOU CRAVE (heatmap) ===` (weekday × 6 hour buckets)

Via `expo-file-system/legacy` UTF8 + `Sharing.shareAsync` OS share sheet.
**Account deletion** (`src/lib/account-deletion.ts`) — `Promise.allSettled` su sessions+daily_moods+notifications → `DELETE FROM users`. NON cancella `auth.users` (richiede Edge Function `delete_own_auth_user()` con service_role — placeholder commentato in migration).

## SessionStats — extended (`src/lib/supabase-sessions.ts`)
`fetchSessionStats(userId, since, mode?)` calcola tutto client-side. Campi:
- `total`, `feedCount`, `breatheCount`, `avgMoodBefore/After/Delta`, `totalDurationSec`
- `byWeekdayHour: number[7][6]` heatmap (weekday Mon-first × 6 hour buckets `HOUR_BUCKETS` 12a/4a/8a/12p/4p/8p)
- `moodSeries: MoodPoint[]` (7 bucket adattivi al range via `buildMoodSeries(rows, since, now)` — labels weekday se ≤8gg altrimenti month/day)
- `topFoods: TopFood[]` top 5
- `deltaByHourBucket: (number|null)[6]` avg delta per bucket
- `bestTimeBucket: {label, avgDelta}|null` bucket con highest delta (require ≥1 session)
- `moodByFood: {food, count, avgBefore, avgAfter, delta}[]` per top 5 foods

`WEEKDAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']`. `HOUR_BUCKETS` esportato.

## File Structure
```
src/app/_layout.tsx (auth listener + bootstrapUserSession) · index.tsx (Google OAuth) · onboarding.tsx (7 steps) · session.tsx (food→mood→choice→active→end-mood→reflect?→end + ExitConfirmModal, messages NOT persisted)
src/app/(tabs)/ home.tsx (PulseCard+TodayMoodDisplay before/after) · history.tsx (range+calendar+ModeTabs+SessionDetailModal+PulseCard ovunque) · insights.tsx (mood chart adattivo+heatmap weekday×hour+switch Avg/BestTime+switch Top/MoodByCraving+PulseCard) · profile.tsx (PulseCard hero/stats/menu · Notifications tap-to-select tap-again-to-edit · Privacy/Help · CSV expanded · delete · sign out)
src/components/ Noit.tsx (9 variants + bib lacci silhouette + forchetta vera + eye sparkles + static prop) · NoitMini.tsx (wrapper su Noit static + noitVariantForMood helper) · SessionDetailModal.tsx (recap-only) · PurpleBg · TabBar · MoodCheckin · TodayMoodDisplay (before→after NoitMini) · CalendarPicker · PaywallModal
src/features/notifications/ NotificationCenter.tsx · notification-store.ts
src/lib/ auth-store (signOut clear locale immediato) · session-store (messages:[] no persist) · supabase · supabase-sessions (SessionStats extended) · supabase-notifications · push-notifications · notification-templates · daily-notification-runner · data-export (5 nuove sezioni INSIGHTS) · account-deletion · gemini (persona v3 friend+advice/violent handlers, sentence-aware streaming, recap v2 moodArc) · food-registry · format · use-pulse · storage · i18n
src/translations/ en.json + it.json
src/types/index.ts NoitState 9 + Message.id + Notification.data? + User.reminder_presets + User.push_token
supabase/migrations/ schema.sql + fase3_notifications_and_deletion.sql (push_token, reminder_presets, data jsonb, DELETE policies, 3 indexes)
```

## Key Patterns
**Zustand atomic selectors** · **Reanimated SVG** `useAnimatedProps` NOT `useAnimatedStyle` · **Noit useEffect split + static prop** · **Eating geometry** body cresce → fins+feet riposizionati · **NoitMini = Noit static** wrapper safe per liste (no Reanimated overhead) · **noitVariantForMood** (5 stati visivamente DISTINTI): 1→`eating` (X eyes, knocked out), 2→`eyes_closed` (heavy), 3→`curious` (pupils up-left), 4→`wink` (playful), 5→`happy` (beaming) · **PulseCard ovunque** (Home+History+Insights+Profile) via `useSyncPulse` shared makeMutable · **Calendar** measureInWindow Modal escape · **Crisis** client-side BEFORE sendMessage · **Choice** select-then-Continue · **Replay** timeoutsRef cleared every call · **Food matching** never throw (Jaccard fuzzy) · **Breathe ≠ Feed recap** (chat vs reflection) · **formatDuration** sempre · **ModeTabs filter** `mode?` param · **Zero-orphan DB** session vive in-memory finché non completa flusso end → SOLO ALLORA `insertCompletedSession()` · **Messages NOT persisted** (privacy + storage) · **Single-shot Gemini + typewriter playback** (full reply validated, 35ms per token playback, AbortSignal-aware) · **Auto-retry on truncation** (MAX_TOKENS/trailing dots/no terminator) · **Recap v2 moodArc** quote ONE word, no parrot, no advice · **Editable reminders** tap-select tap-again-to-edit + persist `user.reminder_presets` JSONB · **Multi-delete History** trash button in ModeTabs → select mode → `Promise.all(deleteSession)` · **Insights stats client-side** (best time, mood by food, heatmap, mood series adattivo — zero nuove SQL) · **CSV multi-section** include analytics 3 range · **SignOut**: auth-store clear locale FIRST poi `supabase.auth.signOut()` (no race) + `router.replace('/')` belt-and-suspenders · **Privacy/Help modal** full-screen `PurpleBg` + Noit hero + card bianca `borderTopLeftRadius:30` · **ViewBox extended** `-20 -22 240 252` height×1.15 per mai tagliare hands/feet/fork/plumes.

## Environment
```
EXPO_PUBLIC_SUPABASE_URL= · EXPO_PUBLIC_SUPABASE_ANON_KEY= · EXPO_PUBLIC_GEMINI_API_KEY= · EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID= · EXPO_PUBLIC_REVENUECAT_IOS_KEY= (TODO) · EXPO_PUBLIC_REVENUECAT_ANDROID_KEY= (TODO)
```

## ✅ Done (latest session — Skia migration COMPLETA in codice)
- **Tutte le 9 varianti Skia in `noit-skia.tsx`** (vedi §Skia Migration): aggiunte le 8 mancanti (`happy` `curious` `wink` `excited` `listening` `thinking` `eating` `eyes_closed`) all'`idle` già fatto, conversione 1:1 da `Noit.tsx` (stesse coordinate/path/timing). `eating` con geometria-corpo diversa; `listening`/`thinking` con tilt + ear-fin. Helper `ovalRect([cx,cy,rx,ry])` (tupla per `max-params`).
- **Aura + sparkle in Skia**: aura `RadialGradient` Skia (Canvas overlay separato, stessi stop dell'SVG) + 3 stelle sparkle animate; props `glow`/`showSparkles`/`static` rispettate.
- **Swap globale `Noit` → wrapper di `NoitSkia`**: `Noit.tsx` ridotto a ~20 righe (`return <NoitSkia {...props} />`) + ri-esporta `NoitVariant`/`NoitProps`. `NoitVariant` ora definito in `noit-skia.tsx` (canonical, niente import circolari). **TUTTE le ~13 schermate ora rendono Skia senza modifiche.** SVG originale in git history.
- **Usi TEMP ripristinati**: auth `index.tsx` → `<Noit happy 180>` (rimosso import `NoitSkia` diretto, restano gli SVG leggeri stelle bg + icona Google), onboarding step1 → `<Noit idle 200>`.
- **Verifica**: `tsc --noEmit` exit 0; eslint `noit-skia.tsx` 0 errori (2 warning `exhaustive-deps` intenzionali). **`eas update --branch preview` pubblicato** per validazione device.
- **Diagnostici TENUTI di proposito** (ErrorBoundary + global handler + `crash-screen.tsx`): safety net per errori JS durante la build di verifica → rimuovere SOLO dopo conferma device "zero crash".

## ✅ Done (precedente — Skia migration setup + build infra)
- **Skia migration avviata** (vedi §Skia Migration): `noit-skia.tsx` con variante `idle` GPU completa (conversione 1:1 da SVG, stesse coordinate/path/timing, lint-clean), montata TEMP in pagina auth per validazione device. `Noit.tsx` SVG intatto. Decisione: riscrittura completa Skia a step (idle prototipo → 8 varianti → aura/sparkle → swap finale).
- **EAS Update OTA configurato**: `expo-updates@29` installato, `app.config.ts` con `updates.url` + `android.runtimeVersion {policy: appVersion}`. Flusso build-1-volta + `eas update --branch preview` per iterare JS senza ri-build.
- **Env preview caricate su EAS** (5× `EXPO_PUBLIC_*`: Supabase URL+anon, Gemini, Google web+android). Service role key esclusa. Prima la `preview` env era VUOTA → build sarebbe partita senza chiavi.
- **Pacchetti SDK 54 allineati** (`expo install --fix`): expo 54.0.35, expo-router 6.0.24, expo-font 14.0.12, expo-localization 17.0.9, expo-file-system 19.0.23.
- **Audit device-reale preventivo** (6 punti, vedi §Build & EAS Update) — da verificare sulla build preview prima di fixare.
- **Device-test build #1 + diagnosi crash** (vedi §Device-test findings): NoitSkia idle resa OK + blink fixato + auth Google OK. **SCOPERTA DECISIVA: il crash post-auth è il Noit SVG che crasha NATIVAMENTE il device** (provato: step onboarding con NoitSkia regge, con Noit SVG crasha). Notifiche/insert/nav SCAGIONATE. ⇒ **serve convertire TUTTE le mascotte in Skia** (non opzionale, l'app crasha con SVG su questo hardware). Aggiunti: fix push notif (hardening, tenuto), ErrorBoundary+global handler diagnostici (`crash-screen.tsx`, da rimuovere a fine), EAS Update verificato funzionante.
- **`HANDOFF-SKIA.md` creato** — piano operativo completo per la nuova chat: metodo conversione SVG→Skia 1:1, regola transform Skia (scale=translate manuale no-origin / rotate=rotateZ+origin), 8 varianti da fare con geometria da `Noit.tsx`, piano a step, swap globale finale, cleanup diagnostici.

## ✅ Done (mascot redesign session)
**Mascot redesign:**
- **Axolotl head plumes** (3) sostituiscono "orecchie laterali" — anatomia axolotl reale, two-tone outer+inner highlight, posizionate IN ALTO sulla testa con rotate ±22°. Antenna+stella RIMOSSA.
- **3 mini-stelle gialle** sulle punte dei piumini (left/center bigger/right), animate via `antennaProps` per soft sway, coordinate diverse per `eating`.
- **Bib visibile in TUTTI gli stati** (incluso `eating` con geometria scalata). Posizione più bassa e correttamente posizionata, 2 horizontal straps al posto dei verticali.
- **Forchetta verticale (no rotate)** posizionata SULLA mano destra, grip centrato a y 118 = centro fin. Colori più visibili (`#E8E4F4` body + `#5C3E9C` outline).
- **ViewBox extended** `-20 -22 240 252` (size×1.15) per mai tagliare mani/piedi/forchetta/piumini.

**Session & DB:**
- **Zero-orphan DB pattern**: rimosso `createSession`+`finalizeSession`. `insertCompletedSession()` chiamato SOLO a fine flusso. Qualsiasi exit → in-memory reset, mai righe DB orfane. `deleteSession` esportato.
- **MoodPicker NoitMini swap**: 5 cards con NoitMini (42px) invece di emoji. Mapping: 1→`eating`, 2→`eyes_closed`, 3→`curious`, 4→`wink`, 5→`happy`.
- **ReflectScreen NoitMini swap**: "You came in feeling [NoitMini] · now [NoitMini]" inline al posto degli emoji.
- **EndScreen chip NoitMini swap**: chip con NoitMini 24px + label, no più emoji.
- **MoodCheckin NoitMini swap**: AnimatedMoodNoit (era AnimatedEmoji), btn 56px.
- **TodayMoodDisplay empty state**: NoitMini `curious` 44px al posto di ✨.

**History UX:**
- **Multi-delete via select mode**: trash icon nei ModeTabs (`marginLeft: 'auto'`) → entra in select mode. Checkbox `#7B5BA9` su ogni row, header bar "N selected" + Cancel/Delete. `Promise.all(deleteSession)` parallelo.
- Rimosso long-press (UX più chiara).

**Profile UX:**
- **Reminder time picker fix**: `overflow: 'hidden'` + `width: '100%'` per TextInput → niente più overflow quando si edita. Long-press apre edit su qualsiasi chip.

**Chat UX (Gemini overhaul):**
- **Model switch**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` (1000 req/day free vs 20, $0.10/$0.40 per 1M tok vs $0.30/$2.50).
- **Single-shot + synthetic typewriter**: eliminato streaming raw che causava "Sometimes you" / "......". Ora: `generateNoitReply` con auto-retry → `playbackAsTypewriter` 35ms/token.
- **Persona v4** naturale, no terapia: "Don't quote user's words in quotation marks. Don't analyze every single thing. Just respond like a friend would." Word count 40-60, no trailing dots ANYWHERE.
- **Emoji**: Noit ora occasionally usa emoji (`🌊 🍕 😅 ☁️ ✨ 💜 🙌`) max 1× quando fits.
- **trimDanglingClause**: strip trailing `[.…]{2,}`, collapse internal `....`→`.`, close with `.` if no terminator.
- **Auto-retry**: detecta `MAX_TOKENS` / trailing dots / no terminator → retry con maxOutputTokens 500.
- **Session-store integration**: `onDone(finalCleanText?)` safety net per rimpiazzare bubble se cleanup ha modificato.

**Done precedenti:** Auth · Onboarding 7 steps · Supabase schema+RLS+trigger · 4 tabs · Streak (toLocalYmd) · PurpleBg/TabBar · useSyncPulse · Week bars · CalendarPicker · PaywallModal · Gemini crisis · ExitConfirmModal · Notifications toggle+TimePicker · Message UUID · Feed eating anim v2 · BreatheScreen v2 + ReflectScreen · History/Insights real data · NotificationCenter · Push notif · Template-based notif · Daily runner · Streak milestone trigger · Bootstrap · Account deletion (RLS DELETE) · Privacy/Help modal · Legacy cleanup · i18n stub · Bib v1 + Forchetta v1 + NoitMini wrapper · TodayMoodDisplay before→after · SessionDetailModal · Insights switch panels · SessionStats extended · PulseCard ovunque · Reminder editable · Sign out fix · Recap v2 moodArc · Messages NOT persisted · CSV export espanso.

## 🚧 TODO
**PRIORITÀ — Skia migration: validare su device** (codice COMPLETO + `eas update` pubblicato; verificare zero crash su onboarding/chat-eating/breathe + resa di tutte le 9 varianti + NoitMini nelle liste — vedi §Skia Migration) → **poi** rimuovere diagnostici TEMP (`crash-screen.tsx` + ErrorBoundary/global handler in `_layout.tsx`) → build preview finale · **Audit device-reale** (6 punti da verificare su build preview — safe area, SHA-1 Android, keyboard, POST_NOTIFICATIONS, font Inter/DM Sans, expo-image food) · RevenueCat · Noit customization · Streak freeze (Pro) · Milestone celebration UI · Share card 9:16 · Push notif server-side (Edge Function) · `delete_own_auth_user()` Edge Function · Privacy policy URL · Web polish · IT translations · Asset food popolari mancanti.
