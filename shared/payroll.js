// Payroll arithmetic shared by the salary-slip page and its CLI: earnings, provident fund, ESI and
// state professional tax, all from the dated files in rules/ (see rules/README.md).
// Works as a classic <script> in the browser (defines globals) and as a CommonJS module in Node.
(function (root) {
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pad = n => String(n).padStart(2, "0");
  const money = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ---- months ----
  function monthParts(m) {
    const [y, mo] = String(m || "").split("-").map(Number);
    if (!y || !mo || mo < 1 || mo > 12) throw new Error(`"${m}" is not a month as YYYY-MM`);
    return { y, m: mo };
  }
  const daysInMonth = m => { const { y, m: mo } = monthParts(m); return new Date(y, mo, 0).getDate(); };
  const monthStart = m => m + "-01";
  const monthEnd = m => m + "-" + pad(daysInMonth(m));
  const monthLabel = m => { const { y, m: mo } = monthParts(m); return MONTHS[mo - 1] + " " + y; };
  const monthShort = m => { const { y, m: mo } = monthParts(m); return MONTHS[mo - 1].slice(0, 3) + " " + y; };
  function addMonths(m, n) {
    const { y, m: mo } = monthParts(m);
    const d = new Date(y, mo - 1 + n, 1);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  }
  // Inclusive list of months from `from` to `to`, e.g. 2026-04..2026-06 -> three months.
  function monthsBetween(from, to) {
    const out = [];
    let m = from;
    while (m <= to && out.length < 120) { out.push(m); m = addMonths(m, 1); }
    return out;
  }

  // ---- earnings ----
  // Rows in the order a wage slip shows them: basic, DA, HRA, the named allowances, overtime.
  function earningRows(d) {
    const rows = [["Basic", num(d.basic)], ["Dearness allowance", num(d.da)], ["House rent allowance", num(d.hra)]];
    for (const a of d.allowances || []) rows.push([a.name || "Allowance", num(a.amount)]);
    rows.push(["Overtime", num(d.overtime)]);
    return rows;
  }
  const grossEarnings = d => earningRows(d).reduce((a, r) => a + r[1], 0);
  const pfWages = d => num(d.basic) + num(d.da);

  // ---- provident fund ----
  // 12% of basic + DA, capped at the wage ceiling. The ceiling moved on 17 September 2026, so a month
  // that spans the change is charged by days at each ceiling (EPFO's own worked example does the same).
  function epf(d, entries, month) {
    const wage = pfWages(d);
    const total = daysInMonth(month);
    const periods = [];
    for (const e of entries.filter(x => x.scheme === "epf")) {
      const days = overlapDays(e, month, total);
      if (!days) continue;
      const capped = Math.min(wage, num(e.wage_ceiling));
      periods.push({ days, ceiling: num(e.wage_ceiling), rate: num(e.employee_rate), capped, amount: num(e.employee_rate) / 100 * capped * days / total });
    }
    const employee = Math.round(periods.reduce((a, p) => a + p.amount, 0));
    return { employee, wage, periods };
  }

  // Days of `month` during which an entry is in force.
  function overlapDays(e, month, total = daysInMonth(month)) {
    const first = monthStart(month), last = monthEnd(month);
    const from = e.effective_from && e.effective_from > first ? e.effective_from : first;
    const to = e.effective_to && e.effective_to < last ? e.effective_to : last;
    if (from > to) return 0;
    return Number(to.slice(8, 10)) - Number(from.slice(8, 10)) + 1;
  }

  // ---- ESI ----
  function esi(d, entries, disability) {
    const e = entries.find(x => x.scheme === "esi");
    const wage = grossEarnings(d);
    if (!e) return { employee: 0, wage, ceiling: 0, covered: false };
    const ceiling = num(disability && e.wage_ceiling_disability ? e.wage_ceiling_disability : e.wage_ceiling);
    const covered = wage <= ceiling;
    return { employee: covered ? Math.round(num(e.employee_rate) / 100 * wage) : 0, wage, ceiling, covered };
  }

  // ---- professional tax ----
  function slabFor(slabs, value) {
    for (const s of slabs) {
      if (s.below !== undefined) { if (value < num(s.below)) return s; }
      else if (s.upto === null || s.upto === undefined) return s;
      else if (value <= num(s.upto)) return s;
    }
    return slabs[slabs.length - 1];
  }

  // `state` is matched case-insensitively. Returns { amount, note, entry } or throws when the state has
  // no verified schedule, so a payslip never shows a guessed professional tax.
  function professionalTax(d, entries) {
    const state = String(d.state || "").trim();
    if (!state) throw new Error("state is required for professional tax (autoDeductions)");
    let found = entries.filter(e => e.state.toLowerCase() === state.toLowerCase());
    if (!found.length) {
      const near = entries.filter(e => e.state.toLowerCase().startsWith(state.toLowerCase()));
      if (near.length)
        throw new Error(`professional tax for "${state}" depends on the local body: this file has ${near.map(e => `"${e.state}"`).join(", ")}. Pass that as state, or professionalTax as a number from the local body's schedule.`);
      throw new Error(`no verified professional tax schedule for "${state}". Pass professionalTax as a number, or add the state to rules/professional-tax.json after checking its official notification.`);
    }
    let assumed = "";
    if (found.length > 1) {
      const g = String(d.gender || "").toLowerCase();
      const pick = found.find(e => e.applies_to === g);
      if (pick) found = [pick];
      else {
        found = [found.find(e => e.applies_to === "male") || found[0]];
        assumed = ` (men's rates assumed; set gender to female if the employee is a woman)`;
      }
    }
    const e = found[0];
    const gross = grossEarnings(d);
    const { m: monthNo } = monthParts(d.month);
    let amount = 0, basis, value;
    if (e.basis === "annual") {
      value = gross * 12;
      const s = slabFor(e.slabs, value);
      amount = num(e.last_month && monthNo === num(e.last_month) && s.last_month_amount !== undefined ? s.last_month_amount : s.amount);
      basis = `annual salary ${money(value)}`;
    } else if (e.basis === "half_yearly") {
      value = gross * 6;
      const s = slabFor(e.slabs, value);
      const months = (e.deduct_in_months || []).map(Number);
      amount = !months.length || months.includes(monthNo) ? num(s.amount) : 0;
      basis = `half-yearly income ${money(value)}` + (months.length ? `, deducted in ${months.map(n => MONTHS[n - 1]).join(" and ")}` : "");
    } else {
      value = gross;
      const s = slabFor(e.slabs, value);
      const over = s.month_overrides && s.month_overrides[String(monthNo)];
      amount = num(over !== undefined ? over : s.amount);
      basis = `monthly salary ${money(value)}` + (over !== undefined ? `, the ${MONTHS[monthNo - 1]} rate` : "");
    }
    return { amount, basis, entry: e, assumed, note: `${e.state}, ${basis}.${e.notes ? " " + e.notes : ""}${assumed}` };
  }

  // ---- all three, with the lines a wage slip prints to say how they were worked out ----
  // rules: { pfEsi: { entries }, professionalTax: { entries } } as loaded from rules/*.json.
  function deductions(d, rules) {
    const out = { deductionBasis: [] };
    const pfEntries = (rules.pfEsi && rules.pfEsi.entries) || [];
    const ptEntries = (rules.professionalTax && rules.professionalTax.entries) || [];
    const gross = grossEarnings(d);

    if (d.pfApplicable === false) {
      out.pf = 0;
      out.deductionBasis.push("PF: not deducted (marked as not covered by EPF).");
    } else {
      const p = epf(d, pfEntries, d.month);
      out.pf = p.employee;
      if (!p.periods.length) out.deductionBasis.push("PF: no rule in force for this month.");
      else if (p.periods.length > 1)
        out.deductionBasis.push(`PF: the ceiling changed mid-month, so ${p.periods.map(x => `${x.rate}% of ${money(x.capped)} for ${x.days} days`).join(" + ")}.`);
      else
        out.deductionBasis.push(`PF: ${p.periods[0].rate}% of ${money(p.wage)} (basic + DA)` + (p.wage > p.periods[0].capped ? `, capped at the ${money(p.periods[0].ceiling)} wage ceiling` : "") + ".");
    }

    if (d.esiApplicable === false) {
      out.esi = 0;
      out.deductionBasis.push("ESI: not deducted (marked as not covered by ESIC).");
    } else {
      const s = esi(d, pfEntries, d.esiDisability);
      out.esi = s.employee;
      out.deductionBasis.push(s.covered
        ? `ESI: 0.75% of ${money(s.wage)} gross wages.`
        : `ESI: not deducted, gross wages ${money(gross)} are above the ${money(s.ceiling)} ceiling.`);
    }

    const pt = professionalTax(d, ptEntries);
    out.professionalTax = pt.amount;
    out.deductionBasis.push(`Professional tax: ${pt.note}`);
    return out;
  }

  // Browser only: read rule files over http. Returns {} when the page is opened from file://,
  // where the browser will not fetch a neighbouring file; the CLI computes the figures instead.
  async function fetchRules(paths) {
    if (typeof fetch !== "function") return {};
    try {
      const out = {};
      for (const [key, path] of Object.entries(paths)) out[key] = await (await fetch(path)).json();
      return out;
    } catch { return {}; }
  }

  const api = { monthParts, daysInMonth, monthStart, monthEnd, monthLabel, monthShort, addMonths, monthsBetween,
    earningRows, grossEarnings, pfWages, epf, esi, professionalTax, slabFor, deductions, fetchRules };
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(this);
