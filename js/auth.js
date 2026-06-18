// ================================================================
//  AUTHENTICATION HELPERS
// ================================================================

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
}

async function signOutUser() {
  return firebase.auth().signOut();
}

// ----------------------------------------------------------------
//  WHITELIST CHECK
//  Reads allowed emails from Firestore: meta/whitelist { emails: [] }
//  To add a user: Firebase Console → Firestore → meta → whitelist
//  → emails array → add their Google email address.
//  If the whitelist document does not exist, all Google sign-ins
//  are allowed (safe for early dev; create the doc to restrict access).
// ----------------------------------------------------------------

async function checkWhitelist(email) {
  try {
    const doc = await db.collection('meta').doc('whitelist').get();
    if (!doc.exists) return true;
    const emails = (doc.data().emails || []).map(e => e.toLowerCase().trim());
    return emails.includes(email.toLowerCase().trim());
  } catch (e) {
    console.error('Whitelist check failed:', e);
    return false;
  }
}
