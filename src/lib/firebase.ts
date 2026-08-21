import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/** Firebase web config.
 *
 *  These values are **not secrets** and are meant to ship in the bundle — the apiKey is a
 *  project identifier that routes requests, not a credential. Every Firebase web app exposes
 *  them. What actually protects an account is Firebase Auth verifying the password server
 *  side, plus security rules on whatever data the project stores. Hiding this file would buy
 *  nothing and would stop the app building from a clean clone. */
const config = {
  apiKey: 'AIzaSyCcjaZ1StFsuobpok0GiZDQhvPJSoaGe7w',
  authDomain: 'runway-planner.firebaseapp.com',
  projectId: 'runway-planner',
  storageBucket: 'runway-planner.firebasestorage.app',
  messagingSenderId: '868329979099',
  appId: '1:868329979099:web:3b6eeb19e9f628e9c9e0fe',
};

export const firebaseApp = initializeApp(config);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** Stay signed in across restarts. The gate is the account, not a per-session lock. */
void setPersistence(auth, browserLocalPersistence);
