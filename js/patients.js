// ================================================================
//  PATIENT MODULE — DB OPERATIONS + UTILITIES
//  All functions here are global and available to app.js.
// ================================================================

// ---- Shared helpers ----

function patientInitials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2)
    .map(n => n[0].toUpperCase()).join('');
}

function patientAvatarClass(name) {
  if (!name) return 'avatar-teal';
  const c = name.trim().toUpperCase().charCodeAt(0);
  if (c <= 68)  return 'avatar-teal';    // A–D
  if (c <= 76)  return 'avatar-blue';    // E–L
  if (c <= 82)  return 'avatar-purple';  // M–R
  return 'avatar-amber';                  // S–Z
}

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDateIn(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function waLink(mobile, name, clinicMsg) {
  if (!mobile) return null;
  const phone = '91' + mobile.replace(/\D/g, '');
  const text = clinicMsg || ('Dear ' + (name || 'patient') + ',\n\nThis is a message from Aangan Clinic.\n\nPlease contact us if you have any questions.');
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
}

// ---- Patient ID counter ----

async function generatePatientId() {
  const counterRef = db.collection('meta').doc('counters');
  let newSerial;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      newSerial = 1;
      tx.set(counterRef, { patientSerial: 1 });
    } else {
      newSerial = (snap.data().patientSerial || 0) + 1;
      tx.update(counterRef, {
        patientSerial: firebase.firestore.FieldValue.increment(1)
      });
    }
  });
  return 'P-' + String(newSerial).padStart(4, '0');
}

// ---- CRUD ----

async function getAllPatients() {
  const snap = await db.collection('patients')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getPatient(id) {
  const doc = await db.collection('patients').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createPatient(formData) {
  const patientId = await generatePatientId();
  const data = {
    patientId,
    name:        formData.name.trim(),
    mobile:      formData.mobile.trim(),
    dob:         formData.dob    || null,
    bloodGroup:  formData.bloodGroup  || null,
    address:     formData.address.trim()     || null,
    husbandName: formData.husbandName.trim() || null,
    waConsent:   !!formData.waConsent,
    type:        'adult',
    nameLower:   formData.name.trim().toLowerCase(),
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection('patients').add(data);
  return { id: ref.id, ...data };
}

async function updatePatient(id, formData) {
  const data = {
    name:        formData.name.trim(),
    mobile:      formData.mobile.trim(),
    dob:         formData.dob    || null,
    bloodGroup:  formData.bloodGroup  || null,
    address:     formData.address.trim()     || null,
    husbandName: formData.husbandName.trim() || null,
    waConsent:   !!formData.waConsent,
    nameLower:   formData.name.trim().toLowerCase(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('patients').doc(id).update(data);
  return { id, ...data };
}
