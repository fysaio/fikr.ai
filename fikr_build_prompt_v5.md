# Fikr build prompt v5: the whole revised flow, as a PWA

Read this fully before touching code. It replaces the earlier build prompts where they disagree (Think, onboarding, navigation, timer, Yesterday). It is a delta against the code that already exists, not a rewrite.

## 0. Ground rules

1. **Do not delete anything not named here.** Keep the working onboarding engine (`src/app/api/onboarding/route.ts`: one LLM call per turn that extracts facts and writes the next question, Groq llama-3.3-70b with Gemini fallback, fixed fallback questions, offline queue) and the focus timer routes `/focus` and `/focus-end`.
2. **Designs are the visual source of truth.** Open `fikr - welcome.html` in the project root. Each board is 390x844, in light and dark. Match layout, copy, colours, outlines, hard shadows and pill shapes. Do not invent copy. Where a board and this prompt disagree, stop and ask.
3. **Fikr is a PWA, mobile only.** No desktop or tablet layout; on wide screens centre a 430px column.
4. Product rules from the Master Context still bind: stated vs observed vs guess are never mixed, a guess is always labelled "A guess" with Feels true / Not really, silence is a feature, no streaks, scores, gamification, habit tracking, or notification volume tricks.
5. Fikr never messages or calls a third party. It only opens WhatsApp or the dialler for the user.
6. Say what you changed at the end of each phase. Run the tests in section 14 before moving on.

## 1. Delete Think everywhere

- Remove the route `/think`, its page, components, API route, tests, nav item, copy ("Think", "Think out loud…"), analytics events and DB tables or columns used only by it.
- Search for `think` case-insensitively across code, copy, comments, env, docs, seeds and tests. Rename anything that survives to "chat" or "talk".
- Conversation still exists as a **chat sheet** (section 6). Keep the underlying message storage and memory extraction if they are reused; migrate old Think threads into the sheet's history or drop them, and tell me which you chose.

## 2. Navigation

- Two tabs only, big and bold: **Today** and **Life**. Bottom bar also holds the **Tell Fikr…** input pill that opens the chat sheet. No third tab.
- Life tab shows a lilac badge with the total of unviewed memory updates. Each Life tile shows its own floating badge at its top-right edge instead of a count. A badge clears when that section is opened.
- Profile and settings live under the user's initial on Life (`/life/you`), not on Today.

## 3. Routes

```
/welcome  /you  /signup  /login  /forgot  /reset  (auth, existing)
/onboarding  /onboarding/more  /remembered
/today  /today?talk=1  /today/yesterday
/talk/time  /talk/set
/focus/new  /focus  /focus-end
/evening  /evening/done
/life  /life/{people,projects,commitments,goals,preferences,history,patterns}
/life/item/{id}  /life/item/{id}/number  /life/edit  /life/forget
/life/you  /life/you/{speak,quiet,data,export,delete,logout}
/notify/ask  /notify/install
/privacy  /terms
```

Unknown paths render "I can't find that." (PwNotFound) with a button to Today.

## 4. Onboarding and first chat are one conversation

Screens: ObOpen, ObListen, ObChoice, ObRank, ObChips, ObVent, ObReady, ObMore, ObRemembered.

- Opening question: "What is taking up most of your mind these days?" with small example chips and a one-line note that messages go to an AI service. **Skip for now** leads to an empty Today (TdEmpty).
- Fikr leads. After the first answer it asks clarifying questions using **smart cards**: single choice, rank, chips plus free text. Text bars grow as the user types and are never rigid.
- Extraction stays **stated-only** in onboarding. Each fact appears as a "Just remembered" chip (user can tap to fix or forget).
- If the answer sounds overloaded, show the ObVent branch (talk one through / just get it out / not now). Do not turn venting into tasks.
- ObReady: two buttons, **See my Today** and **Tell me more first**. "Tell me more" (ObMore) explains what Fikr remembers, how to correct it, and returns to ObReady.
- Quiet times and "how I want help" are no longer asked here. They live in Settings.
- Finishing populates Life (people, projects, commitments, preferences) and builds the first Today (TdFirst).
- Clear any locally persisted onboarding text on completion and on logout.

## 5. Today

Boards: TdDay, TdFirst, TdEmpty, TdMorning, TdSoon, TdTimer, TdReturn, TdEvening, NtLanding, plus connection states in section 10.

- Cards are proposals, each with a visible "Why:" line. Order: what matters today, then the rest.
- **First time:** short hand-drawn **arrows** are the only guide. Each is a small SVG that touches its target, with a lime label tag for contrast (never over busy content). Each shows once, persisted per user. No tutorial box.
- **Morning card** (TdMorning): if yesterday has something to say, a tangerine "Yesterday is ready" card is pinned at the top with a New tag until the user opens it. Opening it, even partly, collapses it to a slim Yesterday row. If yesterday has nothing, no card (silence).
- **Task starting soon** (TdSoon): one card, once. Choices: set a timer, just a time, not now.
- **Timer running** (TdTimer): a ticking chip on Today with the task name, gentle bounce, `prefers-reduced-motion` turns the bounce off.
- **Evening** (TdEvening): one card at the user's evening time, once. See section 8.
- No streaks, no counters of days used, no "you did X% today".

## 6. Chat sheet (replaces Think)

Opens from **Tell Fikr…** as a bottom sheet over Today (`/today?talk=1`). Boards: ShEmpty, ShChat, ShSoon, ShTime, ShSet, ShQueued, ShSlow.

- Chat is an input method. Fikr first decides what the user wants: to be heard, to understand, to decide, to remember, or to act. If unclear it asks one short question. It never turns every thought into tasks and does not default to lists, plans or motivation.
- Smart cards (choice, rank, chips) are used when they reduce typing.
- **Task starting soon card** inside chat: Fikr offers a timer or a start time (ShSoon, ShTime). Choosing a time sets a reminder (ShSet).
- Writes made offline show "Waiting to send" and send when back online (ShQueued). Slow responses show a quiet "still thinking" state and keep what the user typed (ShSlow).
- Closing the sheet returns to Today with state kept.

## 7. Timer (offer, pick, run, pause, finish, end)

Boards: TmAsk, TmPick, TmRun, TmPaused, TmDone, TmEnd.

- **Offer only when the user says they need to focus** ("I need to study"). Fikr asks "Would a timer help?" with Yes / No. Never offered by default.
- TmPick: pills 25 / 45 / 60 plus a number field with **minus and plus buttons** at its sides. The field is numeric only (`inputmode="numeric"`), min 5, max 180.
- TmRun is full-screen. Pause and End available. Leaving the screen keeps it running; Today shows the ticking chip.
- **Store `endsAt` (a timestamp), not a counter.** Recompute remaining time from `Date.now()` on every render and on `visibilitychange`. A backgrounded PWA must show the correct time on return.
- When time is up while the app is closed, send a push (section 12). If push is not allowed, show TmDone on next open.
- TmDone asks "How did it go?" and the answer updates the commitment. TmEnd confirms ending early and keeps the minutes done.
- Fikr stays silent during a session.

## 8. Yesterday story and evening loop

**Yesterday** (`/today/yesterday`, single colourway): 8 slides: Intro, Done, Bars, Focus, People, Guess, Open, Close.
- Tap the right side for next, left side for back (standard story behaviour; the owner wrote "tap left to continue", so confirm which they want and make it one constant). A progress bar sits at the top, X returns to Today.
- Use only stated data and timer data. Say so on the Bars slide. Bars rank where time and attention went; no score, no comparison with other days or people, no share button.
- Guess slide: Feels true / Not really, and the answer feeds memory.
- Open slide: unfinished items are carried to today, never shamed. Items link to their pages.
- Close slide: optional note, "Plan today".
- Respect reduced motion. Slides never auto-advance.

**Evening** (`/evening`, `/evening/done`): EvAsk (each open item: Done / Tomorrow / Let it go, all optional), EvKnow ("What should tomorrow know?" chips plus free text), EvDone ("Tomorrow knows."). One evening card per day, never repeated. No productivity report.

## 9. Life, items and editing

Boards: LfHome, LfPeople, LfProjects, LfCommitments, LfGoals, LfPreferences, LfHistory, LfPatterns, ItPerson, ItPersonNoNum, ItAddNum, ItProject, ItCommit, ItCommitLocked, ItGoal, ItPreference, ItGuess, EdAsk, EdThinking, EdConfirm, EdForget.

- Seven categories: People, Projects, Goals, Commitments, Preferences, History, Patterns. History and Patterns have friendly empty states. No Add button on Life.
- Every item shows provenance: **Stated**, **Observed**, or **A guess**, with "Where this came from".
- **Edit by text:** no inline field edits. The user types what to change (EdAsk). Fikr reads it (EdThinking), shows the proposed change (EdConfirm), and only saves on "Yes, save it". "Not quite" returns to EdAsk with the text kept.
- **Forget** shows exactly what will be removed (EdForget) and removes derived items that came only from it.
- **People tasks:** buttons **WhatsApp** (`https://wa.me/<digits>`, E.164 digits only) and **Call** (`tel:+...`). With no number saved (ItPersonNoNum), show "Add her number", which opens ItAddNum: the user types it, Fikr parses it and asks "Is this right?" before saving. Numbers are user-entered, deletable, never used to contact the person.
- **After WhatsApp:** when the app regains focus, ask "Did you reply to Aisha?" (Yes, I did / Not yet). Completion is the user's answer, never detected.
- **Work tasks:** **Start timer**.
- **Timed tasks:** locked until their time ("Opens at 15:30", ItCommitLocked) with a Remind me option. Enforce on the server (compare to server time), not only in the UI.
- There is no bare "tick to finish".

## 10. Connection states (low-bandwidth tolerant, not "offline-first")

Boards: TdOffline, TdSlow, TdBack, ShQueued, ShSlow, ErGeneric, PwOfflineFirst.

- Cache the last Today and Life for read. On slow connection show what is cached with its time ("Showing what I had at 07:40"). On no connection show a banner and queue writes.
- **Outbox in IndexedDB** (not localStorage). Each queued write has an id, type, payload, created time and an idempotency key. Flush on `online`, on `visibilitychange` to visible, and on app start. **Do not rely on Background Sync** (not available on iOS Safari).
- Back online shows a short confirmation ("2 things sent") then disappears.
- Timer, WhatsApp and Call work with no connection.
- Model failure: use the Gemini fallback, then the fixed fallback copy. Never show raw errors. ErGeneric says nothing was lost.
- First ever open with no connection and nothing cached: PwOfflineFirst.

## 11. Settings

Boards: StHome, StSpeak, StQuiet, StData, StExport, StDelete, StLogout, NtDenied, LgPrivacy, LgTerms.

- Appearance: Match phone / Light / Dark. Dark is forest green, light is cream.
- **When I speak up:** four toggles: Orientation, Right moment, Reflection, People, plus "Nudges on this phone", "Put Fikr on your home screen" and "Quiet for today". Reflection defaults off.
- Quiet times: chips plus a from/to time. Classes, prayer times and late night are examples the user can pick. Respect them in every notification rule.
- Your data: Everything I know (Life), Export (JSON, link valid 24 hours, built server-side), Delete everything (type "delete" to confirm; removes data in the database and with model-provider logs where possible), Privacy notice, Terms.
- Export and delete must be real endpoints before launch. The copy promises them.

## 12. PWA specifics

**Manifest and shell**
- `manifest.webmanifest`: name Fikr, `display: standalone`, `start_url: /today`, `scope: /`, icons 192, 512 and a maskable 512, `theme_color` and `background_color` set per colour scheme (cream `#F8EEDC`, forest `#0F4D3A`; use two `<meta name="theme-color" media="(prefers-color-scheme: ...)">`).
- iOS: `apple-mobile-web-app-capable`, `apple-touch-icon`, status-bar style. Use `env(safe-area-inset-*)` for the bar and sheet. Inputs at 16px or larger to stop iOS zoom. Test the on-screen keyboard resizing the sheet.
- **Service worker:** precache the app shell and fonts; runtime cache for read endpoints with stale-while-revalidate; never cache auth or write endpoints. Opening from cache shows PwSplash for under a second.
- **Updates:** when a new service worker is waiting, show the PwUpdate banner. Apply it only when the user taps Update now or at the next cold start. Never reload while the user is typing, in the timer, or in the chat sheet.

**Install** (shown only when the user asks for nudges, or from Settings)
- Android and desktop Chromium: capture `beforeinstallprompt`, show NtInstallAnd, and call `prompt()` from the button.
- iOS Safari: there is no install event. Show NtInstallIOS with the three manual steps. Detect standalone with `navigator.standalone` and `matchMedia('(display-mode: standalone)')`. Do not show install UI when already installed.
- Never show an install banner on first launch. Value first.

**Push notifications**
- Web Push with VAPID. On iPhone, push only works from an installed PWA (iOS 16.4 or later), so the flow is: user asks for a nudge, then NtInstallIOS if not installed, then NtAsk, then the browser permission prompt, called **from a tap**.
- NtAsk appears the first time the user sets a reminder (for example from ShTime). "Not now" keeps the reminder on Today only.
- Store the subscription per device, remove it on 404/410 from the push service, and remove it on logout.
- If permission is denied, show NtDenied and keep every nudge inside the app.
- **Notification content:** title is the short fact, body is one line of why, as in NtLock. No emojis, no counts, no "You haven't opened Fikr". Notification actions are inconsistent across platforms, so every notification must work with a plain tap.
- `notificationclick` focuses an existing window or opens `/today?focus=<id>`; Today highlights that card (NtLanding).
- **Scheduling happens on the server**, not in the browser. Browsers cannot reliably fire timers or local notifications when the PWA is closed, so use a scheduled job (Supabase cron or Vercel cron) that sends pushes at `fire_at`.
- **Intervention budget:** at most 2 notifications per day, none in quiet times, none while a timer runs, none for a kind the user turned off. If a nudge is ignored three times, stop that kind. Log every send, open and ignore. Silence is the default decision.

**Session**
- Auth refresh runs quietly. If the session ends, show PwSession ("Log in again"), keep the outbox, and flush it after login.

## 13. Privacy

- The privacy notice (LgPrivacy) and terms (LgTerms) are **drafts for legal review**. Do not publish as final. Link them from the signup footer (add "By continuing you agree to the Terms and Privacy notice") and from Settings, Your data.
- The notice must name the current model providers (Groq, Google as fallback) and be updated whenever providers change.
- Stored third-party phone numbers are personal data about someone who never agreed. Keep minimal and deletable; check Nigeria's NDPA obligations before launch.
- Age minimum 16 stays as designed; get a legal view on under-18 handling.
- Rate limiting must work across serverless instances (Supabase or Upstash), not in memory.
- Add `Cache-Control: no-store` on authenticated API responses, and clear caches and IndexedDB on logout.

## 14. Tests (software layer)

- Auth and session end; persistence; memory writes and reads; correction and forget (including derived items); export and delete; permissions (a user can never read another user's rows).
- Outbox: kill the network mid-write, reload, reconnect, confirm exactly one write (idempotency).
- Timer: background the tab for 5 minutes, confirm the right remaining time; reload, confirm it resumes.
- Time lock: change the device clock; the server still refuses early completion.
- WhatsApp/Call deep links produce the right URL; return prompt appears once.
- Push: subscribe, send, click, deep link; denied path; iOS installed vs not installed.
- Notification budget: quiet times, timer running, daily cap, ignored-three-times.
- Model failure: Groq down, then Gemini down; user sees fallback copy; nothing lost.
- Slow 3G and offline in DevTools for Today, chat sheet and Life.
- Accessibility: focus order, labels on every icon button (all designs carry labels), reduced motion, 44px targets, contrast on the lime-on-cream tags and arrows.
- Instrumentation for the behavioural layer: meaningful returns, memory corrections, interventions sent, opened and ignored, reflection sessions, decisions supported, commitments followed through, cost per active user, latency. Do not track DAU, time in app or streaks as goals.

## 15. Build order

1. Delete Think, restructure routes and nav (sections 1 to 3).
2. PWA shell: manifest, service worker, install, outbox, update flow (sections 10, 12).
3. Onboarding as one conversation, then Life population (4, 9).
4. Chat sheet (6).
5. Today states and morning card (5).
6. Life pages, items, edit by text, WhatsApp/Call, time lock (9).
7. Timer (7).
8. Yesterday story and evening loop (8).
9. Push and the intervention budget (12).
10. Settings, privacy, export, delete (11, 13).
11. Test pass (14), then give it to five real people before adding anything.

## 16. Open questions for the owner (do not guess)

- Story tap direction (section 8).
- Keep or drop old Think history (section 1).
- Evening time default (suggest 8:30 PM, editable in Settings).
- Whether the privacy notice names providers by name in the first release.
