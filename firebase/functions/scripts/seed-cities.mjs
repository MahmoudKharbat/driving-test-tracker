#!/usr/bin/env node
/**
 * Seed `config/cities`.
 *
 * The city list is a Firestore document rather than a constant in the app so a
 * new test centre can be added without an app store release. Security rules
 * deny all client writes to `config/*`; this script uses the Admin SDK, which
 * bypasses rules, so it is also how you add a city later.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npm run seed:cities
 *
 *   # add or replace the list
 *   npm run seed:cities -- "כפר סבא" "אריאל" "רעננה"
 *
 * The service account key comes from:
 *   Firebase console → Project settings → Service accounts → Generate new
 *   private key. Keep it out of git; .gitignore already covers it.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** The six cities in use in the Sharon area today. */
const DEFAULT_CITIES = [
  'כפר סבא',
  'אריאל',
  'חדרה',
  'פתח תקווה',
  'נתניה',
  'הרצליה',
];

const cities = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_CITIES;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
      'Point it at a service account key JSON file and run again.',
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

const db = getFirestore();

await db.doc('config/cities').set({ list: cities });

console.log(`Seeded config/cities with ${cities.length} cities:`);
for (const city of cities) console.log(`  · ${city}`);
