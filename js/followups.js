// ================================================================
//  FOLLOW-UP MODULE
//  IAP vaccination schedule, ANC schedule, reminder engine
//  All Firestore operations for follow-up cases + reminder tasks
// ================================================================

// ----------------------------------------------------------------
//  REMINDER SCHEDULES  (days before due date)
//  Step 12 will allow editing these via UI
// ----------------------------------------------------------------

const REMINDER_SCHEDULES = {
  anc:            [14, 7, 1],
  vaccination:    [30, 7, 1],
  post_procedure: [3, 1],
  annual_recall:  [30, 7, 1]
};

// ----------------------------------------------------------------
//  ANC SCHEDULE  (weeks from LMP)
// ----------------------------------------------------------------

const ANC_WEEKS = [8, 12, 16, 20, 24, 28, 32, 36, 38, 40];

// ----------------------------------------------------------------
//  IAP VACCINATION SCHEDULE  (2023)
//  offsetDays = days from date of birth
// ----------------------------------------------------------------

const IAP_VACCINES = [
  { code:'BCG',    name:'BCG',               ageLabel:'At birth',     offsetDays:0,    doseNumber:1 },
  { code:'HEPB1',  name:'Hepatitis B',        ageLabel:'At birth',     offsetDays:0,    doseNumber:1 },
  { code:'OPV0',   name:'OPV',                ageLabel:'At birth',     offsetDays:0,    doseNumber:1 },
  { code:'PCV1',   name:'PCV',                ageLabel:'6 weeks',      offsetDays:42,   doseNumber:1 },
  { code:'ROTA1',  name:'Rotavirus',          ageLabel:'6 weeks',      offsetDays:42,   doseNumber:1 },
  { code:'OPV1',   name:'OPV',                ageLabel:'6 weeks',      offsetDays:42,   doseNumber:2 },
  { code:'PENTA1', name:'Pentavalent',        ageLabel:'6 weeks',      offsetDays:42,   doseNumber:1 },
  { code:'ROTA2',  name:'Rotavirus',          ageLabel:'10 weeks',     offsetDays:70,   doseNumber:2 },
  { code:'OPV2',   name:'OPV',                ageLabel:'10 weeks',     offsetDays:70,   doseNumber:3 },
  { code:'PENTA2', name:'Pentavalent',        ageLabel:'10 weeks',     offsetDays:70,   doseNumber:2 },
  { code:'IPV1',   name:'IPV',                ageLabel:'14 weeks',     offsetDays:98,   doseNumber:1 },
  { code:'PCV2',   name:'PCV',                ageLabel:'14 weeks',     offsetDays:98,   doseNumber:2 },
  { code:'ROTA3',  name:'Rotavirus',          ageLabel:'14 weeks',     offsetDays:98,   doseNumber:3 },
  { code:'OPV3',   name:'OPV',                ageLabel:'14 weeks',     offsetDays:98,   doseNumber:4 },
  { code:'PENTA3', name:'Pentavalent',        ageLabel:'14 weeks',     offsetDays:98,   doseNumber:3 },
  { code:'MR1',    name:'MR / MMR',           ageLabel:'9 months',     offsetDays:270,  doseNumber:1 },
  { code:'PCVB',   name:'PCV Booster',        ageLabel:'9 months',     offsetDays:270,  doseNumber:3 },
  { code:'TYPH',   name:'Typhoid Conjugate',  ageLabel:'9 months',     offsetDays:270,  doseNumber:1 },
  { code:'HEPA1',  name:'Hepatitis A',        ageLabel:'12 months',    offsetDays:365,  doseNumber:1 },
  { code:'VAR1',   name:'Varicella',          ageLabel:'15 months',    offsetDays:456,  doseNumber:1 },
  { code:'MMR2',   name:'MMR',                ageLabel:'15 months',    offsetDays:456,  doseNumber:2 },
  { code:'DTPB1',  name:'DTP Booster',        ageLabel:'16–18 months', offsetDays:487,  doseNumber:1 },
  { code:'OPVB1',  name:'OPV Booster',        ageLabel:'16–18 months', offsetDays:487,  doseNumber:5 },
  { code:'IPV2',   name:'IPV Booster',        ageLabel:'16–18 months', offsetDays:487,  doseNumber:2 },
  { code:'HEPA2',  name:'Hepatitis A',        ageLabel:'18 months',    offsetDays:548,  doseNumber:2 },
  { code:'VAR2',   name:'Varicella',          ageLabel:'18 months',    offsetDays:548,  doseNumber:2 },
  { code:'DTPB2',  name:'DTP Booster 2',      ageLabel:'5 years',      offsetDays:1825, doseNumber:2 },
  { code:'TDAP',   name:'Tdap / Td',          ageLabel:'10 years',     offsetDays:3650, doseNumber:1 },
];

// ----------------------------------------------------------------
//  DATE HELPERS  (timezone-safe: always use local date parsing)
// ----------------------------------------------------------------

function _todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function addDays(isoDate, days) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function addWeeks(isoDate, weeks) {
  return addDays(isoDate, weeks * 7);
}

function calcEdd(lmp) {
  return addDays(lmp, 280);
}

function _fmtDate(iso) {
  if (!iso) return '\u2014';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

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
//  REMINDER ENGINE
//  Adds reminder tasks to a Firestore WriteBatch.
//  Called inside every follow-up creation batch.
// ----------------------------------------------------------------

function addReminderTasksToBatch(batch, followupCaseId, fc, patient) {
  const schedule = REMINDER_SCHEDULES[fc.followupType] || [7, 1];
  schedule.forEach(daysBefore => {
    const reminderDate = addDays(fc.dueDate, -daysBefore);
    if (!reminderDate) return;
    const taskRef = db.collection('reminderTasks').doc();
    batch.set(taskRef, {
      followupCaseId,
      patientDocId:  patient.id,
      patientName:   patient.name,
      patientId:     patient.patientId,
      patientMobile: patient.mobile || null,
      motherName:    patient.motherName || null,
      waConsent:     !!patient.waConsent,
      followupType:  fc.followupType,
      subType:       fc.subType,
      dueDate:       fc.dueDate,
      reminderDate,
      daysBeforeDue: daysBefore,
      status:        'pending',
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

// ----------------------------------------------------------------
//  WA LINK BUILDER FOR REMINDERS
// ----------------------------------------------------------------

function buildReminderWaLink(task) {
  if (!task.patientMobile || !task.waConsent) return null;
  const name  = task.motherName || task.patientName;
  const due   = _fmtDate(task.dueDate);
  const msg   = 'Dear ' + name + ',\n\n' +
    'This is a reminder from Aangan Clinic.\n\n' +
    'Your ' + task.subType + ' is due on ' + due + '.\n\n' +
    'Please call us to confirm your appointment.\n\n' +
    'Aangan Clinic';
  const phone = '91' + task.patientMobile.replace(/\D/g, '');
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
}

// ----------------------------------------------------------------
//  CREATE FOLLOW-UPS  (with reminder tasks in same batch)
// ----------------------------------------------------------------

async function createAncFollowups(patient, lmp) {
  const edd     = calcEdd(lmp);
  const weeks_  = await getEffectiveAncSchedule();
  const batch   = db.batch();

  weeks_.forEach(weeks => {
    const dueDate = addWeeks(lmp, weeks);
    const caseRef = db.collection('followupCases').doc();
    const fc = {
      patientDocId: patient.id,
      patientName:  patient.name,
      patientId:    patient.patientId,
      followupType: 'anc',
      subType:      'ANC ' + weeks + '-week visit',
      weekNumber:   weeks,
      lmp, edd, dueDate,
      status:       'active',
      notes:        null,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(caseRef, fc);
    addReminderTasksToBatch(batch, caseRef.id, fc, patient);
  });

  await batch.commit();
  return { edd, visitCount: ANC_WEEKS.length };
}

async function createVaccinationFollowups(patient, dob) {
  const vaccines_ = await getEffectiveVaccineSchedule();
  const batch     = db.batch();

  vaccines_.forEach(v => {
    const dueDate = addDays(dob, v.offsetDays);
    const caseRef = db.collection('followupCases').doc();
    const fc = {
      patientDocId: patient.id,
      patientName:  patient.name,
      patientId:    patient.patientId,
      followupType: 'vaccination',
      subType:      v.name + ' \u2014 Dose ' + v.doseNumber,
      vaccineName:  v.name,
      vaccineCode:  v.code,
      ageAtDose:    v.ageLabel,
      doseNumber:   v.doseNumber,
      dob, dueDate,
      status:       'active',
      notes:        null,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(caseRef, fc);
    addReminderTasksToBatch(batch, caseRef.id, fc, patient);
  });

  await batch.commit();
  return { vaccineCount: IAP_VACCINES.length };
}

async function createPostProcedureFollowup(patient, data) {
  const batch   = db.batch();
  const caseRef = db.collection('followupCases').doc();
  const fc = {
    patientDocId:  patient.id,
    patientName:   patient.name,
    patientId:     patient.patientId,
    followupType:  'post_procedure',
    subType:       data.procedureType + ' \u2014 post-op review',
    procedureType: data.procedureType,
    dueDate:       data.dueDate,
    status:        'active',
    notes:         data.notes || null,
    createdAt:     firebase.firestore.FieldValue.serverTimestamp()
  };
  batch.set(caseRef, fc);
  addReminderTasksToBatch(batch, caseRef.id, fc, patient);
  await batch.commit();
}

async function createAnnualRecallFollowup(patient, data) {
  const batch   = db.batch();
  const caseRef = db.collection('followupCases').doc();
  const fc = {
    patientDocId: patient.id,
    patientName:  patient.name,
    patientId:    patient.patientId,
    followupType: 'annual_recall',
    subType:      data.recallType,
    recallType:   data.recallType,
    dueDate:      data.dueDate,
    status:       'active',
    notes:        data.notes || null,
    createdAt:    firebase.firestore.FieldValue.serverTimestamp()
  };
  batch.set(caseRef, fc);
  addReminderTasksToBatch(batch, caseRef.id, fc, patient);
  await batch.commit();
}

// ----------------------------------------------------------------
//  READ FOLLOW-UP CASES
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

// ----------------------------------------------------------------
//  READ + UPDATE REMINDER TASKS
// ----------------------------------------------------------------

async function getReminderTasksForCase(followupCaseId) {
  const snap = await db.collection('reminderTasks')
    .where('followupCaseId', '==', followupCaseId)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
}

async function updateReminderStatus(taskId, status) {
  await db.collection('reminderTasks').doc(taskId).update({
    status,
    sentAt:    status === 'sent' ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Backfill reminders for follow-up cases created before Step 6
async function generateRemindersForCase(fc, patient) {
  const batch = db.batch();
  addReminderTasksToBatch(batch, fc.id, fc, patient);
  await batch.commit();
}

// ----------------------------------------------------------------
//  WORK QUEUE QUERIES  (pre-built for Step 7)
// ----------------------------------------------------------------

async function getTodaysPendingReminders() {
  const today = _todayIso();
  const snap  = await db.collection('reminderTasks')
    .where('status', '==', 'pending')
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(t => t.reminderDate <= today)
    .sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
}

async function getMissedFollowups() {
  const today = _todayIso();
  const snap  = await db.collection('followupCases')
    .where('status', '==', 'active')
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(fc => fc.dueDate < today)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

async function getUpcomingFollowups(days) {
  const today  = _todayIso();
  const future = addDays(today, days);
  const snap   = await db.collection('followupCases')
    .where('status', '==', 'active')
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(fc => fc.dueDate >= today && fc.dueDate <= future)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}

// ----------------------------------------------------------------
//  DYNAMIC CONFIG READERS  (Step 12)
//  Read editable schedules from Firestore; fall back to hardcoded.
// ----------------------------------------------------------------

async function getEffectiveAncSchedule() {
  try {
    const doc = await db.collection('meta').doc('ancSchedule').get();
    if (doc.exists && Array.isArray(doc.data().weeks)) return doc.data().weeks;
  } catch(e) { /* fall through */ }
  return ANC_WEEKS;
}

async function getEffectiveVaccineSchedule() {
  try {
    const doc = await db.collection('meta').doc('vaccineSchedule').get();
    if (doc.exists && Array.isArray(doc.data().vaccines)) return doc.data().vaccines;
  } catch(e) { /* fall through */ }
  return IAP_VACCINES;
}
