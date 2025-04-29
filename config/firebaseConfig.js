// config/firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtZ0DM_AJ4xCthLsdxIXTYGdOmdTDyqlQ",
  authDomain: "triviadare-92612.firebaseapp.com",
  databaseURL: "https://triviadare-92612-default-rtdb.firebaseio.com",
  projectId: "triviadare-92612",
  storageBucket: "triviadare-92612.firebasestorage.app",
  messagingSenderId: "387771805925",
  appId: "1:387771805925:web:372e4a956fb8cfbdd9e40c"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get auth instance if it exists, or initialize it
let auth;
try {
  auth = getAuth();
} catch (error) {
  if (Platform.OS !== 'web') {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    auth = getAuth(app);
  }
}

// Initialize Firebase database
const database = getDatabase(app);

// Add debug logging for troubleshooting
console.log('[Firebase Config] App initialized:', app.name);
console.log('[Firebase Config] Auth initialized:', !!auth);
console.log('[Firebase Config] Database initialized:', !!database);

export { app, auth, database };