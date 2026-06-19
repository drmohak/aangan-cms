// ================================================================
//  CONFIGURATION MODULE  (Step 12)
//  Services master, clinic settings, ANC/reminder schedule editors
// ================================================================

const DEFAULT_CLINIC_SETTINGS = {
  name:     'Aangan Clinic',
  subtitle: "Women\u2019s Health Centre",
  address:  '',
  phone:    '',
  email:    ''
};

const SERVICE_CATEGORIES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'vaccination',  label: 'Vaccination'  },
  { value: 'procedure',    label: 'Procedure'     },
  { value: 'other',        label: 'Other'         }
];

// ----------------------------------------------------------------
//  CLINIC SETTINGS
// ----------------------------------------------------------------

async function getClinicSettings() {
  const doc = await db.collection('meta').doc('clinicSettings').get();
  return doc.exists ? { ...DEFAULT_CLINIC_SETTINGS, ...doc.data() } : { ...DEFAULT_CLINIC_SETTINGS };
}

async function saveClinicSettings(data) {
  await db.collection('meta').doc('clinicSettings').set(data, { merge: true });
}

// ----------------------------------------------------------------
//  SERVICES MASTER LIST
// ----------------------------------------------------------------

async function getAllServices() {
  const snap = await db.collection('services').get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function getActiveServices() {
  const snap = await db.collection('services')
    .where('isActive', '==', true)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function createService(data) {
  await db.collection('services').add({
    name:          data.name.trim(),
    defaultAmount: parseFloat(data.defaultAmount) || 0,
    category:      data.category || 'consultation',
    isActive:      true,
    createdAt:     firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function updateService(id, data) {
  await db.collection('services').doc(id).update({
    name:          data.name.trim(),
    defaultAmount: parseFloat(data.defaultAmount) || 0,
    category:      data.category || 'consultation',
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function toggleServiceActive(id, isActive) {
  await db.collection('services').doc(id).update({ isActive });
}

async function deleteService(id) {
  await db.collection('services').doc(id).delete();
}

// ----------------------------------------------------------------
//  ANC SCHEDULE CONFIG
// ----------------------------------------------------------------

async function getAncScheduleConfig() {
  const doc = await db.collection('meta').doc('ancSchedule').get();
  return doc.exists ? [...doc.data().weeks] : [...ANC_WEEKS];
}

async function saveAncScheduleConfig(weeks) {
  await db.collection('meta').doc('ancSchedule').set({ weeks });
}

// ----------------------------------------------------------------
//  REMINDER SCHEDULE CONFIG
// ----------------------------------------------------------------

async function getReminderSchedulesConfig() {
  const doc = await db.collection('meta').doc('reminderSchedules').get();
  return doc.exists ? doc.data() : { ...REMINDER_SCHEDULES };
}

async function saveReminderSchedulesConfig(schedules) {
  await db.collection('meta').doc('reminderSchedules').set(schedules);
}

// ----------------------------------------------------------------
//  USER MANAGEMENT  (RBAC)
// ----------------------------------------------------------------

async function getUsers() {
  const snap = await db.collection('users').get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
}

async function addUser(email, data) {
  const key = email.toLowerCase().trim();
  await db.collection('users').doc(key).set({
    name:     (data.name || '').trim() || key,
    role:     data.role || 'staff',
    isActive: true,
    addedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    addedBy:  (firebase.auth().currentUser || {}).email || ''
  });
}

async function updateUserRole(email, role) {
  await db.collection('users').doc(email.toLowerCase()).update({ role });
}

async function toggleUserActive(email, isActive) {
  await db.collection('users').doc(email.toLowerCase()).update({ isActive });
}

async function removeUser(email) {
  await db.collection('users').doc(email.toLowerCase()).delete();
}
