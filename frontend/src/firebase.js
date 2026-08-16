import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase client configuration
// Replace environment variables or values below with your Firebase project credentials
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyForDisasterVictimDetection123",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "disaster-victim-detection.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "disaster-victim-detection",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "disaster-victim-detection.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abc123def456789"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

export default app;
