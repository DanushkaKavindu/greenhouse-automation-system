import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  Timestamp,
} from 'firebase/firestore';
import { SensorData, ControlData, Thresholds } from './types';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase safely
let app: any;
let db: any;
let auth: any;
let isMockFirebase = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'mock-api-key-for-compilation-only') {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('Firebase initialized successfully with real credentials.');
  } else {
    throw new Error('Using placeholder configuration');
  }
} catch (e) {
  console.warn('Firebase real-initialize failed, using developer mock fallback:', e);
  isMockFirebase = true;
  app = {};
  db = {};
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => {
      // Return unauthenticated by default so they see Landing Page
      setTimeout(() => cb(null), 100);
      return () => {};
    },
    signOut: async () => {
      auth.currentUser = null;
      return Promise.resolve();
    }
  };
}

export { app, db, auth, isMockFirebase };

// 🤝 User Authentication Operations
export async function googleSignIn() {
  if (isMockFirebase) {
    // Simulate google sign in popup
    const mockUser = {
      uid: 'demo_user_123',
      displayName: 'Sri Lankan Cultivator',
      email: 'cultivator@greenhouse.lk',
      photoURL: null,
    };
    return Promise.resolve(mockUser);
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// 📅 Real Google Calendar integration. Firebase's own getIdToken() is NOT a
// usable Google API access token — it authenticates against YOUR backend,
// not Google's APIs. To actually write to the user's real Google Calendar
// we have to run a second Google sign-in that explicitly requests the
// calendar.events OAuth scope, and pull the Google access token out of the
// sign-in result (GoogleAuthProvider.credentialFromResult).
//
// Caveat worth knowing: this client-side popup flow only yields a
// short-lived access token (~1 hour) with no refresh token, so a sync will
// start failing after that hour until the user reconnects. A persistent
// integration would need a server-side OAuth flow that stores a refresh
// token — out of scope for this app's current architecture.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export interface GoogleCalendarToken {
  accessToken: string;
  expiresAt: number; // epoch ms — approximate, Google doesn't return this in the popup flow
}

export async function connectGoogleCalendar(): Promise<GoogleCalendarToken | null> {
  if (isMockFirebase) {
    // No real Firebase/Google project configured — there is no real
    // Google account to connect to in offline/demo mode.
    return null;
  }
  const provider = new GoogleAuthProvider();
  provider.addScope(GOOGLE_CALENDAR_SCOPE);
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) return null;
  return {
    accessToken: credential.accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
}

export function isGoogleCalendarTokenValid(token: GoogleCalendarToken | null): token is GoogleCalendarToken {
  return !!token && Date.now() < token.expiresAt;
}

// Creates a REAL all-day event on the signed-in user's primary Google
// Calendar via the Calendar v3 REST API. Throws on failure — callers should
// show the real error rather than pretending it succeeded.
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: { summary: string; description: string; dateStr: string }
): Promise<void> {
  const endDate = new Date(`${event.dateStr}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { date: event.dateStr },
      end: { date: endDateStr },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Calendar API error ${res.status}: ${body || res.statusText}`);
  }
}

export async function registerUser(email: string, pass: string) {
  if (isMockFirebase) {
    const mockUserCredential = {
      user: {
        uid: 'demo_' + Date.now(),
        email,
        displayName: 'New Chilli Grower',
        photoURL: null,
      }
    };
    return Promise.resolve(mockUserCredential);
  }
  return createUserWithEmailAndPassword(auth, email, pass);
}

export async function loginUser(email: string, pass: string) {
  if (isMockFirebase) {
    const mockUserCredential = {
      user: {
        uid: 'demo_user_123',
        email,
        displayName: 'Green Chilli Cultivator (Demo)',
        photoURL: null,
      }
    };
    return Promise.resolve(mockUserCredential);
  }
  return signInWithEmailAndPassword(auth, email, pass);
}

// 📡 real-time Firestore database hooks
export function onSensorChange(callback: (data: Partial<SensorData> | null) => void) {
  if (isMockFirebase || !db) {
    return () => {};
  }

  // Listen to standard 'sensors/current'
  const sensorDocRef = doc(db, 'sensors', 'current');
  const unsub1 = onSnapshot(sensorDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Partial<SensorData>);
    }
  }, (error) => {
    console.warn('Firestore sensors/current subscription:', error?.message);
  });

  // Also listen to 'sensor_telemetry/latest_reading' for standard ESP32 REST POSTs
  const telemetryDocRef = doc(db, 'sensor_telemetry', 'latest_reading');
  const unsub2 = onSnapshot(telemetryDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const d = snapshot.data();
      callback({
        temperature: d.temperature ?? d.temp,
        humidity: d.humidity ?? d.hum,
        soilMoisture: d.soilMoisture ?? d.soil,
        lightIntensity: d.lightIntensity ?? d.lightLux ?? d.light,
        nitrogen: d.nitrogen ?? d.n,
        phosphorus: d.phosphorus ?? d.p,
        potassium: d.potassium ?? d.k,
      });
    }
  }, (error) => {
    console.warn('Firestore sensor_telemetry subscription:', error?.message);
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export function onControlChange(callback: (data: Partial<ControlData> | null) => void) {
  if (isMockFirebase) {
    return () => {};
  }
  const controlDocRef = doc(db, 'controls', 'current');
  return onSnapshot(controlDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Partial<ControlData>);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Firestore controls subscription error:', error);
  });
}

export async function updateSensorNode(data: Partial<SensorData>) {
  if (isMockFirebase) return Promise.resolve();
  try {
    const sensorDocRef = doc(db, 'sensors', 'current');
    await setDoc(sensorDocRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'sensors/current');
  }
}

export async function updateControlNode(data: Partial<ControlData>) {
  if (isMockFirebase) return Promise.resolve();
  try {
    const controlDocRef = doc(db, 'controls', 'current');
    await setDoc(controlDocRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'controls/current');
  }
}

export function onThresholdChange(callback: (data: Partial<Thresholds> | null) => void) {
  if (isMockFirebase) {
    return () => {};
  }
  const thresholdDocRef = doc(db, 'thresholds', 'current');
  return onSnapshot(thresholdDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Partial<Thresholds>);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Firestore thresholds subscription error:', error);
  });
}

export async function updateThresholdNode(data: Partial<Thresholds>) {
  if (isMockFirebase) return Promise.resolve();
  try {
    const thresholdDocRef = doc(db, 'thresholds', 'current');
    await setDoc(thresholdDocRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'thresholds/current');
  }
}


// 📈 Real sensor history — logged by the server on every real /api/telemetry
// POST from the ESP32. Powers the Dashboard's daily-average card, the
// calendar's per-day summary, and the Reports page's charts/exports. Never
// fabricates data: an empty/missing range simply comes back as [].
export interface SensorReadingLog {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightIntensity: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  fanStatus: boolean;
  pumpStatus: boolean;
  lightStatus: boolean;
  ts: number; // epoch milliseconds
}

const SENSOR_LOG_COLLECTION = 'sensor_readings_log';

export async function fetchReadingsInRange(startMs: number, endMs: number, maxResults = 3000): Promise<SensorReadingLog[]> {
  if (isMockFirebase || !db) return [];
  try {
    const readingsRef = collection(db, SENSOR_LOG_COLLECTION);
    const q = query(
      readingsRef,
      where('ts', '>=', Timestamp.fromMillis(startMs)),
      where('ts', '<', Timestamp.fromMillis(endMs)),
      orderBy('ts', 'asc'),
      fsLimit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      const tsValue = data.ts;
      const tsMs = tsValue && typeof tsValue.toMillis === 'function'
        ? tsValue.toMillis()
        : (typeof tsValue === 'number' ? tsValue : Date.now());
      return {
        temperature: Number(data.temperature) || 0,
        humidity: Number(data.humidity) || 0,
        soilMoisture: Number(data.soilMoisture) || 0,
        lightIntensity: Number(data.lightIntensity) || 0,
        nitrogen: Number(data.nitrogen) || 0,
        phosphorus: Number(data.phosphorus) || 0,
        potassium: Number(data.potassium) || 0,
        fanStatus: Boolean(data.fanStatus),
        pumpStatus: Boolean(data.pumpStatus),
        lightStatus: Boolean(data.lightStatus),
        ts: tsMs,
      } as SensorReadingLog;
    });
  } catch (err) {
    console.warn('Failed to read sensor_readings_log:', (err as any)?.message || err);
    return [];
  }
}


// Define OperationType and Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || 'anonymous',
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || false,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
