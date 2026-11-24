// Indian formatting and ID checks shared by every tool.
// Works as a classic <script> in the browser (defines globals) and as a CommonJS module in Node.
(function (root) {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // ₹1,25,000.00 (Indian digit grouping)
  const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // "2026-11-24" -> "24 Nov 2026"
  const fmtDate = d => {
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Amount in words, Indian system: 125000 -> "Rupees One Lakh Twenty Five Thousand Only"
  const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  const three = n => { const h = Math.floor(n / 100), r = n % 100; return [h ? ONES[h] + " Hundred" : "", r ? two(r) : ""].filter(Boolean).join(" "); };
  function words(n) {
    if (n === 0) return "Zero";
    const parts = []; const cr = Math.floor(n / 1e7); n %= 1e7;
    if (cr) parts.push(words(cr) + " Crore");
    const l = Math.floor(n / 1e5); n %= 1e5; if (l) parts.push(two(l) + " Lakh");
    const t = Math.floor(n / 1e3); n %= 1e3; if (t) parts.push(two(t) + " Thousand");
    if (n) parts.push(three(n));
    return parts.join(" ");
  }
  function amountWords(x) {
    const totalPaise = Math.round(Math.abs(x) * 100);
    const rupees = Math.floor(totalPaise / 100), paise = totalPaise % 100;
    return (x < 0 && totalPaise ? "Minus " : "") + "Rupees " + words(rupees) + (paise ? " and " + two(paise) + " Paise" : "") + " Only";
  }

  // ID checks. Each returns null when valid, or a message saying what is wrong.
  // They check format (and the GSTIN check digit) only, not whether the ID is registered:
  // verify a GSTIN at https://services.gst.gov.in/services/searchtp before relying on it.
  const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function gstinCheckChar(first14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const p = B36.indexOf(first14[i]) * (i % 2 ? 2 : 1);
      sum += Math.floor(p / 36) + (p % 36);
    }
    return B36[(36 - (sum % 36)) % 36];
  }
  const CHECKS = {
    gstin: v => !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? "GSTIN must be 15 characters: 2-digit state code, PAN, entity number, Z, check character"
      : gstinCheckChar(v) !== v[14] ? `GSTIN check character is wrong (expected ${gstinCheckChar(v)}); probably a typo` : null,
    pan: v => /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/.test(v) ? null : "PAN must look like ABCPE1234F (5 letters, 4 digits, 1 letter; 4th letter is the holder type)",
    ifsc: v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? null : "IFSC must be 11 characters: 4-letter bank code, 0, 6-character branch code",
    pin: v => /^[1-9][0-9]{5}$/.test(v) ? null : "PIN code must be 6 digits and not start with 0",
    upi: v => /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/.test(v) ? null : "UPI ID must look like name@bank",
  };
  function check(kind, value) {
    if (!CHECKS[kind]) return `unknown check "${kind}"; use one of ${Object.keys(CHECKS).join(", ")}`;
    const v = String(value).trim();
    return CHECKS[kind](kind === "upi" ? v : v.toUpperCase());
  }

  const api = { esc, inr, fmtDate, amountWords, check, CHECKS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(this);

// GST state lookup. entries come from rules/gst-state-codes.json (loadRules in Node; invoice-generator/cli.mjs
// injects them into the page). Accepts "29", "Karnataka", "29-Karnataka" or "Karnataka (29)", any case, and the
// entries' aliases. Returns the matching entry, or null when nothing matches or a code and a name disagree.
(function (root) {
  const norm = s => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  function gstStateOf(value, entries) {
    const v = String(value ?? "").trim();
    if (!v || !entries) return null;
    const m = v.match(/^(\d{1,2})(?!\d)\s*[-:–]?\s*(.*)$/) || v.match(/^(.*?)\s*\((\d{1,2})\)$/);
    const [code, name] = !m ? [null, v] : /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const names = e => [e.name, ...(e.aliases || [])].map(norm);
    if (code) {
      const e = entries.find(x => x.code === code.padStart(2, "0"));
      return e && (!name || names(e).includes(norm(name))) ? e : null;
    }
    return entries.find(e => names(e).includes(norm(name))) || null;
  }
  if (typeof module === "object" && module.exports) module.exports.gstStateOf = gstStateOf;
  else root.gstStateOf = gstStateOf;
})(this);
