# CLAUDE.md — Cartomanzia AI App

App mobile tarocchi AI + vetrina cartomanti. Target: Italia. **Status:** FASE 11-21 done. ⏳ Prossimo: rebuild APK (Skia mascotte + nav bar immersive) + RevenueCat nativo + share nativo + history insights.

**Stack:** Expo 54 / RN 0.81.5 / TS strict / Expo Router 6 · Supabase + Google OAuth · Zustand + React Query + Zod · Gemini Flash 2.5 streaming · Reanimated 4 + Gesture Handler.
**Native key deps:** `@react-native-async-storage/async-storage@2.2.0` (storage: cache in-memory + AsyncStorage backing) · `expo-notifications@~0.32.13` · `@shopify/react-native-skia@2.2.12` (DivineMascot — richiede rebuild, non basta `eas update`) · `expo-image-picker` + `expo-file-system` (avatar) · RevenueCat stub (richiede `react-native-purchases`). ❌ Non compatibile con Expo Go → serve Dev Client APK.

---

## Tabs & Ruoli

**USER:** 🏠 Home · 🔮 Letture · 🃏 Carte · 📚 Storia · ⚙️ Impostazioni
**CARTOMANTE:** 🏠 Home · 📊 Analytics · 🃏 Carte · ⚙️ Impostazioni

- **Home User:** Search + chips (Spec/Regione). Card cartomante: foto, nome, social (WA/IG/TG/TK). Solo `UserProfileModal` overlay. Query `!inner` join users per RLS is_public.
- **Home Cartomante:** Profilo proprio + lista utenti. Bottone "Manda una carta".
- **Reading:** Questionnaire → 5 spread (sotto). Covered cards (tap rivela) + AI streaming background. Save+Share.
- **Cards:** Grid 78 carte 5-col (70×110px fissi), filtri arcana, modal ScrollView. `ALL_CARDS` da `tarot-cards.ts`.
- **History:** Timeline verticale + filtri data/spread. Insights: deck preferito, trend mensile. Colonne derivate da `cards/followups/context` JSONB.
- **Analytics:** Line chart visite + bar chart social clicks + lista "Chi ti ha visitato" (avatar 40px, fallback initials in cerchio #5a2d9a/#D4AF37, data "Ieri 14:30"/"3 giorni fa", badge "3x"). Hook `useVisitorList(cartomanteId, period, customStart, customEnd)` → `profile_visits` join `users`, group by visitor_id, sort last_visit DESC, limit 20. Charts: SVG nativo (react-native-svg), no Victory/Recharts.
- **Impostazioni:** Preferenze (Lingua IT, Notifiche, Profilo pubblico) · Account (Abbonamento/Profilo modal) · Esci.

---

## Onboarding

```
Login Google → _layout.tsx legge user.role_completed
  false → /onboarding:
    0 RolePicker (USER|CARTOMANTE, non skippabile)
    1 AvatarStep (uploadAvatar() — base64, bucket 'avatars/')
    2 BioStep (bio + spec PRESET + regione testo libero + social — cartomante only)
    3 SubscriptionStep (4 tier)
    → updateUser({role_completed:true}) → WelcomeScreen (DivineMascot fade-in 800ms, pausa 2.5s, dissipa 1200ms) → /(tabs)/impostazioni
  true → /(tabs)/impostazioni
```
`handleFinish()` imposta step='welcome'. `_layout.tsx`: expo-splash-screen nasconde flash auth; redirect sempre a `/(tabs)/profile`.
**Responsive (Android):** card/mascotte usano larghezza px da `Dimensions` (card `Math.min(screenW-40, 480)`, mascotte `Math.min(screenW-80, 280)`) — `width:'100%'` in ScrollView centrato sfora su Android.

---

## Database

**Tabelle:** `users` (id, email, name, avatar_url, bio, role, role_completed, subscription_status, is_public, notifications_enabled, birth_date DATE, birth_time TIME, interesse_specifico, regione) · `user_preferences` · `cartomanti` (bio, specializzazioni, genere, eta, regione, social_links JSONB) · `readings` (cards JSONB, followups JSONB, summary, context JSONB) · `daily_cards` · `notifications` (type: ping|daily_card|profile_visit|social_click, actor_id) · `profile_visits` · `social_clicks` · `dream_symbols`

**RLS:** users (is_public OR own; own update) · cartomanti (public read, own update) · readings (own) · notifications (user_id=uid + actor_id=uid per sent pings) · profile_visits/social_clicks (owner) · avatars storage (5MB, owner)

**Migrations:** `001` jsonb · `002` settings+study · `003` sent pings RLS + social_links · `004` birth_date+time · `005` fix prod schema.
⚠️ **DB prod disallineato:** `schema.sql` base NON ha `is_public`/`notifications_enabled`/`birth_date`/`birth_time` su users, manca `situazioni` in deck_type enum e `study`/`relations`/`generale` in life_area enum. Migration `005` li aggiunge idempotente (solo ADD COLUMN/ADD VALUE, no DROP). **Eseguire in 2 blocchi separati** su Supabase SQL Editor: prima `ALTER TABLE`, poi `ALTER TYPE ... ADD VALUE` (questo non gira nella stessa transazione che usa il valore). SQL indipendente da update/build.

---

## Pricing

| Tier | Costo | Features |
|------|-------|----------|
| Free | €0 | 1 Veloce/sett + 1 Daily/g, max 10 |
| Premium | €4.99/mo | Illimitate, cronologia, share |
| Pro | €9.99/mo | + Celtic Cross 20x/mese, insights |
| VIP | €19.99/mo | Tutto illimitato, priority AI |

Costi AI ~€0.002/lettura. Cartomanti badge €4.99/mo (post-MVP).

---

## File Structure

```
src/
├── app/
│   ├── _layout.tsx — root layout, auth gate, SafeAreaProvider, initCache gate
│   ├── index.tsx — auth screen Google login (TitleBox inline, oro, Georgia letterSpacing 5)
│   ├── onboarding.tsx — 4-step + welcome
│   └── (tabs)/ — _layout (RoleProvider+TabBar) · home · impostazioni · analytics · cards · reading · history
├── components/ui/ — ElaborateFrame · TitleBox · SearchBar · Chips · GoldButton · TabBar · DivineMascot · ParticlesIcon
├── features/ — reading/ · onboarding/ · role-provider/ · notifications/ · ping/ · home/
├── lib/ — supabase · auth-store · gemini · supabase-readings · profile-tracking · daily-ritual · storage · i18n · revenuecat · audio-manager · google-tts · avatar-upload
├── data/ — tarot-cards.json (EN) · tarot-cards-it.json (IT)
├── assets/ — tarot-cards/ (78 img CC0) · audio/background.mp3 · splash.png
├── types/index.ts — User · LifeArea ('love'|'work'|'money'|'health'|'spiritual'|'study'|'relations') · ReadingContext
└── global.css — #140d2e · #D4AF37 · #5a2d9a
```

---

## Reading Flow

**Fasi:** `deck_selection → questionnaire → shuffling → revealing → interpreting → followup → saving`

**Spread (5):** Tre Carte · Celtic Cross · Sincronicità · Sogni · Situazioni.
**Questionnaire per spread:**
- Tre Carte: urgency nascosta, label "Passato → Presente → Futuro"
- Sincronicità: domanda obbligatoria
- Sogni: freeContext obbligatorio ("Descrivi il sogno"), urgency nascosta
- Situazioni: freeContext obbligatorio ("Descrivi la situazione"), urgency nascosta
- Celtic Cross: tutti i campi
- Life Area chips: ❤️ Amore · 💼 Lavoro · 💰 Finanze · 🏥 Salute · ✨ Spirituale · 🎓 Studio · 🤝 Relazioni

**Followup dinamico:** sincronia=1 · tre_carte=3 · celtic_cross=5 · situazioni=3 · default=3
**Sogni/Situazioni:** `selectDreamCards()` / `selectSituationCards(text, emotionalState, lifeArea)` → Gemini sceglie 5 carte in background. `Promise.all()` + min 1.2s prima di revealing.
**Saving:** `generateReadingSummary()` → max 60 parole. Schema cards/followups/context come JSONB (non `jsonb[]`).
**Shuffle 3-tap:** Tap1=Mescola (swirl+sway, Easing.bezier+Easing.out) · Tap2=Energia (ventaglio) · Tap3=Rivela (raccolta+revealing dopo 500ms). No auto-timeout. `revealStartedRef` evita doppio trigger. CardSwayTranslateY pre-computato in useRef (no new Animated.Value in render).
**Revealing:** Carte coperte, tap per girare una alla volta. **Tap SOLO sulla carta** (FASE 21): niente più `Pressable` a tutto schermo; ogni `TarotCardItem` gestisce il proprio tap. La prossima carta (`i === revealedCount`) mostra un **punto dorato pulsante** (`tapDot`, loop `Animated.loop`) e risponde al tap; le successive coperte no (rivelazione in ordine). `CardReveal` riceve `onRevealCard`. AI streaming background simultaneo. Hint "TAP per rivelare · X/Y". Auto→`interpreting` quando `revealedCount >= cards.length`. DivineMascot SEMPRE visibile (anche in interpreting con testo). No bottone "APPROFONDISCI".
**Celtic Cross 4 fasi:** Tap rivela gruppo → AI streaming. F1: carte 0+1, F2: 2+3, F3: 4+5, F4: 6-9. `celticPhase` + `celticPhaseTexts[]` in store. `streamGeminiCelticPhase()`.
**Daily Card Deepening:** "Approfondisci" in DailyCardDetail pre-popola `freeContext` con carta del giorno → `/(tabs)/reading`. Daily card auto-creata all'avvio home (solo user) via `getTodayDailyCard(userId)` + notifica DB + realtime.
**Profile Tracking:** `trackProfileVisit(cartomanteId)` / `trackSocialClick(cartomanteId, platform)` in `@/lib/profile-tracking` (NON `daily-ritual`).

**Persist (AsyncStorage):** auto-save su phase change, key `'reading_in_progress'`. `PERSISTABLE_PHASES`: questionnaire, shuffling, revealing, interpreting, followup, saving, dream_input, celtic_phase*. Salva: phase, deckType, emotionalState, lifeArea, urgency, cards, revealedCount, aiText, followups, freeContext, userQuestion, dreamText, celticPhase, celticPhaseTexts. Recovery banner in deck_selection. `restoreFromStorage()` auto-popola `revealedCount`: interpreting/followup/saving/celtic_phase*/revealing → `cards.length`; altre → 0. `hasPersisted()` check.

---

## Gemini (`src/lib/gemini.ts`)

**Model unificato:** tutti gli stream usano `gemini-2.5-flash`.
**`streamWithFallback(prompt, onChunk, signal, label)`** (helper interno, ESSENZIALE per release Android): stream + fallback non-stream `generateContent` se 0 chunk + `describeGeminiError()` (distingue chiave/rete/quota/safety). Usato da TUTTE le 5 funzioni stream — senza, il followup/dream/situation/celtic falliva in release (solo reading aveva il fallback).
**Robustezza:** `chunk.text()` in try-catch (continua stream se malformed), fallback `ctx.free_context || ''`, `buildCardList()` fallback a `c.name` se `c.name_it` manca.

**Funzioni:**
- `streamGeminiReading(ctx, onChunk, onDone, signal, prior)` — con prior readings per pattern. `buildPrompt()` include user_question + free_context + letture precedenti. Avviato su `revealing`.
- `selectDreamCards(text, emotionalState, lifeArea): Promise<string[]>` — 5 id carte
- `selectSituationCards(text, emotionalState, lifeArea): Promise<string[]>` — 5 id carte
- `generateReadingSummary(...): Promise<string>` — max 60 parole, 3a persona
- `streamGeminiDreamInterpretation(ctx, onChunk, onDone, signal)`
- `streamGeminiSituationInterpretation(ctx, onChunk, onDone, signal)`
- `streamGeminiFollowup(prevAnswer, followupQuestion, onChunk, onDone, signal)` — max 80 parole
- `streamGeminiCelticPhase(phase, cards, texts, ctx, onChunk, onDone, signal)`

**Persona CARTOMANTE:** 30 anni arcani/numerologia/psicologia junghiana. IT formale diretto mai melodrammatico, connetti carte tra loro e al contesto, evidenzia tensioni, 1a persona, max 180 parole, chiudi con azione concreta/domanda al nucleo.
**Persona DREAM_ANALYST:** psicologo junghiano. IT formale empatico, simboli come messaggi inconscio (non previsioni), nomina archetipi (Ombra/Anima/Sé), max 180 parole, chiudi con domanda aperta.
**Persona SITUATION_ANALYST:** consulente relazionale. IT formale pragmatico mai moralista, analizza forze/tensioni/risoluzioni, risorse + ostacoli, max 180 parole, chiudi con azione concreta.
⚠️ Cache: system prompt identico byte-per-byte ogni call.

---

## UI Design

**Colori:** BG `#140d2e` · Card `rgba(36,21,80,0.97)` · Accento `#5a2d9a` · Oro `#D4AF37` · Dim `#a890c8`
**Layout pagine:** `View screen` + `ElaborateFrame` + `View inner (zIndex:5)` + `TitleBox (paddingTop:40)` + `TabBar`. ❌ no `SafeAreaView`. Root in `SafeAreaProvider` (_layout.tsx); ElaborateFrame usa `useSafeAreaInsets()` per width/height effettivi (notch/gesture bar), SVG con `top:insets.top, left:insets.left`.
**Modal (stile NotificationCenter):** transparent + fade + overlay `rgba(10,6,25,0.92)` + container `maxWidth:480, maxHeight:'85%'`, bordo oro, `borderRadius:16`. Pre-populate via `useEffect` deps `[visible, user?.id]` (evita dati stale).

**DivineMascot** (34 particelle oro/viola dense al centro, 9 scintille, orb luminoso centrale):
- **Render SKIA** (`@shopify/react-native-skia` `Canvas`): tutto in una `<Canvas>` su GPU → fluido Android (l'SVG con 120 `AnimatedCircle` faceva laggare TUTTA l'app). Glow via `<Group><BlurMask blur={10}/></Group>`. **Orb centrale** = 2 `<Circle>` sfocati sovrapposti (viola r=orbR + oro r=orbR×0.62, `BlurMask blur={22}`) con pulsazione `orbOpacity` — alone sfumato SENZA `RadialGradient` (scelto per stabilità Android, vedi FASE 21). Core nitido + puntino bianco. 1 clock `useSharedValue` (Reanimated, `withRepeat` 22s a `LOOP=2π×1000`) → `useDerivedValue` worklet per `cx/cy/opacity`. Particelle clampate `minX/maxX`.
- **Compatta (FASE 21):** box `H=104`, default `width=260`. Distribuzione radiale concentrata (`distFactor=sqrt`, `spread=Math.min(64, width*0.26)`) → presenza densa, non dispersa. ⚠️ **Nativo → richiede `eas build`** (non `eas update`). Solo Skia, niente fallback SVG.
- **Animazione ciclica (no salto):** ogni frequenza è `periodicFreq()` = numero INTERO di cicli in `LOOP` → a `t=LOOP` sin/cos tornano al valore iniziale, il riavvolgimento di `withRepeat` è invisibile. ❌ Prima `withRepeat(..., false)` su un range arbitrario faceva "teletrasportare" le particelle al riavvolgimento.
- Onboarding: width `Math.min(screenW-80, 280)`, messaggi per step. Welcome: width 380. Reading: width 170 (era 200), `position:absolute, top:50, zIndex:20, pointerEvents:none`, SEMPRE visibile in revealing+interpreting (nascosta in followup/saving). Shuffle: width 240. Celtic: width 240. Non-Celtic showMascot=`phase==='revealing'||'interpreting'`; Celtic=`phase==='revealing'||phase.startsWith('celtic_phase')`.

**Card Reveal:** dimensioni fisse px (sogni 72×120, sincronia 90×150, tre_carte 70×117). `backOpacity` interpola `[0,0.45,1]→[1,1,0]`. `cardRevealPressable`: `flex:1, justifyContent:'flex-end', paddingBottom:12, minHeight:200`. Container `justifyContent:'flex-end'`. CardRow `alignItems:'center'`.

**FollowupPanel (chat unificata):** header con user avatar (30px) + nome/spread + 3 bottoni audio rotondi (26px: Musica SVG · Voce SVG · Play/Pausa) integrati DENTRO la chat (no barra esterna che sfora la cornice). `marginHorizontal:18, marginBottom:12`. bubbleText 12px/lineHeight 18, ParticlesIcon 24px. `getSpreadName()`/`getSpreadSub()` → subtitle "Lettura personale · NOME".

**Celtic Cross Layout:** `measureWrap` (flex:1) + onLayout misura reale; carte container `absoluteFillObject`. Carte 10% width (`cw=availW*0.10`). `colX=0.68`, gap `colGap=ch+5`, `availH=Math.max(ch*4+40, height*0.60)`, cy=55%. Carta 1 sovrapposta a 0 (`zIndex:10`), badge rosso rovesciata. `CelticCardItem` swap visW/visH se rotated.

**Tarocchi IT:** `tarot-cards-it.json` (78 carte, meaning_up/meaning_rev/desc). `getItalianCard(card)` match by `name_short` (id), fallback EN.

**Audio & TTS:**
- `audio-manager.ts`: `initAudio()`, `playBackground()` (0.35 vol loop), `fadeOutBackground()`, `playTtsAudio(base64)`, `stopTts()`, `pauseTts()`, `resumeTts()`, flags `bgEnabled/ttsEnabled`. `playTtsAudio()` NON ha guard `ttsEnabled` — controllo solo in React state `ttsOn`.
- `google-tts.ts`: `speakText(text, signal)` — chunking 800 char → Google TTS REST diretta (dev, key da `EXPO_PUBLIC_GOOGLE_TTS_API_KEY` + fallback hardcoded) → `playTtsAudio()`. Prod: Edge Function `tts` (deployata). `getLastSpokenText()`/`setLastSpokenText()` per resume vs nuovo testo.
- **Voce:** `it-IT-Standard-A`, MP3, `speakingRate 1.0`, `pitch -2.0`, `volumeGainDb 2.0`, `effectsProfileId ['headphone-class-device']`.
- **SSML `toSsml()`:** `<p>` wrapper, `<s>` per frase, `<break strength=strong/x-strong>`, `<emphasis level=moderate>` su parole mistiche. Rate alternato `1.05↔0.97`; frasi <45char → `rate 0.87`+`break x-strong`; domande → `rate 0.90`+`break strong`. Standard-A supporta `<break>/<emphasis>/<prosody rate>/<s>/<p>` (NO `<audio>/<par>/<seq>`). Non abusare `<prosody>` annidati (robotica).
- **Bottone TTS:** unico toggle. ttsOn → Play("Pausa") → Pausa("Riprendi"). Non visibile se `ttsOn=false` o `aiText.length===0`. Auto-lettura solo se `ttsOn=true` al finish Gemini. **Play legge l'ULTIMO messaggio** (FASE 21): `getReadableText()` ritorna l'ultima risposta followup se presente, altrimenti `aiText` — nel follow-up non rilegge l'interpretazione iniziale.
- **Tastiera + chat (FASE 21):** chatZone (non-Celtic + Celtic followup) avvolta in `KeyboardAvoidingView` (`behavior: 'padding'` iOS, `undefined` Android → si affida a adjustResize nativo, evita doppio adjust). FollowupPanel ScrollView: `keyboardShouldPersistTaps='handled'` + `keyboardDismissMode='interactive'` + auto-scroll `onFocus` input.

---

## Key Patterns

- Zustand: atomic selector `(s) => s.field`, ❌ no object selectors. `useSubscription()` default `'free'`. `updateUser(partial)` in auth-store.
- Animazioni: `useSharedValue` + worklets, `runOnJS` per side effects (❌ no setState in worklet). `useDerivedValue` in `.map()` → estrarre sotto-componente.
- FlatList numColumns: `key="grid-N"` sempre. Grid: dimensioni fisse px (❌ no `width:'100%'`+aspectRatio con numColumns).
- `TabId` include `'analytics'` (rimossi `'readings'`/`'settings'` obsoleti).
- Image path: `@/assets/` (Metro resolution, non relativo).
- Spec cartomante PRESET: Amore · Carriera · Spirituale · Salute · Famiglia · Perdita · Crescita personale. Regione: testo libero.
- Birth date: UI GG/MM/AAAA, DB AAAA-MM-GG. `split('/').reverse().join('-')` ↔ `split('-')` poi `[y,m,d]→d/m/y`.
- PingModal: `containerW=Math.min(width-40,480)`, `cellSize=Math.floor((containerW-12-5*6)/5)`.
- GoldButton conditional style: `StyleSheet.flatten([...])`.
- Storage gate: `initCache()` async in storage.ts → `_layout.tsx` attende `cacheReady` prima di `supabase.auth.onAuthStateChange` (altrimenti letture vuote).

---

## Common Issues & Fixes

- **Infinite re-renders** → atomic Zustand selector.
- **Animazioni lag / setState in worklet** → `runOnJS`.
- **Gemini "Errore nella lettura IA" (release)** → `generateContentStream` SSE fallisce in release Android. Fix: `streamWithFallback()` (stream + fallback `generateContent` se 0 chunk + `describeGeminiError()`). Applicato a TUTTE le 5 stream (era solo reading → followup/dream/situation/celtic KO).
- **Avatar "Network request failed" (Android release)** → `fetch(file://).blob()` fallisce in prod. Fix: `uploadAvatar(localUri, userId)` in `avatar-upload.ts` → `expo-file-system/legacy` `readAsStringAsync({encoding:Base64})` → base64→`Uint8Array` → `supabase.storage.upload(path, bytes, {contentType})`. URL con `?t=${Date.now()}`. ⚠️ `readAsStringAsync` è in `/legacy` (nuova API File ha breaking changes).
- **ProfileModal avatar non modificabile** → `Pressable` + `ImagePicker` + badge ✎. Upload in `handleSave`. `avatarUri` reset `null` su apertura (`useEffect [visible, user?.id]`). Rimuovere `overflow:'hidden'` da stile avatar (tagliava il badge) → `position:'relative'`.
- **Onboarding card sfora schermo (Android)** → `width:'100%'` in ScrollView centrato non vincolato. Fix: px via `Dimensions` (card `Math.min(screenW-40,480)`, mascotte `Math.min(screenW-80,280)`); rimuovere `width:'100%'`+`paddingHorizontal` da scrollContent.
- **DivineMascot lag / app lentissima (Android)** → 40 particelle × 3 `AnimatedCircle` SVG = 120 elementi a 60fps su CPU. Fix: riscrittura **Skia** (1 `<Canvas>` su GPU). ⚠️ serve `eas build`.
- **DivineMascot colori "morti" Android** → `shadow*` RN non funziona su Android. Fix finale: Skia (la soluzione SVG RadialGradient risolveva i colori ma causava il lag sopra).
- **DivineMascot particelle sforano width** → spread ridotto + `ampX` contenuto + clamp `minX/maxX` nel worklet.
- **DivineMascot "salto" animazione (teletrasporto particelle)** → `withRepeat(withTiming(20000), false)` riavvolgeva a 0 su sin/cos di un valore arbitrario → discontinuità. Fix: clock va a `LOOP=2π×1000`, ogni frequenza è `periodicFreq()` (cicli interi in LOOP) → a `t=LOOP` sin/cos coincidono con `t=0`, riavvolgimento invisibile.
- **DivineMascot orb / RadialGradient su Android** → per l'alone centrale evitare `RadialGradient` Skia (dubbio stabilità release Android). Usare 2 `<Circle>` sfocati sovrapposti in un `<Group><BlurMask blur={22}/>` → effetto alone sfumato, stabile.
- **Tastiera nasconde la chat (reading)** → chatZone in `KeyboardAvoidingView` (`padding` iOS, `undefined` Android: adjustResize nativo Expo default basta, `'height'` su Android dà doppio adjust/jump). ScrollView con `keyboardShouldPersistTaps='handled'`.
- **Tap rivela carta troppo permissivo (tutto lo schermo)** → rimuovere il `Pressable` wrapper a tutta la `revealZone`; passare `onRevealCard` a `CardReveal` e gestire il tap nel singolo `TarotCardItem` (solo `i === revealedCount`). Punto dorato pulsante (`tapDot`) indica dove toccare.
- **TTS rilegge dall'inizio nel followup** → il Play leggeva `aiText` (interpretazione iniziale). Fix: `getReadableText()` → ultima risposta followup se `answer` non vuota, altrimenti `aiText`.
- **Salvataggio lettura "Situazioni" fallisce (prod)** → enum `deck_type` base = `('tre_carte','celtic_cross','sincronia','sogni')`, manca `situazioni` → INSERT fallisce. Fix server: migration `005` (`ALTER TYPE ... ADD VALUE 'situazioni'`). Codice: `setSaveError` ora mostra `e.message` reale (non generico) + navigazione `router.replace` PRIMA di `handleReset()` (reset azzera lo store → evita flash su deck_selection).
- **Celtic Cross overflow** → `availH=Math.max(ch*4+40, height*0.60)`, gap `ch+5`, `colX=0.68`, distribuzione Y uniforme.
- **CardReveal non centrato** → container/pressable `flex:1, center, minHeight:200`; CardRow `alignItems:'center'`.
- **Shuffle lag** → CardSwayTranslateY pre-computed in useRef. Easing.bezier(0.25,0.1,0.25,1)+Easing.out(Easing.quad). ❌ no new Animated.Value in render.
- **Riprendi lettura carte assenti** → `restoreFromStorage()` auto-popola `revealedCount` per fase.
- **jsonb[] type mismatch** → `jsonb` default `'[]'::jsonb`.
- **History columns** → derivare da `cards/followups/context` JSONB (rimosse CSV/snapshot/count).
- **Profile tracking** → import `@/lib/profile-tracking` (non `daily-ritual`).
- **Home infinite loading** → `setLoading(false)` nel catch query.
- **Modal dati vuoti / stale** → `useEffect` dep `[visible]` (o `[visible, user?.id]`).
- **Sent pings cartomante** → RLS `actor_id = auth.uid()` su notifications.
- **Social links vuoti** → setSocialLinks sempre (anche `{}`).
- **Plurale "LETTURAE"** → ternario completo `${n!==1 ? 'letture' : 'lettura'}` (non `lettura${...?'e':''}`).
- **TTS 401/403** → dev: `GOOGLE_TTS_API_KEY` + TTS API abilitata GCloud. Prod: secret Supabase + `supabase functions deploy tts`.
- **TTS non parte al Play** → verificare `ttsOn=true`, `aiText.length>0`, `isPlaying=false` (no guard in `playTtsAudio()`).
- **Storage non pronto al mount** → gate `cacheReady` su `initCache()` in _layout.tsx.
- **ElaborateFrame clip notch/gesture bar** → `useSafeAreaInsets()`, SVG `top:insets.top, left:insets.left`, serve `SafeAreaProvider`.
- **AsyncStorage version mismatch** → SDK 54 vuole `@2.2.0`. `npx expo install --check`, NON installare 3.x.
- **splash.png colorType invalido (jimp prebuild)** → rigenerare con `sharp`: 1080×1920 RGBA (colorType 6), sfondo `#140d2e`, icona 300px.
- **Dev client APK non scarica bundle (404)** → firewall blocca porta 8081. `netsh advfirewall firewall add rule name="Metro Bundler" dir=in action=allow protocol=TCP localport=8081` (admin).
- **development profile genera AAB** → `"buildType":"apk"` sotto `android` nel profilo.
- **WebView/Skia in Expo Go** → solo build nativo (fallback Reanimated/SVG in dev).
- **Interrupt modal text** → "Interrompendo la lettura perderai tutti i progressi attuali. Vuoi proseguire?"

---

## Environment

```
EXPO_PUBLIC_SUPABASE_URL=https://mpdqjeasesupjregjjjf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<token>
EXPO_PUBLIC_GEMINI_API_KEY=<set>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / IOS / ANDROID=<set>
EXPO_PUBLIC_REVENUECAT_IOS_KEY / ANDROID_KEY=<set>
EXPO_PUBLIC_GOOGLE_TTS_API_KEY=<key Google TTS — dev, letta da google-tts.ts>
GOOGLE_TTS_API_KEY=<Supabase edge secret — prod>
```
Le `EXPO_PUBLIC_*` production sono già su EAS env `production`: `pnpm exec eas env:list production`.

---

## Deploy & Build

**EAS:** account `praticantisokagakkai` · projectId `c3a711e8-1d8a-496d-9db3-4a2139c6c322`.
**Profili `eas.json`:** `production` (AAB, canale production) · `preview` (APK, canale preview) · **`preview-prod`** (APK standalone interno, canale production — build di test su device reale) · `development` (Dev Client APK).

**OTA update** (solo JS/TS/asset — NO moduli nativi):
```bash
pnpm exec eas update --branch production --message "descrizione"
```
- Aggiorna `preview-prod` + `production` (stesso canale). `runtimeVersion.policy:'appVersion'` → update arriva solo se `version` NON cambia (fix UI/logica non toccare la versione).
- Bundling gira **sul PC**: tieni acceso fino a `✔ Published!` (se spegni prima, update interrotto). Update illimitati (limite solo MAU 1.000/mese). Cattura stato file all'avvio Metro → rilanciare a lavoro finito.
- Sul device: chiudere del tutto l'app (dai recenti) + riaprire → scarica update.

**Rebuild APK** (moduli NATIVI: Skia, RevenueCat, share, expo-notifications):
```bash
pnpm exec eas build --profile preview-prod --platform android
```
- Gira nel **cloud** (~10-15 min): dopo l'upload puoi spegnere il PC.
- Modulo nativo entra nel binario solo se **importato da un file** + in `package.json` (autolinking). `DivineMascot.tsx` ora importa Skia → il prossimo build lo include.

**Prossimo (FASE 22+):** `expo-navigation-bar` + nav bar Android **immersive sticky** (le 3 barre di sistema spariscono, riappaiono con swipe — modifica NATIVA, solo via `eas build`) · `pnpm add react-native-share` · RevenueCat nativo (`react-native-purchases` + keys + webhook Edge Function) · Share nativo WhatsApp/Telegram · History insights (line/bar chart) · ReadingDetail deepening · Push reale (Edge Function + expo-notifications).

---

## Changelog FASI (sintesi)

- **F11** Shuffle 60fps (Easing.bezier+out, CardSwayTranslateY in useRef).
- **F12** Spread Situazioni (`selectSituationCards`, SITUATION_ANALYST, freeContext obbligatorio).
- **F13** AI background + covered cards interattive; DivineMascot sempre visibile; layout `mascotContainer` flex; no bottone "APPROFONDISCI" (eccetto Celtic).
- **F14** TTS voce cartomante (`it-IT-Standard-A`, SSML `toSsml()`, Edge Function `tts` deployata, bottoni Play/Pausa toggle).
- **F15** Gemini fixes (model unificato 2.5-flash, robust chunk parsing, context validation); covered cards UI tutti gli spread; TTS toggle/pause/resume; Celtic Cross + descrizioni IT.
- **F16** Daily Card notification (campanella in-app, auto-create + realtime); Celtic Cross layout ottimizzato (`measureWrap` + onLayout, cy 55%).
- **F17** Card reveal rimpicciolito; DivineMascot absolute top:50 width 200; header audio integrato nella chat (FollowupPanel, no user bar esterna); chat compattata 12px; TTS smart logic (lastSpokenText resume); spread name unificato.
- **F18** Storage MMKV→AsyncStorage (cache Map + backing, API identica); `_layout.tsx` SafeAreaProvider + initCache gate; ElaborateFrame responsive (`useSafeAreaInsets`); rimossi file obsoleti (readings.tsx, settings.tsx, PNG corrotti); splash.png rigenerato sharp; pacchetti SDK 54.
- **F19** Fix build prod device reale: migration `005` (schema disallineato); DivineMascot SVG RadialGradient (poi superato); onboarding overflow px; `avatar-upload.ts` base64; ProfileModal cambio avatar; Gemini fallback non-stream (solo reading); typo "LETTURAE".
- **F20** DivineMascot riscritto in **Skia** (GPU, fix lag app intera — richiede `eas build`); `streamWithFallback()` centralizzato per TUTTE le 5 stream (fix followup/dream/situation/celtic in release).
- **F21** Fix UX emersi su device reale (tutti pubblicabili via `eas update`, tranne nav bar): **mascotte** compatta (`H=104`, width default 260 / reading 170) + più densa (distribuzione radiale `sqrt`) + **orb luminoso** (2 Circle sfocati, no RadialGradient) + **fix salto animazione** (`periodicFreq` cicli interi in `LOOP`); **tastiera** non nasconde più la chat (`KeyboardAvoidingView` + `keyboardShouldPersistTaps`); **tap rivela carta solo sul centro** (punto dorato pulsante `tapDot`, `onRevealCard` per-card, no Pressable a tutto schermo); **TTS followup** legge solo l'ultimo messaggio (`getReadableText()`); **fix salvataggio** (causa: enum `situazioni` mancante in prod → migration `005`; codice: `saveError` mostra `e.message` reale + navigazione prima del reset). ⚠️ Mascotte Skia visibile solo dopo `eas build`. Nav bar immersive rimandata al rebuild (FASE 22).
