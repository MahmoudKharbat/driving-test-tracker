# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Driving Test Tracker

Hebrew-language app for an Israeli driving examiner. See [README.md](README.md)
for setup and the data model.

## Invariants — breaking these reintroduces the defects the app exists to fix

- **A teacher is a document, never a string.** Never write a teacher name that
  has a city appended to it. `city` is a separate enum field.
- **Never create a teacher without running the duplicate check first.**
  `findDuplicateCandidates` in [src/lib/hebrewName.ts](src/lib/hebrewName.ts),
  scoped to the selected city. The spreadsheet's split-person defect came back
  the moment this is skipped. Assertions: `npm run test:names`.
- **Never auto-merge two teachers.** Always ask. `אור` and `אור פוגל` may be
  two people.
- **`date` is always a Firestore `Timestamp`.** Never a number, never a string.
- **`teacherStats` is written only by the Cloud Function.** Security rules deny
  client writes. Never compute pass rates client-side by reading every test.
- **Everything stays scoped under `testers/{uid}`.** This is what keeps the
  Phase 2 teacher-role split additive, and testers' and teachers' data must
  never share a subtree — an examiner's grading patterns are sensitive.

- **Never `await` a Firestore write for UI flow.** Write promises resolve only
  on server acknowledgement and hang forever offline
  ([#6515](https://github.com/firebase/firebase-js-sdk/issues/6515)). Every
  write in [src/data.ts](src/data.ts) is fire-and-forget and returns
  synchronously. Awaiting one silently turns this back into an online-only app.

## Conventions

- **All Hebrew strings live in [src/strings.ts](src/strings.ts).** Masculine
  grammatical forms. Never inline Hebrew in a component.
- **RTL is forced natively** by the `expo-localization` plugin. Use plain
  `flexDirection: 'row'`; `row-reverse` double-flips and breaks layout.
- Firestore paths are built only by the helpers in
  [src/firebase.ts](src/firebase.ts), never by hand.
- `@react-native-firebase` v26 uses the modular API and exports types directly
  (`User`, `Timestamp`, `CollectionReference`). The old `FirebaseAuthTypes` /
  `FirebaseFirestoreTypes` namespaces do not exist.

## Checks

```bash
npm run typecheck && npm run test:names && npm --prefix functions run build
```

Requires a development build — **Expo Go will not work**, because offline
persistence requires the native Firebase SDKs.
