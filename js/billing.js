// ================================================================
//  BILLING MODULE  (Steps 10 & 11)
//  Invoice generation, printing, and daily reconciliation
// ================================================================

const PAYMENT_MODE_LABELS = {
  cash:          'Cash',
  upi:           'UPI',
  card:          'Card / POS',
  bank_transfer: 'Bank Transfer'
};

const INVOICE_TYPE_LABELS = {
  consultation: 'Consultation',
  vaccination:  'Vaccination',
  procedure:    'Procedure',
  other:        'Other'
};

// ----------------------------------------------------------------
//  INVOICE NUMBER COUNTER
// ----------------------------------------------------------------

async function generateInvoiceNumber() {
  const counterRef = db.collection('meta').doc('counters');
  let serial;
  await db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      serial = 1;
      tx.set(counterRef, { invoiceSerial: 1 });
    } else {
      serial = (snap.data().invoiceSerial || 0) + 1;
      tx.update(counterRef, { invoiceSerial: firebase.firestore.FieldValue.increment(1) });
    }
  });
  return 'INV-' + String(serial).padStart(4, '0');
}

// ----------------------------------------------------------------
//  INVOICE CRUD
// ----------------------------------------------------------------

async function createInvoice(data) {
  const invoiceNumber = await generateInvoiceNumber();
  const invoice = {
    invoiceNumber,
    patientDocId:  data.patientDocId,
    patientName:   data.patientName,
    patientId:     data.patientId,
    date:          data.date,
    invoiceType:   data.invoiceType   || 'consultation',
    services:      data.services      || [],
    totalAmount:   data.totalAmount   || 0,
    paymentMode:   data.paymentMode   || 'cash',
    paymentStatus: 'paid',
    notes:         data.notes         || null,
    createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
    createdBy:     firebase.auth().currentUser ? firebase.auth().currentUser.email : null
  };
  const ref = await db.collection('invoices').add(invoice);
  return { id: ref.id, ...invoice };
}

async function getInvoice(id) {
  const doc = await db.collection('invoices').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function getRecentInvoices(limitN) {
  const snap = await db.collection('invoices')
    .orderBy('createdAt', 'desc')
    .limit(limitN || 30)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getInvoicesByDate(date) {
  const snap = await db.collection('invoices')
    .where('date', '==', date)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ----------------------------------------------------------------
//  DAILY SYSTEM TOTALS  (for reconciliation)
// ----------------------------------------------------------------

async function getDailySystemTotals(date) {
  const invoices = await getInvoicesByDate(date);
  const totals   = { cash: 0, upi: 0, card: 0, bank_transfer: 0 };
  invoices.forEach(inv => {
    if (inv.paymentStatus === 'paid') {
      const mode = inv.paymentMode || 'cash';
      if (totals[mode] !== undefined) totals[mode] += (inv.totalAmount || 0);
    }
  });
  return totals;
}

// ----------------------------------------------------------------
//  RECONCILIATION
// ----------------------------------------------------------------

async function getReconciliation(date) {
  const doc = await db.collection('reconciliations').doc(date).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function saveReconciliation(date, actual, notes) {
  await db.collection('reconciliations').doc(date).set({
    date, actual,
    notes:        notes || null,
    isReconciled: false,
    savedAt:      firebase.firestore.FieldValue.serverTimestamp(),
    savedBy:      firebase.auth().currentUser ? firebase.auth().currentUser.email : null
  }, { merge: true });
}

async function markReconciled(date, actual, notes) {
  await db.collection('reconciliations').doc(date).set({
    date, actual,
    notes:         notes || null,
    isReconciled:  true,
    reconciledAt:  firebase.firestore.FieldValue.serverTimestamp(),
    reconciledBy:  firebase.auth().currentUser ? firebase.auth().currentUser.email : null
  }, { merge: true });
}

// ----------------------------------------------------------------
//  FORMATTING HELPERS
// ----------------------------------------------------------------

function fmtAmount(n) {
  return '\u20b9' + (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
}

function fmtInvDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ----------------------------------------------------------------
//  INVOICE PRINT  (opens a formatted HTML page + triggers print)
// ----------------------------------------------------------------

function buildInvoiceHtml(inv) {
  const rows = (inv.services || []).map(s =>
    '<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px">' + (s.description || '') +
    '</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px">&#8377;' +
    (s.amount || 0).toLocaleString('en-IN') + '</td></tr>'
  ).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ' + (inv.invoiceNumber || '') + '</title>' +
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0}' +
'body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#1a1a1a;background:#fff;padding:48px;max-width:680px;margin:0 auto}' +
'.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F6E56;padding-bottom:20px;margin-bottom:28px}' +
'.clinic-name{font-size:24px;font-weight:700;color:#0F6E56}' +
'.clinic-sub{font-size:13px;color:#666;margin-top:4px}' +
'.inv-no{font-size:20px;font-weight:700;color:#1a1a1a;text-align:right}' +
'.inv-date{font-size:13px;color:#666;margin-top:4px;text-align:right}' +
'.meta-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f8f8f8;padding:16px;border-radius:8px;margin-bottom:28px}' +
'.meta-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}' +
'.meta-value{font-size:15px;font-weight:500;color:#1a1a1a}' +
'.meta-sub{font-size:12px;color:#888;margin-top:2px}' +
'table{width:100%;border-collapse:collapse}' +
'th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888;padding:0 0 10px;border-bottom:1px solid #e0e0e0;text-align:left}' +
'th:last-child{text-align:right}' +
'.total-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:2px solid #0F6E56;margin-top:4px}' +
'.total-label{font-size:15px;font-weight:600}' +
'.total-value{font-size:26px;font-weight:700;color:#0F6E56}' +
'.payment-badge{display:inline-block;background:#E1F5EE;color:#085041;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:500;margin-top:16px}' +
'.notes-box{margin-top:16px;font-size:13px;color:#555;padding:12px;background:#f9f9f9;border-radius:6px}' +
'.footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#aaa}' +
'.print-btn{display:block;margin:28px auto 0;background:#0F6E56;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer}' +
'@media print{.print-btn{display:none}body{padding:20px}}' +
'</style></head><body>' +
'<div class="header"><div><div class="clinic-name">Aangan Clinic</div><div class="clinic-sub">Women&#8217;s Health Centre</div></div>' +
'<div><div class="inv-no">' + (inv.invoiceNumber || '') + '</div><div class="inv-date">' + fmtInvDate(inv.date) + '</div></div></div>' +
'<div class="meta-row"><div><div class="meta-label">Patient</div><div class="meta-value">' + (inv.patientName || '&#8212;') + '</div><div class="meta-sub">' + (inv.patientId || '') + '</div></div>' +
'<div><div class="meta-label">Type</div><div class="meta-value">' + (INVOICE_TYPE_LABELS[inv.invoiceType] || inv.invoiceType || '&#8212;') + '</div></div></div>' +
'<table><thead><tr><th>Service</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
'<div class="total-row"><span class="total-label">Total Amount</span><span class="total-value">&#8377;' + (inv.totalAmount || 0).toLocaleString('en-IN') + '</span></div>' +
'<div class="payment-badge">Paid via ' + (PAYMENT_MODE_LABELS[inv.paymentMode] || inv.paymentMode || '&#8212;') + '</div>' +
(inv.notes ? '<div class="notes-box">Notes: ' + inv.notes + '</div>' : '') +
'<div class="footer">Aangan Clinic &nbsp;&bull;&nbsp; Thank you for your visit</div>' +
'<button class="print-btn" onclick="window.print()">Print Invoice</button>' +
'</body></html>';
}

function printInvoice(inv) {
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to print the invoice.'); return; }
  w.document.write(buildInvoiceHtml(inv));
  w.document.close();
  setTimeout(function() { w.print(); }, 600);
}

// ----------------------------------------------------------------
//  INVOICE EDIT WITH AUDIT TRAIL
// ----------------------------------------------------------------

async function editInvoice(id, updates, reason) {
  const invRef = db.collection('invoices').doc(id);
  const snap   = await invRef.get();
  if (!snap.exists) throw new Error('Invoice not found');

  const before = snap.data();
  const editor = (firebase.auth().currentUser || {}).email || 'unknown';
  const now    = firebase.firestore.FieldValue.serverTimestamp();
  const batch  = db.batch();

  batch.update(invRef, {
    ...updates,
    lastEditedAt: now,
    lastEditedBy: editor,
    hasEdits:     true
  });

  batch.set(invRef.collection('edits').doc(), {
    editedAt: now,
    editedBy: editor,
    reason:   reason.trim(),
    before: { totalAmount: before.totalAmount, services: before.services,
              paymentMode: before.paymentMode, notes: before.notes },
    after:  { totalAmount: updates.totalAmount, services: updates.services,
              paymentMode: updates.paymentMode, notes: updates.notes }
  });

  await batch.commit();
}

async function getInvoiceEdits(invoiceId) {
  const snap = await db.collection('invoices').doc(invoiceId)
    .collection('edits').get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.editedAt?.seconds || 0) - (a.editedAt?.seconds || 0));
}
