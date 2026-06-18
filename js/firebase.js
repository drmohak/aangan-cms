// ================================================================
//  FIREBASE CONFIGURATION — Aangan Clinic
// ================================================================

const firebaseConfig = {
  apiKey:            "AIzaSyCXVLTCouhh_E9BiJeXsjZJjidHS4gS9HY",
  authDomain:        "aangan-85dc2.firebaseapp.com",
  projectId:         "aangan-85dc2",
  storageBucket:     "aangan-85dc2.firebasestorage.app",
  messagingSenderId: "658696064194",
  appId:             "1:658696064194:web:b02f0cf03fa308e8bdff5b"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// ----------------------------------------------------------------
//  Firestore rules in production mode:
//  allow read, write: if request.auth != null;
// ----------------------------------------------------------------
