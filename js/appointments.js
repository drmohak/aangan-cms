// ================================================================
//  APPOINTMENTS MODULE
//  Day-level booking, no time slots, first-come-first-serve
// ================================================================

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'Consultation'  },
  { value: 'anc',          label: 'ANC visit'     },
  { value: 'vaccination',  label: 'Vaccination'   },
  { value: 'procedure',    label: 'Procedure'     },
  { value: 'follow_up',    label: 'Follow-up'     },
  { value: 'other',        label: 'Other'         }
];

function _apptToday() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ----------------------------------------------------------------
//  CREATE
// ----------------------------------------------------------------

async function createAppointment(data) {
  const ref = await db.collection('appointments').add({
    patientId:   data.patientId   || null,
    patientName: (data.patientName || '').trim(),
    mobile:      (data.mobile     || '').replace(/\D/g, '').slice(-10),
    date:        data.date,
    doctorName:  data.doctorName,
    type:        data.type        || 'consultation',
    notes:       (data.notes      || '').trim(),
    status:      'scheduled',
    isWalkIn:    !data.patientId,
    bookedBy:    (firebase.auth().currentUser || {}).email || '',
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

// ----------------------------------------------------------------
//  FETCH BY DATE  (sorted: by doctor name, then createdAt)
// ----------------------------------------------------------------

async function getAppointmentsByDate(date) {
  const snap = await db.collection('appointments')
    .where('date', '==', date)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const dc = (a.doctorName || '').localeCompare(b.doctorName || '');
      if (dc !== 0) return dc;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });
}

// ----------------------------------------------------------------
//  STATUS UPDATE
// ----------------------------------------------------------------

async function updateAppointmentStatus(id, status) {
  await db.collection('appointments').doc(id).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ----------------------------------------------------------------
//  DASHBOARD HELPER  (today's scheduled count)
// ----------------------------------------------------------------

async function getTodayAppointments() {
  const snap = await db.collection('appointments')
    .where('date', '==', _apptToday())
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

// ----------------------------------------------------------------
//  WA REMINDER LINK
// ----------------------------------------------------------------

function appointmentWaLink(appt, dateLabel) {
  if (!appt.mobile) return null;
  const mobile = appt.mobile.replace(/\D/g, '');
  if (mobile.length < 10) return null;
  const msg = `Dear ${appt.patientName}, your appointment at Aangan Clinic is on ${dateLabel} with ${appt.doctorName}. Please arrive early \u2014 patients are seen on first-come-first-serve basis.`;
  return 'https://wa.me/91' + mobile.slice(-10) + '?text=' + encodeURIComponent(msg);
}
