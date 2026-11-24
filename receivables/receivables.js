// Receivables engine shared by cli.mjs and index.html: turns a workspace's documents into money owed,
// age buckets, TDS per client per financial year, TDS rate checks, FEMA export deadlines and reminder drafts.
// Works as a classic <script> in the browser (defines globals) and as a CommonJS module in Node.
(function (root) {
  const { inr, fmtDate } = typeof module === "object" && module.exports ? require("../shared/india.js") : root;

  // FEMA realisation period for exports. Source: RBI Notification FEMA 23(R)/2026-RB, Foreign Exchange Management
  // (Export and Import of Goods and Services) Regulations, 2026, in force from 1 October 2026 (as amended up to
  // 2 November 2026), regulation 5(1): nine months from the date of invoice for services (from shipment for goods);
  // twelve months when invoiced or settled in Indian rupees. Read 2026-11-24 at
  // https://rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0
  // Before 1 October 2026 the 2015 regulations and RBI's Master Direction on Export of Goods and Services applied;
  // its section A.2 also gave nine months (https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=10395, seen
  // only as a search excerpt, not opened in full).
  const FEMA = {
    from: "2026-10-01", months: 9, inrMonths: 12,
    cite: "RBI FEMA 23(R)/2026-RB, regulation 5(1)",
    basis: "Realise the full export value within nine months of the invoice date for services (from the shipment date for goods), twelve months if invoiced or settled in rupees.",
    url: "https://rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0",
  };
  const RECEIVABLE = ["invoice", "debit_note", "export_invoice"];
  const BUCKETS = ["not_due", "0-30", "31-60", "61-90", "90+"];
  const ANNUAL = ["professional_fees", "technical_fees", "commission", "contractor", "paid_by_individual"];

  const r2 = n => Math.round(n * 100) / 100;
  const ymd = d => d.split("-").map(Number);
  const utc = d => { const [y, m, x] = ymd(d); return Date.UTC(y, m - 1, x); };
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000); // b - a
  function addMonths(d, n) { // clamps to the month's last day: 31 May + 9 months = 28/29 Feb
    const [y, m, x] = ymd(d), last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + n, Math.min(x, last))).toISOString().slice(0, 10);
  }
  const finYear = d => { const [y, m] = ymd(d), s = m >= 4 ? y : y - 1; return `${s}-${String(s + 1).slice(2)}`; };
  const money = (n, cur = "INR") => cur === "INR" ? inr(n)
    : cur + " " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Same arithmetic as invoice-generator/index.html, so the report matches the printed totals.
  function docTotals(d) {
    const sub = (d.items || []).reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
    const rate = d.taxRate === undefined ? 18 : Number(d.taxRate) || 0;
    const tax = d.taxMode === "cgst_sgst" || d.taxMode === "igst" ? sub * rate / 100 : 0;
    return { sub: r2(sub), tax: r2(tax), total: r2(sub + tax) };
  }

  // Rule entries in force on `date` from the raw rules/tds-sections.json object (same rules as shared/rules.mjs loadRules).
  function rulesOn(file, date) {
    if (!file) return { error: "rules/tds-sections.json not loaded" };
    if (date < file.coverage.from || date > file.coverage.to)
      return { error: `rules/tds-sections.json covers ${file.coverage.from} to ${file.coverage.to}, not ${date}; re-check its sources and update it` };
    return { entries: file.entries.filter(x => (x.effective_from ?? "0000") <= date && date <= (x.effective_to ?? "9999")),
      sourceOf: x => file.sources.find(s => s.id === x.source) };
  }

  // Expected TDS on `base` (the amount without GST) for a rule id from rules/tds-sections.json.
  // payee: "individual_huf" or "other" (the owner, who receives the money). pan: false when the client lacks the PAN.
  function expectedTds(rules, { section, date, base, payee = "individual_huf", pan = true }) {
    const r = rulesOn(rules, date);
    if (r.error) return { error: r.error };
    const e = r.entries.find(x => x.id === section && (!x.payee || x.payee === payee));
    if (!e) return { error: `"${section}" is not a section id in rules/tds-sections.json; use one of ${[...new Set(r.entries.map(x => x.id))].join(", ")}` };
    const noPan = r.entries.find(x => x.id === "no_pan");
    const rate = !pan && noPan ? Math.max(e.rate, noPan.rate) : e.rate;
    return { rate, amount: r2(base * rate / 100), entry: e, source: r.sourceOf(e) };
  }

  // One receipt's TDS against the rate it should have used. Returns null when there is nothing to say.
  function checkReceiptTds(rules, rc, inv, payee) {
    const tds = rc.tds, gross = rc.amount + tds;
    if (!tds) return null;
    const at = `${rc.number} (${fmtDate(rc.date)}) against ${inv ? inv.number : "no invoice"}`;
    if (inv && inv.currency !== "INR") return { level: "warn", at, msg: "TDS recorded on a payment for an export invoice in foreign currency; check whether the buyer is in India" };
    const share = inv && inv.total > 0 ? inv.sub / inv.total : 1; // TDS is on the value without GST (CBDT Circular 23/2017)
    const base = r2(gross * share), implied = base ? r2(tds / base * 100) : 0;
    const out = { at, base, tds, implied };
    if (!rc.tdsSection) {
      const r = rulesOn(rules, rc.date);
      const match = r.error ? [] : r.entries.filter(x => (!x.payee || x.payee === payee) && Math.abs(x.rate - implied) < 0.1);
      return { ...out, level: "info", msg: `TDS ${inr(tds)} is ${implied}% of ${inr(base)}; no tdsSection on the receipt or client, so not checked` +
        (match.length ? `. That rate matches ${match.map(x => `${x.section} [old ${x.old_section}]`).join(" or ")}` : "") };
    }
    const exp = expectedTds(rules, { section: rc.tdsSection, date: rc.date, base, payee });
    if (exp.error) return { ...out, level: "warn", msg: exp.error };
    const ref = `${exp.entry.section} [old ${exp.entry.old_section}] at ${exp.rate}%`;
    if (Math.abs(tds - exp.amount) <= Math.max(1, base * 0.0005)) return { ...out, level: "ok", expected: exp.amount, rate: exp.rate, msg: `matches ${ref}`, source: exp.source.url };
    const noPan = Math.abs(implied - 20) < 0.1 ? "; 20% is the no-PAN rate (section 397(2) [old 206AA]): make sure the client has your PAN" : "";
    return { ...out, level: "warn", expected: exp.amount, rate: exp.rate, source: exp.source.url,
      msg: `TDS ${inr(tds)} is ${implied}% of ${inr(base)}; expected ${inr(exp.amount)} under ${ref}${noPan}` };
  }

  function pickProfile(profiles, problems) {
    const names = Object.keys(profiles || {}).sort();
    if (!names.length) { problems.push("no profile in profiles/; seller details are missing from reminders"); return {}; }
    const name = names.includes("me") ? "me" : names[0];
    if (names.length > 1 && name !== "me") problems.push(`several profiles and no profiles/me.json; used profiles/${name}.json`);
    return profiles[name];
  }

  // ws: { profiles: {name: obj}, clients: {name: obj}, documents: [{ client, file, data }], rules, asOf, payee }
  function buildReport(ws) {
    const asOf = ws.asOf, payee = ws.payee || "individual_huf", problems = [], later = [];
    const profile = pickProfile(ws.profiles, problems);
    const items = [], byKey = new Map(), receipts = [], credits = [];
    for (const x of ws.documents) {
      if (!ws.clients[x.client]) problems.push(`documents/${x.client}/: no clients/${x.client}.json, so the client name comes from the documents`);
      const d = { ...profile, ...(ws.clients[x.client] || {}), ...x.data };
      for (const k of Object.keys(d)) if (k.startsWith("$")) delete d[k];
      const type = d.docType || "invoice", where = `documents/${x.client}/${x.file}`;
      if (!RECEIVABLE.includes(type) && type !== "receipt" && type !== "credit_note") continue; // quotations, proformas
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) { problems.push(`${where}: no valid "date"; left out`); continue; }
      if (d.date > asOf) { later.push(where); continue; }
      const t = docTotals(d), currency = d.currency || "INR";
      const base = { client: x.client, clientName: d.toName || x.client, number: d.invNo || x.file, date: d.date, file: where,
        currency, exchangeRate: Number(d.exchangeRate) || null, ...t, d };
      if (RECEIVABLE.includes(type)) {
        const key = x.client + "\u0000" + base.number;
        if (byKey.has(key)) { problems.push(`${where}: number ${base.number} is used twice for ${x.client}`); continue; }
        const it = { ...base, type, due: d.due || d.date, dueGiven: !!d.due, received: 0, tds: 0, credited: 0, receipts: [], credits: [],
          buyerCountry: d.buyerCountry || null, tdsSection: d.tdsSection || null };
        items.push(it); byKey.set(key, it);
      } else (type === "receipt" ? receipts : credits).push({ ...base, type, ref: d.refInvoice || "",
        tds: Number(d.tds) || 0, tdsSection: d.tdsSection || null, amount: t.total });
    }

    // Find the invoice a receipt or credit note refers to: same client first, then a unique match elsewhere.
    const target = p => {
      if (!p.ref) return null;
      const own = byKey.get(p.client + "\u0000" + p.ref); if (own) return own;
      const any = items.filter(i => i.number === p.ref); return any.length === 1 ? any[0] : null;
    };
    // Amount of p (in p's currency) expressed in the invoice's currency.
    const inInvoiceCurrency = (n, p, it) => {
      if (p.currency === it.currency) return n;
      const rate = p.exchangeRate || it.exchangeRate;
      if (p.currency === "INR" && rate) return { n: r2(n / rate), note: `converted from ${inr(n)} at ${rate}` };
      if (it.currency === "INR" && p.exchangeRate) return { n: r2(n * p.exchangeRate), note: `converted from ${money(n, p.currency)} at ${p.exchangeRate}` };
      return null;
    };
    const unapplied = [], tdsChecks = [];
    for (const p of [...receipts, ...credits]) {
      const it = target(p);
      if (!it) { unapplied.push({ ...p, why: p.ref ? `refers to ${p.ref}, which is not in the workspace` : "has no refInvoice" }); continue; }
      const conv = inInvoiceCurrency(p.amount, p, it), tdsConv = p.tds ? inInvoiceCurrency(p.tds, p, it) : 0;
      if (conv == null || tdsConv == null) { unapplied.push({ ...p, why: `is in ${p.currency} but ${it.number} is in ${it.currency} and no exchangeRate is given` }); continue; }
      const amt = typeof conv === "object" ? conv.n : conv, tds = typeof tdsConv === "object" ? tdsConv.n : tdsConv;
      const row = { number: p.number, date: p.date, amount: amt, tds, note: conv.note || "" };
      if (p.type === "receipt") {
        it.received = r2(it.received + amt); it.tds = r2(it.tds + tds); it.receipts.push(row);
        const c = checkReceiptTds(ws.rules, { ...p, tdsSection: p.tdsSection || it.tdsSection }, it, payee);
        if (c) tdsChecks.push({ client: it.client, clientName: it.clientName, ...c });
      } else { it.credited = r2(it.credited + amt); it.credits.push(row); }
    }

    const totals = Object.fromEntries(BUCKETS.map(b => [b, 0])), unconverted = [];
    for (const it of items) {
      it.settled = r2(it.received + it.tds + it.credited);
      it.balance = r2(it.total - it.settled);
      const tol = 0.5;
      it.status = it.balance > tol ? (it.settled > tol ? "part-paid" : "unpaid") : it.balance < -tol ? "overpaid" : "paid";
      it.daysPastDue = daysBetween(it.due, asOf);
      it.bucket = it.status === "unpaid" || it.status === "part-paid"
        ? it.daysPastDue < 0 ? "not_due" : it.daysPastDue <= 30 ? "0-30" : it.daysPastDue <= 60 ? "31-60" : it.daysPastDue <= 90 ? "61-90" : "90+" : null;
      it.balanceInr = it.currency === "INR" ? it.balance : it.exchangeRate ? r2(it.balance * it.exchangeRate) : null;
      if (it.bucket) { if (it.balanceInr == null) unconverted.push(it.number); else totals[it.bucket] = r2(totals[it.bucket] + it.balanceInr); }
      if (it.status === "overpaid") problems.push(`${it.file}: received ${money(-it.balance, it.currency)} more than invoiced; refund it or apply it to another invoice`);
      if (it.type === "export_invoice" || it.currency !== "INR") {
        const old = it.date < FEMA.from, months = it.currency === "INR" ? FEMA.inrMonths : FEMA.months;
        const deadline = addMonths(it.date, months);
        it.fema = { deadline, months, daysLeft: daysBetween(asOf, deadline), realised: it.status === "paid" || it.status === "overpaid",
          note: old ? "Dated before 1 Oct 2026, when the 2015 FEMA export regulations applied; confirm the period with your bank." : "" };
      }
    }
    const open = items.filter(i => i.bucket).sort((a, b) => b.daysPastDue - a.daysPastDue || a.client.localeCompare(b.client));

    // TDS deducted, per client per financial year of the receipt (what Form 26AS / AIS should show).
    const tdsMap = new Map();
    for (const it of items) for (const rc of it.receipts) if (rc.tds) {
      const fy = finYear(rc.date), key = it.client + "\u0000" + fy;
      const g = tdsMap.get(key) || { client: it.client, clientName: it.clientName, fy, tds: 0, gross: 0, receipts: 0, sections: new Set() };
      g.tds = r2(g.tds + rc.tds); g.gross = r2(g.gross + rc.amount + rc.tds); g.receipts++;
      if (it.tdsSection) g.sections.add(it.tdsSection);
      tdsMap.set(key, g);
    }
    const tdsByClient = [...tdsMap.values()].map(g => ({ ...g, sections: [...g.sections] }))
      .sort((a, b) => a.fy.localeCompare(b.fy) || a.client.localeCompare(b.client));

    // No TDS seen although a client's billing in a year passed an annual threshold for its section.
    const billed = new Map();
    for (const it of items) if (it.currency === "INR" && it.tdsSection && ANNUAL.includes(it.tdsSection)) {
      const key = it.client + "\u0000" + finYear(it.date);
      const b = billed.get(key) || { it, sub: 0, tds: 0 }; b.sub += it.sub; b.tds += it.tds; billed.set(key, b);
    }
    for (const { it, sub, tds } of billed.values()) {
      const exp = expectedTds(ws.rules, { section: it.tdsSection, date: it.date, base: sub, payee });
      if (!exp.error && !tds && sub > exp.entry.threshold)
        tdsChecks.push({ client: it.client, clientName: it.clientName, level: "info", at: `financial year ${finYear(it.date)}`,
          msg: `billed ${inr(sub)} (without GST), above the ${inr(exp.entry.threshold)} threshold of ${exp.entry.section} [old ${exp.entry.old_section}], but no TDS is recorded yet; expect about ${exp.rate}% to be deducted, or record the TDS on the receipts` });
    }

    return {
      asOf, payee, seller: profile.fromName || "", generatedBy: "misc-tools receivables",
      summary: { outstandingInr: r2(BUCKETS.reduce((a, b) => a + totals[b], 0)), buckets: totals, unconverted,
        open: open.length, paid: items.filter(i => i.status === "paid").length, clients: new Set(open.map(i => i.client)).size },
      open: open.map(strip), paidItems: items.filter(i => !i.bucket).map(strip),
      exports: items.filter(i => i.fema).map(strip),
      tdsByClient, tdsChecks, unapplied: unapplied.map(({ d, ...p }) => p), problems,
      laterDocuments: later, reminders: reminders(open, profile, asOf),
      tdsRules: ws.rules ? { checkedOn: ws.rules.checked_on, coverage: ws.rules.coverage } : null,
      fema: FEMA,
    };
  }
  const strip = ({ d, ...it }) => it;

  // Draft reminders, one per client, for invoices past their due date. Drafts only: never sent by the tools.
  function reminders(open, profile, asOf) {
    const byClient = new Map();
    for (const it of open) if (it.daysPastDue >= 1) (byClient.get(it.client) || byClient.set(it.client, []).get(it.client)).push(it);
    const out = [];
    for (const [client, its] of byClient) {
      const d = its[0].d, me = d.signName || d.fromName || profile.fromName || "", worst = Math.max(...its.map(i => i.daysPastDue));
      const line = i => `${i.number} dated ${fmtDate(i.date)}, due ${fmtDate(i.due)}: ${money(i.balance, i.currency)} outstanding` +
        (i.settled > 0.5 ? ` (of ${money(i.total, i.currency)}; ${money(i.settled, i.currency)} received or adjusted)` : "");
      const curs = [...new Set(its.map(i => i.currency))];
      const total = curs.length === 1 ? money(its.reduce((a, i) => a + i.balance, 0), curs[0]) : null;
      const pay = [d.upiId && its.every(i => i.currency === "INR") ? `UPI: ${d.upiId}` : "",
        d.acct ? `Bank transfer: ${[d.bankName, d.bank, d.acct && "A/c " + d.acct, d.ifsc && "IFSC " + d.ifsc].filter(Boolean).join(", ")}` : ""].filter(Boolean);
      const ask = worst > 60 ? "Could you let me know by when the payment will be released? If there is any issue with the invoice, please tell me and I will sort it out."
        : worst > 30 ? "Could you please check on its status and let me know when I can expect the payment?"
        : "Just a gentle reminder in case it slipped through.";
      const greet = `Hello ${d.toName || client} team,`;
      const list = its.map(line);
      const whatsapp = [greet, "",
        its.length === 1 ? `This is a reminder about invoice ${list[0]}.` : `This is a reminder about these invoices:\n${list.map(l => "• " + l).join("\n")}`, "",
        ask, pay.length ? "\n" + pay.join("\n") : "", "", `Thank you,\n${me}`].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
      const email = { subject: its.length === 1 ? `Payment reminder: invoice ${its[0].number}` : `Payment reminder: ${its.length} invoices${total ? ", " + total + " outstanding" : ""}`,
        body: [greet, "", `I hope you are well. As of ${fmtDate(asOf)}, ${its.length === 1 ? "the following invoice is" : "the following invoices are"} past due:`, "",
          ...list.map(l => "- " + l), total && its.length > 1 ? `\nTotal outstanding: ${total}` : "", "", ask,
          pay.length ? "\nPayment details:\n" + pay.join("\n") : "", "", "If you have already paid, please share the payment reference so I can match it. Thank you.", "", "Regards,", me]
          .filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n") };
      out.push({ client, clientName: d.toName || client, daysPastDue: worst,
        invoices: its.map(i => i.number), whatsapp, email_draft: email });
    }
    return out.sort((a, b) => b.daysPastDue - a.daysPastDue);
  }

  const api = { buildReport, expectedTds, docTotals, addMonths, finYear, money, BUCKETS, FEMA };
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, { Receivables: api });
})(this);
