// ================================================================
//  FIREBASE CONFIGURATION
//  Replace every placeholder value with your real Firebase config.
//  Firebase Console → Project Settings → Your Apps → SDK setup
// ================================================================

const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// ----------------------------------------------------------------
//  NOTE FOR DEVELOPMENT
//  Set Firestore security rules to allow all reads and writes
//  while building. Replace with proper rules before going live.
//
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      match /{document=**} {
//        allow read, write: if true;
//      }
//    }
//  }
// ----------------------------------------------------------------
