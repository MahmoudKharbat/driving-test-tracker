/**
 * Compile-time check that the two backends are interchangeable.
 *
 * metro.config.js swaps the Firebase modules for the local ones at bundle time,
 * so the screens — typechecked against Firebase — call whichever is bundled.
 * If the local module drifts (a missing export, a different signature), this
 * file stops compiling and `npm run typecheck` fails. Never imported at runtime.
 */
import type * as FirebaseAuth from './firebase/auth';
import type * as LocalAuth from './local/auth';
import type * as FirebaseData from './firebase/data';
import type * as LocalData from './local/data';

type Assert<T extends true> = T;
type Implements<Local, Contract> = Local extends Contract ? true : false;

export type AuthContract = Assert<Implements<typeof LocalAuth, typeof FirebaseAuth>>;
export type DataContract = Assert<Implements<typeof LocalData, typeof FirebaseData>>;
