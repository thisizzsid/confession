import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Interface for the service account object
interface ServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  [key: string]: any;
}

if (!admin.apps.length) {
  try {
    let serviceAccount: ServiceAccount | undefined;

    // 1. Try environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (e) {
        console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY environment variable");
      }
    }

    // 2. Try local file (development/fallback)
    if (!serviceAccount) {
      try {
        serviceAccount = JSON.parse(
          readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
        ) as ServiceAccount;
      } catch (e) {
        // File not found or invalid, ignore
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn("⚠️ Firebase Admin: No 'serviceAccountKey.json' or 'FIREBASE_SERVICE_ACCOUNT_KEY' found.");
      console.warn("   Attempting to use Application Default Credentials (ADC)...");
      
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'emesispro',
        });
      } catch (error) {
        console.error("\n❌ FATAL: Failed to initialize Firebase Admin with Default Credentials.");
        console.error("   To fix this:");
        console.error("   1. Download service account key from Firebase Console -> Project Settings -> Service Accounts");
        console.error("   2. Save as 'serviceAccountKey.json' in project root OR set FIREBASE_SERVICE_ACCOUNT_KEY in .env\n");
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

// Helper to create a proxy that throws error on usage if initialization failed
const createServiceProxy = (name: string) => new Proxy({}, {
  get: (_target, prop) => {
    if (prop === 'then') return undefined; // Avoid Promise issues
    throw new Error(`Firebase Admin ${name} service is not available. Initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY or serviceAccountKey.json.`);
  }
});

let firestore: admin.firestore.Firestore;
let messaging: admin.messaging.Messaging;

try {
  if (admin.apps.length) {
    firestore = admin.firestore();
    messaging = admin.messaging();
  } else {
    // If we reached here without apps, initialization failed completely
    // But we caught it above, so apps.length is 0
    throw new Error("No Firebase Admin app initialized");
  }
} catch (e) {
  console.error("Error accessing Firebase Admin services:", e);
  firestore = createServiceProxy("Firestore") as any;
  messaging = createServiceProxy("Messaging") as any;
}

export const adminDb = firestore;
export const adminMessaging = messaging;
