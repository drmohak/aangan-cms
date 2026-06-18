// ================================================================
//  FOLLOW-UP MODULE
//  IAP vaccination schedule + ANC schedule (editable in Step 12)
//  All Firestore operations for follow-up cases
// ================================================================

// ----------------------------------------------------------------
//  ANC SCHEDULE
//  Stored here as default. Step 12 will allow editing via UI.
//  Weeks from LMP date.
// ----------------------------------------------------------------

const ANC_WEEKS = [8, 12, 16, 20, 24, 28, 32, 36, 38, 40];

// ----------------------------------------------------------------
//  IAP VACCINATION SCHEDULE  (2023)
//  offsetDays = days from date of birth
//  Step 12 will allow editing this master table via UI.
// ----------------------------------------------------------------

const IAP_VACCINES = [
  { code: 'BCG',     name: 'BCG',               ageLabel: 'At birth',     offsetDays: 0,    doseNumber: 1 },
  { code: 'HEPB1',   name: 'Hepatitis B',        ageLabel: 'At birth',     offsetDays: 0,    doseNumber: 1 },
  { code: 'OPV0',    name: 'OPV',                ageLabel: 'At birth',     offsetDays: 0,    doseNumber: 1 },
  { code: 'PCV1',    name: 'PCV',                ageLabel: '6 weeks',      offsetDays: 42,   doseNumber: 1 },
  { code: 'ROTA1',   name: 'Rotavirus',          ageLabel: '6 weeks',      offsetDays: 42,   doseNumber: 1 },
  { code: 'OPV1',    name: 'OPV',                ageLabel: '6 weeks',      offsetDays: 42,   doseNumber: 2 },
  { code: 'PENTA1',  name: 'Pentavalent',        ageLabel: '6 weeks',      offsetDays: 42,   doseNumber: 1 },
  { code: 'ROTA2',   name: 'Rotavirus',          ageLabel: '10 weeks',     offsetDays: 70,   doseNumber: 2 },
  { code: 'OPV2',    name: 'OPV',                ageLabel: '10 weeks',     offsetDays: 70,   doseNumber: 3 },
  { code: 'PENTA2',  name: 'Pentavalent',        ageLabel: '10 weeks',     offsetDays: 70,   doseNumber: 2 },
  { code: 'IPV1',    name: 'IPV',                ageLabel: '14 weeks',     offsetDays: 98,   doseNumber: 1 },
  { code: 'PCV2',    name: 'PCV',                ageLabel: '14 weeks',     offsetDays: 98,   doseNumber: 2 },
  { code: 'ROTA3',   name: 'Rotavirus',          ageLabel: '14 weeks',     offsetDays: 98,   doseNumber: 3 },
  { code: 'OPV3',    name: 'OPV',                ageLabel: '14 weeks',     offsetDays: 98,   doseNumber: 4 },
  { code: 'PENTA3',  name: 'Pentavalent',        ageLabel: '14 weeks',     offsetDays: 98,   doseNumber: 3 },
  { code: 'MR1',     name: 'MR / MMR',           ageLabel: '9 months',     offsetDays: 270,  doseNumber: 1 },
  { code: 'PCVB',    name: 'PCV Booster',        ageLabel: '9 months',     offsetDays: 270,  doseNumber: 3 },
  { code: 'TYPH',    name: 'Typhoid Conjugate',  ageLabel: '9 months',     offsetDays: 270,  doseNumber: 1 },
  { code: 'HEPA1',   name: 'Hepatitis A',        ageLabel: '12 months',    offsetDays: 365,  doseNumber: 1 },
  { code: 'VAR1',    name: 'Varicella',          ageLabel: '15 months',    offsetDays: 456,  doseNumber: 1 },
  { code: 'MMR2',    name: 'MMR',                ageLabel: '15 months',    offsetDays: 456,  doseNumber: 2 },
  { code: 'DTPB1',   name: 'DTP Booster',        ageLabel: '16–18 months', offsetDays: 487,  doseNumber: 1 },
  { code: 'OPVB1',   name: 'OPV Booster',        ageLabel: '16–18 months', offsetDays: 487,  doseNumber: 5 },
  { code: 'IPV2',    name: 'IPV Booster',        ageLabel: '16–18 months', offsetDays: 487,  doseNumber: 2 },
  { code: 'HEPA2',   name: 'Hepatitis A',        ageLabel: '18 months',    offsetDays: 548,  doseNumber: 2 },
  { code: 'VAR2',    name: 'Varicella',          ageLabel: '18 months',    offsetDays: 548,  doseNumber: 2 },
  { code: 'DTPB2',   name: 'DTP Booster 2',      ageLabel: '5 years',      offsetDays: 1825, doseNumber: 2 },
  { code: 'TDAP',    name: 'Tdap / Td',          ageLabel: '10 years',     offsetDays: 3650, doseNumber: 1 },
];

// ----------------------------------------------------------------
//  DATE HELPERS
// ----------------------------------------------------------------

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addWeeks(isoDate, weeks) {
  return addDays(isoDate, weeks * 7);
}

function calcEdd(lmp) {
  return addDays(lmp, 280);
}

// Group vaccine list by ageLabel for display
function groupVaccinesByAge(vaccines, dob) {
  const groups = {};
  vaccines.forEach(v => {
    const dueDate = addDays(dob, v.offsetDays);
    if (!groups[v.ageLabel]) groups[v.ageLabel] = { ageLabel: v.ageLabel, dueDate, vaccines: [] };
    groups[v.ageLabel].vaccines.push(v);
  });
  return Object.values(groups);
}

// ----------------------------------------------------------------
//  CREATE FOLLOW-UPS  (batch writes)
// ----------------------------------------------------------------

async function createAncFollowups(patient, lmp) {
  const edd = calcEdd(lmp);
  const batch = db.batch();
  ANC_WEEKS.forEach(weeks => {
    const ref = db.collection('followupCases').doc();
    batch.set(ref, {
      patientDocId:  patient.id,
      patientName:   patient.name,
      patientId:     patient.patientId,
      followupType:  'anc',
      subType:       'ANC ' + weeks + '-week visit',
      weekNumber:    weeks,
      lmp,
      edd,
      dueDate:       addWeeks(lmp, weeks),
      status:        'active',
      notes:         null,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  return { edd, visitCount: ANC_WEEKS.length };
}

async function createVaccinationFollowups(patient, dob) {
  const batch = db.batch();
  IAP_VACCINES.forEach(v => {
    const ref = db.collection('followupCases').doc();
    batch.set(ref, {
      patientDocId:  patient.id,
      patientName:   patient.name,
      patientId:     patient.patientId,
      followupType:  'vaccination',
      subType:       v.name + ' — Dose ' + v.doseNumber,
      vaccineName:   v.name,
      vaccineCode:   v.code,
      ageAtDose:     v.ageLabel,
      doseNumber:    v.doseNumber,
      dob,
      dueDate:       addDays(dob, v.offsetDays),
      status:        'active',
      notes:         null,
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  return { vaccineCount: IAP_VACCINES.length };
}

async function createPostProcedureFollowup(patient, data) {
  await db.collection('followupCases').add({
    patientDocId:   patient.id,
    patientName:    patient.name,
    patientId:      patient.patientId,
    followupType:   'post_procedure',
    subType:        data.procedureType + ' — post-op review',
    procedureType:  data.procedureType,
    dueDate:        data.dueDate,
    status:         'active',
    notes:          data.notes || null,
    createdAt:      firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function createAnnualRecallFollowup(patient, data) {
  await db.collection('followupCases').add({
    patientDocId:  patient.id,
    patientName:   patient.name,
    patientId:     patient.patientId,
    followupType:  'annual_recall',
    subType:       data.recallType,
    recallType:    data.recallType,
    dueDate:       data.dueDate,
    status:        'active',
    notes:         data.notes || null,
    createdAt:     firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ----------------------------------------------------------------
//  READ FOLLOW-UPS
// ----------------------------------------------------------------

async function getPatientFollowups(patientDocId) {
  const snap = await db.collection('followupCases')
    .where('patientDocId', '==', patientDocId)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

async function getFollowupCase(id) {
  const doc = await db.collection('followupCases').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function updateFollowupStatus(id, status, notes) {
  await db.collection('followupCases').doc(id).update({
    status,
    notes:     notes || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function hasFollowupsOfType(patientDocId, followupType) {
  const snap = await db.collection('followupCases')
    .where('patientDocId', '==', patientDocId)
    .get();
  return snap.docs.some(doc => doc.data().followupType === followupType);
}
