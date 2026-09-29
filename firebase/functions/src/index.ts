import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

// europe-west1 — the tester works in Israel, and keeping the function near the
// Firestore location keeps the stats update behind a save imperceptible.
// This must match the region the Firestore database was created in.
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

/**
 * "2026-09" for a test date, in Israel time. Dates are stored as local midnight
 * in Israel, which is the previous evening in UTC — a UTC month would file every
 * test on the 1st under the month before.
 */
const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
});
function monthKey(date: Timestamp): string {
  return monthFormat.format(date.toDate()).slice(0, 7);
}

interface MonthStats {
  passed: number;
  failed: number;
  lastTestDate: Timestamp;
}

/**
 * Maintain `testers/{uid}/teacherStats/{teacherId}`.
 *
 * This replaces the spreadsheet's live QUERY/PIVOT — the one thing the tester
 * actually cares about. Because the aggregate is stored, the teacher list reads
 * one small document per teacher instead of every test ever recorded, and stays
 * O(1) per teacher no matter how many years accumulate.
 *
 * Recompute strategy: the handler re-counts the teacher's tests rather than
 * applying a +1/-1 delta to the stored figure. Deltas are O(1) but drift
 * permanently on any missed, duplicated or out-of-order delivery — and Cloud
 * Functions guarantee at-least-once, not exactly-once, delivery. A recount is
 * idempotent, so a redelivered event is harmless and any historical drift
 * self-heals on the teacher's next write.
 *
 * The cost of that choice is one read per test document per write, bounded by
 * the tests recorded against a single teacher — tens, not thousands, for a
 * working examiner. If a teacher ever reaches the low thousands of tests,
 * revisit this with a transactional delta plus a periodic reconciliation job.
 */
export const updateTeacherStats = onDocumentWritten(
  'testers/{uid}/teachers/{teacherId}/tests/{testId}',
  async (event) => {
    const { uid, teacherId } = event.params;

    const before = event.data?.before;
    const after = event.data?.after;

    // A no-op write (for example a field update that changed nothing relevant)
    // still triggers the function; recounting is cheap but pointless here.
    if (before?.exists && after?.exists) {
      const b = before.data();
      const a = after.data();
      const sameResult = b?.result === a?.result;
      const sameDate =
        (b?.date as Timestamp | undefined)?.toMillis() ===
        (a?.date as Timestamp | undefined)?.toMillis();
      if (sameResult && sameDate) return;
    }

    const testsRef = db
      .collection('testers')
      .doc(uid)
      .collection('teachers')
      .doc(teacherId)
      .collection('tests');

    const statsRef = db
      .collection('testers')
      .doc(uid)
      .collection('teacherStats')
      .doc(teacherId);

    const snap = await testsRef.get();

    let passed = 0;
    let failed = 0;
    let lastTestDate: Timestamp | null = null;
    const byMonth: Record<string, MonthStats> = {};

    for (const doc of snap.docs) {
      const data = doc.data();

      const isPass = data.result === 'pass';
      if (isPass) passed++;
      else if (data.result === 'fail') failed++;
      else {
        // Neither enum value. Counting it would quietly distort the record the
        // tester makes decisions from, so it is excluded and surfaced instead.
        logger.warn('Test document has an unrecognised result; excluded', {
          uid,
          teacherId,
          testId: doc.id,
          result: data.result,
        });
        continue;
      }

      const date = data.date as Timestamp | undefined;
      if (!date) continue;
      if (!lastTestDate || date.toMillis() > lastTestDate.toMillis()) {
        lastTestDate = date;
      }

      // Per-month buckets back the list's month/year filter, so filtering never
      // means reading tests on the client.
      const key = monthKey(date);
      const month = (byMonth[key] ??= { passed: 0, failed: 0, lastTestDate: date });
      if (isPass) month.passed++;
      else month.failed++;
      if (date.toMillis() > month.lastTestDate.toMillis()) month.lastTestDate = date;
    }

    const total = passed + failed;

    if (total === 0) {
      // Last test removed. Deleting the document rather than storing zeroes
      // keeps "never tested" distinguishable from "tested, all records since
      // deleted", which the list screen uses to avoid showing a 0% badge on a
      // teacher who has simply never been tested.
      await statsRef.delete();
      logger.info('Removed empty teacherStats', { uid, teacherId });
      return;
    }

    // A full replace, not a merge: merging would deep-merge `byMonth` and keep
    // a month bucket alive after its last test was moved or deleted.
    await statsRef.set({
      passed,
      failed,
      total,
      // Not in the original spec's field list. It is additive derived data,
      // and it is what makes the list's "recently tested" sort mean the date
      // of the most recent test rather than the moment a row was last edited.
      lastTestDate,
      byMonth,
      updatedAt: Timestamp.now(),
    });

    logger.info('Updated teacherStats', { uid, teacherId, passed, failed, total });
  },
);
