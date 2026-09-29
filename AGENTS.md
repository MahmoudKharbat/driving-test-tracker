# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Driving Test Tracker

Hebrew-language app for an Israeli driving examiner. See [README.md](README.md)
for setup and the data model.

## Two backends — phone-only is the default

- **Phone-only (default):** no login, no network. Screens import only
  [src/backend/auth.tsx](src/backend/auth.tsx) and
  [src/backend/data.ts](src/backend/data.ts); `metro.config.js` swaps those for
  [src/backend/local/](src/backend/local/). Data lives in AsyncStorage on the
  device. Runs in Expo Go. Stats are derived on the device — there is no Cloud
  Function here.
- **Firebase (`EXPO_PUBLIC_BACKEND=firebase`):** accounts, Firestore sync, the
  `teacherStats` function. Kept intact as the future paid cloud-sync tier:
  client code in [src/backend/firebase/](src/backend/firebase/), server side
  (rules, Cloud Function, seed script) in [firebase/](firebase/).
  `app.config.js` and `react-native.config.js` add its native side only in this
  build.
- The two backends must stay interchangeable.
  [src/backend/contract.ts](src/backend/contract.ts) fails the typecheck if the
  local modules drift from the Firebase ones.
- The local storage layout (`dt:v1:*` keys, Firestore-style ids, epoch-millis
  dates) is what a future cloud upload will read. Changing it needs a migration
  and a new version prefix.

## Invariants — breaking these reintroduces the defects the app exists to fix

- **A teacher is a document, never a string.** Never write a teacher name that
  has a city appended to it. `city` is a separate enum field.
- **Never create a teacher without running the duplicate check first.**
  `findDuplicateCandidates` in [src/lib/hebrewName.ts](src/lib/hebrewName.ts),
  scoped to the selected city. The spreadsheet's split-person defect came back
  the moment this is skipped. Assertions: `npm run test:names`.
- **The spreadsheet import follows the same two rules.** Names are cleaned of
  city suffixes by `cleanTeacherName`, and every near match becomes a pair the
  examiner must answer before the import button enables
  ([src/lib/importSheet.ts](src/lib/importSheet.ts), `npm run test:import`).
- **Never auto-merge two teachers.** Always ask. `אור` and `אור פוגל` may be
  two people.
- **`date` is always a Firestore `Timestamp`.** Never a number, never a string.
- **`teacherStats` is written only by the Cloud Function** (Firebase build).
  Security rules deny client writes. Never compute pass rates client-side by
  reading every Firestore test. The phone-only layer derives them locally —
  that is the one exception.
- **Everything stays scoped under `testers/{uid}`.** This is what keeps the
  Phase 2 teacher-role split additive, and testers' and teachers' data must
  never share a subtree — an examiner's grading patterns are sensitive.

- **Never `await` a Firestore write for UI flow.** Write promises resolve only
  on server acknowledgement and hang forever offline
  ([#6515](https://github.com/firebase/firebase-js-sdk/issues/6515)). Every
  write in [src/backend/firebase/data.ts](src/backend/firebase/data.ts) (and
  its local twin) is fire-and-forget and returns
  synchronously. Awaiting one silently turns this back into an online-only app.

## Conventions

- **All Hebrew strings live in [src/strings.ts](src/strings.ts).** Masculine
  grammatical forms. Never inline Hebrew in a component.
- **RTL is forced natively** by the `expo-localization` plugin. Use plain
  `flexDirection: 'row'`; `row-reverse` double-flips and breaks layout.
- Firestore paths are built only by the helpers in
  [src/backend/firebase/db.ts](src/backend/firebase/db.ts), never by hand.
- `@react-native-firebase` v26 uses the modular API and exports types directly
  (`User`, `Timestamp`, `CollectionReference`). The old `FirebaseAuthTypes` /
  `FirebaseFirestoreTypes` namespaces do not exist.

## Checks

```bash
npm run typecheck && npm run test:names && npm run test:import && npm run functions:build
```

The phone-only build runs in Expo Go (`npm start`). The Firebase build requires
a development build (`npm run start:firebase`) — Expo Go cannot load the native
Firebase SDKs.
