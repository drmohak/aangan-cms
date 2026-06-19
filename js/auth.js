// ================================================================
//  AUTHENTICATION + USER ACCESS
// ================================================================

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
}

async function signOutUser() {
  return firebase.auth().signOut();
}

// ----------------------------------------------------------------
//  checkUserAccess(email)
//  Returns { role, name } or null if access denied.
//  Priority: users/ collection (role-based) → legacy meta/whitelist
// ----------------------------------------------------------------

async function checkUserAccess(email) {
  const key = email.toLowerCase().trim();

  // 1. New role-based users collection
  try {
    const doc = await db.collection('users').doc(key).get();
    if (doc.exists) {
      const d = doc.data();
      if (d.isActive === false) return null;
      return { role: d.role || 'staff', name: d.name || email };
    }
  } catch(e) { console.warn('User registry read failed:', e); }

  // 2. Legacy whitelist fallback (transition period — grants doctor role)
  try {
    const wl = await db.collection('meta').doc('whitelist').get();
    if (!wl.exists) return { role: 'doctor', name: email }; // dev: no whitelist = open
    const list = (wl.data().emails || []).map(e => e.toLowerCase().trim());
    if (list.includes(key)) return { role: 'doctor', name: email };
  } catch(e) { console.warn('Legacy whitelist read failed:', e); }

  return null; // access denied
}
