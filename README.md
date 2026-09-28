# מבחני נהיגה — Driving Test Tracker

Phase 1. Replaces a Google Sheet an Israeli driving examiner uses to track the
tests he administers, broken down per driving teacher, so he can see each
teacher's pass/fail record with him before the next test.

Hebrew UI, RTL enforced. Android first, iOS from the same codebase.

**Phone-only by default.** Data is saved on the device; there is no login and
no network use. The Firebase build below — accounts, cloud sync, server-side
stats — is kept intact behind `EXPO_PUBLIC_BACKEND=firebase` as the planned paid
sync tier. The ⋯ menu exports every test as CSV; on a phone-only install that
file is the only backup.

| Command | Backend |
|---|---|
| `npm start` | phone-only, in Expo Go |
| `npm run start:firebase` | Firebase (development build required) |

Everything from **Setup** onwards applies to the Firebase build only.

---

## What this fixes

The spreadsheet had two structural defects. Both are fixed by construction, not
by discipline:

**1. The teacher was a free-text string.** City was hand-appended inconsistently
(`אור-כ.סבא` vs `אור פוגל-כ.סבא`) and typos split one real person across rows
(`דפוס יעקב(קובי)-נתניה` vs `דפס יעקב(קובי)-נתניה`), silently corrupting the
counts he relies on.

→ A teacher is now one canonical document. Before a new one is written, the
typed name is fuzzy-matched against the teachers already in that city and any
near match is shown for confirmation. See
[src/lib/hebrewName.ts](src/lib/hebrewName.ts); the real spreadsheet defects are
pinned as assertions in
[scripts/test-hebrew-name.mts](scripts/test-hebrew-name.mts) (`npm run
test:names`).

The app never merges on its own — `אור` and `אור פוגל` may be two people, and
only the examiner knows which.

**2. Dates were not dates.** Values were bare numbers (`5.6` for 5 June) and at
least one was the text `5,6`, so filtering and sorting were unreliable.

→ `date` is a real Firestore `Timestamp`, written through a native date picker
that cannot produce a future date.

---

## Why React Native Firebase and not the `firebase` JS SDK

Offline persistence is a hard requirement — tests are logged in the field,
moving between test centres on patchy connectivity.

The `firebase` JS SDK cannot do it in React Native. Its persistence layer is
built on IndexedDB, which React Native does not provide, so `persistentLocalCache()`
silently disables itself. This is a known, still-open limitation:
[firebase-js-sdk#7947](https://github.com/firebase/firebase-js-sdk/issues/7947).

`@react-native-firebase` wraps the native SDKs, where disk persistence is on by
default. [src/backend/firebase/db.ts](src/backend/firebase/db.ts) pins it explicitly so the guarantee
is visible in code.

**The cost:** native modules mean **Expo Go will not work**. You need a
development build. That is the trade the offline requirement forces.

### Writes are never awaited — this is deliberate

A Firestore write promise resolves only when the **server** acknowledges it.
With no connection it stays pending indefinitely: it does not reject, and it
does not resolve when the write commits locally
([firebase-js-sdk#6515](https://github.com/firebase/firebase-js-sdk/issues/6515)).

So `await addDoc(...)` would freeze the app in exactly the situation it exists
for — a save button spinning forever between test centres, while the data had
already been written to disk.

Every write in [src/backend/firebase/data.ts](src/backend/firebase/data.ts) is therefore fire-and-forget and
returns synchronously. `createTeacher` generates its document id client-side so
the new teacher can be selected immediately. What the UI reacts to is the local
commit, which is synchronous and fires every `onSnapshot` listener at once.

**If you add a write, do not await it for UI flow.** That single mistake
silently converts this back into an online-only app.

---

## Setup

Prerequisites: Node 22+, an EAS account, and the Firebase CLI
(`npm i -g firebase-tools`).

### 1. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. **Build → Authentication → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database.** Pick a location and keep
   it — `firebase/functions/src/index.ts` pins `europe-west1`, so either create the
   database there or change `setGlobalOptions({ region })` to match.
4. Register an **Android** app with package name
   `com.mahmoudkharbat.drivingtesttracker`, download `google-services.json`,
   and place it in the project root.
5. For iOS later: register with the same bundle identifier, download
   `GoogleService-Info.plist`, place it in the project root.

Both files are gitignored.

### 2. Point the CLI at the project

```bash
firebase login
cd firebase && firebase use --add && cd ..   # select the project, alias it "default"
```

### 3. Deploy rules and the aggregation function

```bash
npm run deploy:rules
npm --prefix firebase/functions install
npm run deploy:functions
```

### 4. Seed the city list

`config/cities` is a document, not a constant, so a new test centre can be added
without an app store release. Clients are denied writes to it, so seeding uses
the Admin SDK.

Firebase console → Project settings → Service accounts → Generate new private
key, then:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:cities
```

To add a city later, pass the full list:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  npm run seed:cities -- "כפר סבא" "אריאל" "חדרה" "פתח תקווה" "נתניה" "הרצליה" "רעננה"
```

### 5. Build and run

```bash
npm run build:dev     # EAS development build (APK)
# install the APK on the device, then:
npm start
```

Local native build instead of EAS: `npm run android` (needs Android Studio).

---

## Verification

Automated, and currently passing:

```bash
npm run typecheck        # app — clean
npm run test:names       # 28 assertions on the duplicate matcher — all pass
npm run functions:build
```

### Offline verification — not yet done

Build order step 8 requires exercising the full log flow in airplane mode and
confirming sync on reconnect. **This has not been run.** It needs a device and a
live Firebase project, neither of which existed at build time. The code is
written for it, but written is not verified. Run this before trusting it:

1. Sign in while online. Open the teacher list and let it populate — this
   primes the local cache.
2. Enable airplane mode.
3. Log a test against an existing teacher. **Expect:** the save returns
   immediately and the screen dismisses.
4. Open the teacher's detail screen. **Expect:** the new test appears in the
   history immediately, and the header shows `מסונכרן…` — the test is in the
   local cache but the Cloud Function has not run, so `teacherStats` is stale.
   This is correct behaviour, and it is worth confirming the totals do *not*
   move while offline.
5. Create a *new* teacher offline and log a test against them. **Expect:** both
   succeed; the teacher shows `אין מבחנים` until stats arrive.
6. Force-quit and reopen the app, still offline. **Expect:** the queued writes
   survive — this is what proves disk persistence rather than in-memory state.
7. Disable airplane mode. **Expect:** within a few seconds the writes flush, the
   function runs, and the badges update to the correct counts.

If step 6 fails, the persistence setting in [src/backend/firebase/db.ts](src/backend/firebase/db.ts)
is not taking effect — check that it runs before any other Firestore call.

---

## Data model

```
config/cities                                   { list: string[] }
users/{uid}                                     { role, name, createdAt }
testers/{uid}/settings/cities                   { list: string[] }
testers/{uid}/teachers/{teacherId}              { name, city, createdAt }
testers/{uid}/teachers/{teacherId}/tests/{id}   { date, result, createdAt }
testers/{uid}/teacherStats/{teacherId}          { passed, failed, total,
                                                  lastTestDate, updatedAt }
```

Everything is scoped under `testers/{uid}` from day one, so multi-tester and the
Phase 2 teacher-role split are additive rather than migrations. `role` is
present but unused in Phase 1 for the same reason.

The city dropdown is `config/cities` followed by `testers/{uid}/settings/cities`
— the cities he added from the app. The seeded list stays
admin-only so one tester can never change another's.

`teacherStats` is maintained **only** by the Cloud Function and is denied to
clients by the security rules. It replaces the sheet's live `QUERY`/`PIVOT` and
stays O(1) to read however many years accumulate.

**One field beyond the original spec:** `lastTestDate`. The spec listed
`{ passed, failed, total, updatedAt }`, but `updatedAt` is *when the row was
last edited*, which would make the list's "recently tested" sort wrong the
moment he corrects an old entry. `lastTestDate` is derived, additive, and
written by the same function.

### Aggregation strategy

The function **recounts** a teacher's tests on each write rather than applying a
`+1`/`-1` delta. Deltas are O(1) but drift permanently on any missed or
redelivered event, and Cloud Functions guarantee at-least-once, not
exactly-once, delivery. A recount is idempotent, so redelivery is harmless and
historical drift self-heals on the next write.

The cost is one read per test per write, bounded by tests-per-teacher — tens,
not thousands. If a teacher ever reaches the low thousands of tests, revisit
with a transactional delta plus periodic reconciliation.

---

## Layout

```
app/                          expo-router routes
  _layout.tsx                 RTL, auth gate
  sign-in.tsx                 Firebase build only (never shown phone-only)
  (app)/index.tsx             test summary — replaces the סיכום tab
  (app)/new-test.tsx          the core loop
  (app)/add.tsx               one sheet: add a teacher (duplicate guard) or a city
  (app)/teacher/[id].tsx      detail, edit, delete
src/
  backend/
    auth.tsx, data.ts         what screens import; swapped per build
    contract.ts               typecheck: both backends export the same API
    local/                    phone-only (default): AsyncStorage, local stats
    firebase/                 db.ts (offline persistence + typed paths),
                              auth.tsx, data.ts
  components/                 ui primitives, icons, Dropdown, pickers
  lib/                        hebrewName (fuzzy matching), date, cities,
                              teachers (filter/sort), csv, lastCity
  strings.ts                  every Hebrew string
  theme.ts                    colours, spacing, type scale
  types.ts                    the schema
firebase/                     Firebase build, server side
  firebase.json, firestore.rules, firestore.indexes.json
  functions/src/index.ts      teacherStats aggregation
  functions/scripts/          seed-cities.mjs (Admin SDK)
scripts/test-hebrew-name.mts  duplicate-matcher assertions
```

### Notes for future work

- **RTL** is forced natively by the `expo-localization` config plugin
  (`forcesRTL: true`). Layouts therefore use plain `flexDirection: 'row'` —
  writing `row-reverse` by hand would double-flip and break them.
- **All Hebrew lives in `src/strings.ts`.** Do not inline Hebrew in components.
- **The teacher list filters and sorts on the client**, over already-subscribed
  data. Deliberate: it keeps the screen fully usable offline, and sorting by
  pass rate spans two collections so it could not be a server-side query anyway.
- `useTeachers` is subscribed independently by three screens. Firestore shares
  the underlying watch stream for identical queries, so the network cost is
  shared; only the in-memory copies duplicate. Worth hoisting into a context if
  a fourth consumer appears.
- **`.npmrc` sets `legacy-peer-deps`.** The Expo template itself ships a peer
  conflict (`expo-router` → `vaul` → `@radix-ui` wants `react-dom@19.2.8`;
  Expo pins `react@19.2.3`). It affects only the unused web target. Without it,
  every `npx expo install` fails.

---

## Out of scope for Phase 1

Teacher-role login and the teacher-side app; any cross-visibility between
testers and teachers; CSV/Excel export; push notifications; charts and trend
analytics; multi-tester accounts, subscriptions, billing; migration of the
existing sheet data.

The privacy constraint is worth restating because it is load-bearing on the
schema: an examiner's per-teacher grading patterns are professionally sensitive.
Phase 2 keeps the two roles in fully separate Firestore subtrees with no shared
reads, which is why `testers/{uid}` scoping exists from day one.
