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
