// ================================================================
//  ENCOUNTERS + CONTACT LOG MODULE  (Steps 8 & 9)
// ================================================================

const CLINIC_DOCTORS = [
  'Dr. Chetali Bansal',
  'Dr. Megha Shah',
  'Dr. Abhishek Bansal'
];

const CONTACT_OUTCOMES = [
  { value: 'confirmed_coming',    label: 'Confirmed coming' },
  { value: 'coming_later',        label: 'Coming later' },
  { value: 'no_response',         label: 'No response' },
  { value: 'wrong_number',        label: 'Wrong number' },
  { value: 'declined',            label: 'Declined' },
  { value: 'completed_elsewhere', label: 'Completed elsewhere' }
];

const OUTCOME_PILL = {
  confirmed_coming:    'pill-teal',
  coming_later:        'pill-blue',
  no_response:         'pill-amber',
  wrong_number:        'pill-amber',
  declined:            'pill-red',
  completed_elsewhere: 'pill-gray'
};

// ----------------------------------------------------------------
//  COMPLETE A FOLLOW-UP CASE
//  Marks case as completed + cancels all pending reminder tasks
// ----------------------------------------------------------------

async function completeFollowupCase(caseId) {
  const snap = await db.collection('reminderTasks')
    .where('followupCaseId', '==', caseId)
    .get();

  const batch = db.batch();

  snap.docs.forEach(doc => {
    if (doc.data().status === 'pending') {
      batch.update(doc.ref, {
        status:    'skipped',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });

  batch.update(db.collection('followupCases').doc(caseId), {
    status:      'completed',
    completedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
}

// ----------------------------------------------------------------
//  ENCOUNTERS
// ----------------------------------------------------------------

async function createEncounter(data) {
  const ref = db.collection('encounters').doc();
  await ref.set({
    patientDocId:         data.patientDocId,
    patientName:          data.patientName,
    patientId:            data.patientId,
    date:                 data.date,
    doctorName:           data.doctorName,
    notes:                data.notes     || null,
    diagnosis:            data.diagnosis || null,
    completedFollowupIds: data.completedFollowupIds || [],
    createdAt:            firebase.firestore.FieldValue.serverTimestamp(),
    createdBy:            firebase.auth().currentUser?.email || null
  });

  for (const caseId of (data.completedFollowupIds || [])) {
    await completeFollowupCase(caseId);
  }

  return ref.id;
}

async function getPatientEncounters(patientDocId) {
  const snap = await db.collection('encounters')
    .where('patientDocId', '==', patientDocId)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ----------------------------------------------------------------
//  CONTACT LOGS
// ----------------------------------------------------------------

async function logContactOutcome(followupCaseId, patientDocId, patientName, outcome, notes) {
  await db.collection('contactLogs').add({
    followupCaseId,
    patientDocId,
    patientName,
    outcome,
    notes:       notes || null,
    loggedBy:    firebase.auth().currentUser?.email || null,
    contactedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function getContactLogs(followupCaseId) {
  const snap = await db.collection('contactLogs')
    .where('followupCaseId', '==', followupCaseId)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.contactedAt?.seconds || 0) - (a.contactedAt?.seconds || 0));
}

// ----------------------------------------------------------------
//  DELETE ENCOUNTER  (superuser)
// ----------------------------------------------------------------

async function hardDeleteEncounter(encounter, reason) {
  await writeAuditLog('encounter', encounter.id, encounter, reason);
  await db.collection('encounters').doc(encounter.id).delete();
}
