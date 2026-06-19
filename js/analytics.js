// ================================================================
//  ANALYTICS MODULE  (Step 12)
//  Revenue summaries, trend data, follow-up compliance
// ================================================================

function _today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ----------------------------------------------------------------
//  REVENUE SUMMARY  (all-time + period breakdowns)
// ----------------------------------------------------------------

async function getRevenueSummary() {
  const today      = _today();
  const monthStart = today.slice(0, 7) + '-01';
  const weekStart  = addDays(today, -6);

  const snap     = await db.collection('invoices').get();
  const invoices = snap.docs.map(d => d.data());

  let todayTotal = 0, weekTotal = 0, monthTotal = 0, allTotal = 0, count = 0;
  invoices.forEach(inv => {
    if (inv.paymentStatus === 'paid') {
      const amt = inv.totalAmount || 0;
      allTotal += amt; count++;
      if (inv.date === today)        todayTotal += amt;
      if (inv.date >= weekStart)     weekTotal  += amt;
      if (inv.date >= monthStart)    monthTotal += amt;
    }
  });

  return {
    todayTotal, weekTotal, monthTotal, allTotal,
    invoiceCount: count,
    avgInvoice:   count ? Math.round(allTotal / count) : 0
  };
}

// ----------------------------------------------------------------
//  DAILY REVENUE TREND  (last N days)
// ----------------------------------------------------------------

async function getDailyRevenueTrend(days) {
  const today     = _today();
  const startDate = addDays(today, -(days - 1));
  const dateMap   = {};

  for (let i = days - 1; i >= 0; i--) {
    dateMap[addDays(today, -i)] = 0;
  }

  const snap = await db.collection('invoices').get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.paymentStatus === 'paid' && d.date >= startDate && d.date <= today) {
      dateMap[d.date] = (dateMap[d.date] || 0) + (d.totalAmount || 0);
    }
  });

  return Object.entries(dateMap).map(([date, amount]) => ({ date, amount }));
}

// ----------------------------------------------------------------
//  REVENUE BY PAYMENT MODE  (last N days)
// ----------------------------------------------------------------

async function getRevenueByMode(days) {
  const startDate = addDays(_today(), -days);
  const snap      = await db.collection('invoices').get();
  const totals    = { cash: 0, upi: 0, card: 0, bank_transfer: 0 };

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.paymentStatus === 'paid' && d.date >= startDate) {
      const mode = d.paymentMode || 'cash';
      if (totals[mode] !== undefined) totals[mode] += (d.totalAmount || 0);
    }
  });
  return totals;
}

// ----------------------------------------------------------------
//  FOLLOW-UP COMPLIANCE STATS
// ----------------------------------------------------------------

async function getFollowupStats() {
  const today = _today();
  const snap  = await db.collection('followupCases').get();
  const stats = { total: 0, active: 0, completed: 0, declined: 0, overdue: 0 };

  snap.docs.forEach(doc => {
    const fc = doc.data();
    stats.total++;
    if (fc.status === 'completed')    stats.completed++;
    else if (fc.status === 'declined') stats.declined++;
    else if (fc.status === 'active') {
      stats.active++;
      if (fc.dueDate && fc.dueDate < today) stats.overdue++;
    }
  });

  stats.complianceRate  = stats.total    ? Math.round((stats.completed / stats.total) * 100) : 0;
  stats.overdueRate     = stats.active   ? Math.round((stats.overdue   / stats.active) * 100) : 0;
  return stats;
}

// ----------------------------------------------------------------
//  REVENUE BY INVOICE TYPE  (last N days)
// ----------------------------------------------------------------

async function getRevenueByType(days) {
  const startDate = addDays(_today(), -days);
  const snap      = await db.collection('invoices').get();
  const totals    = {};

  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.paymentStatus === 'paid' && d.date >= startDate) {
      const t = d.invoiceType || 'other';
      totals[t] = (totals[t] || 0) + (d.totalAmount || 0);
    }
  });
  return totals;
}
