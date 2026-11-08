/* ============================================================================
   Budget — upload bank/card CSV exports, auto-categorize, and show a household
   spending dashboard (by category, top merchants, budget-vs-actual, trend,
   recurring subscriptions, save opportunities). 100% client-side; transactions
   live in appData.budget (your own localStorage + Firebase). Nothing leaves the
   browser.
   ============================================================================ */
(function () {

  // ---- categories (name → color + icon) ----
  const CATS = {
    Income:        { color: '#22c55e', icon: 'ti-cash' },
    Groceries:     { color: '#16a34a', icon: 'ti-shopping-cart' },
    Dining:        { color: '#f59e0b', icon: 'ti-tools-kitchen-2' },
    Gas:           { color: '#ef4444', icon: 'ti-gas-station' },
    Transport:     { color: '#06b6d4', icon: 'ti-car' },
    Utilities:     { color: '#0ea5e9', icon: 'ti-bolt' },
    Housing:       { color: '#8b5cf6', icon: 'ti-home' },
    Subscriptions: { color: '#ec4899', icon: 'ti-repeat' },
    Shopping:      { color: '#3b82f6', icon: 'ti-shopping-bag' },
    Entertainment: { color: '#a855f7', icon: 'ti-device-tv' },
    Health:        { color: '#14b8a6', icon: 'ti-heartbeat' },
    Travel:        { color: '#0891b2', icon: 'ti-plane' },
    Kids:          { color: '#eab308', icon: 'ti-baby-carriage' },
    Insurance:     { color: '#64748b', icon: 'ti-shield' },
    Fees:          { color: '#dc2626', icon: 'ti-receipt-tax' },
    Transfer:      { color: '#94a3b8', icon: 'ti-arrows-exchange' },
    Other:         { color: '#64748b', icon: 'ti-dots' }
  };
  const CAT_NAMES = Object.keys(CATS);
  const catColor = c => (CATS[c] || CATS.Other).color;
  const catIcon = c => (CATS[c] || CATS.Other).icon;

  // ---- keyword rules (first match wins; checked after user rules) ----
  const RULES = [
    [/payroll|direct dep|dir dep|salary|paycheck|ach credit|interest paid|deposit|refund|reimburse|zelle from|venmo from|cashout/i, 'Income'],
    [/payment thank you|autopay|online payment|credit card payment|card pmt|pmt to|transfer to|xfer|bank transfer|to savings|withdrawal/i, 'Transfer'],
    [/whole ?foods|wholefds|whlfds|trader joe|kroger|safeway|publix|albertsons|aldi|costco|sam'?s club|samsclub|wal.?mart|wm super|target|heb|wegmans|sprouts|food lion|giant|meijer|ralphs|vons|winn.?dixie|grocer|supermarket|market basket|instacart|shoprite/i, 'Groceries'],
    [/restaurant|grill|cafe|coffee|starbucks|dunkin|mcdonald|chick.?fil|chipotle|taco|pizza|sushi|bar &|brewery|doordash|uber eats|grubhub|postmates|panera|wendy|burger|kitchen|bistro|diner|deli|bakery/i, 'Dining'],
    [/shell|chevron|exxon|mobil|bp |marathon|speedway|circle k|wawa|sunoco|valero|gas |fuel|76 |arco|citgo/i, 'Gas'],
    [/uber|lyft|parking|toll|transit|metro|amtrak|dmv|auto repair|jiffy|tire|oil change|car wash/i, 'Transport'],
    [/electric|utility|water|sewer|gas company|natural gas|comcast|xfinity|spectrum|at&t|verizon|t.?mobile|internet|cable|trash|waste mgmt|power|energy|pg&e|duke energy/i, 'Utilities'],
    [/mortgage|rent|hoa|property mgmt|apartments|leasing|zillow rent/i, 'Housing'],
    [/netflix|hulu|spotify|disney\+|apple\.com\/bill|apple music|youtube premium|hbo|max |peacock|paramount|prime video|audible|patreon|substack|icloud|google storage|dropbox|adobe|chatgpt|openai|gym|planet fitness|peloton|membership|subscription/i, 'Subscriptions'],
    [/amazon|amzn|ebay|best buy|home depot|lowes|ikea|etsy|wayfair|macy|nordstrom|kohl|old navy|gap |nike|lululemon|shein|temu|dept store|clothing|apparel/i, 'Shopping'],
    [/cinema|movie|amc |regal|theater|ticketmaster|stubhub|steam|playstation|xbox|nintendo|concert|spotify events|live nation/i, 'Entertainment'],
    [/pharmacy|cvs|walgreens|rite aid|doctor|dental|dentist|medical|clinic|hospital|optomet|vision|urgent care|labcorp|quest diag|copay|health/i, 'Health'],
    [/airline|delta|united|american air|southwest|jetblue|hotel|marriott|hilton|hyatt|airbnb|vrbo|expedia|booking\.com|resort|rental car|hertz|enterprise rent/i, 'Travel'],
    [/daycare|childcare|kids|toys|children|school|tuition|babysit|pediatric|carter|gymboree/i, 'Kids'],
    [/insurance|geico|state farm|progressive|allstate|usaa|policy|premium/i, 'Insurance'],
    [/fee|interest charge|finance charge|overdraft|late charge|atm|service charge|nsf/i, 'Fees']
  ];

  // ---- helpers ----
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = v => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
  const money2 = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2).replace(/\.00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function B() {
    if (typeof appData === 'undefined') return { transactions: [], budgets: {}, catRules: [] };
    appData.budget = appData.budget || { transactions: [], budgets: {}, catRules: [] };
    appData.budget.transactions = appData.budget.transactions || [];
    appData.budget.budgets = appData.budget.budgets || {};
    appData.budget.catRules = appData.budget.catRules || [];
    return appData.budget;
  }

  function parseDate(s) {
    if (!s) return null;
    s = String(s).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);   // MM/DD/YYYY (US)
    if (m) { let [, mo, d, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    const dt = new Date(s);
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
    return null;
  }

  // RFC-ish CSV parser (handles quotes, commas, newlines in quotes)
  function parseCSV(text) {
    const rows = []; let row = [], field = '', inQ = false;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length && r.some(x => x.trim() !== ''));
  }

  const normMerchant = d => String(d || '').toLowerCase()
    .replace(/\b\d{2,}\b/g, ' ').replace(/[#*].*/, ' ')
    .replace(/\b(purchase|pos|debit|card|visa|xxxx|authorized on|recurring|payment)\b/gi, ' ')
    .replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim();

  function prettyMerchant(d) {
    const n = normMerchant(d);
    return n ? n.replace(/\b\w/g, m => m.toUpperCase()).slice(0, 34) : (String(d || '').slice(0, 34) || 'Unknown');
  }

  function categorize(desc) {
    const b = B(); const low = String(desc || '').toLowerCase();
    for (const r of (b.catRules || [])) { if (r && r.match && low.includes(r.match.toLowerCase())) return r.category; }
    for (const [re, cat] of RULES) { if (re.test(low)) return cat; }
    return 'Other';
  }

  // ---- parse a CSV file into transactions (spend positive, income negative) ----
  function parseStatement(text, signMode) {
    const rows = parseCSV(text);
    if (!rows.length) return { txns: [], error: 'Empty file.' };
    // detect header
    let header = rows[0].map(h => h.trim().toLowerCase());
    const find = res => header.findIndex(h => res.some(re => re.test(h)));
    let di = find([/date|posted|trans/]);
    let ci = find([/desc|payee|merchant|name|memo|detail|narration/]);
    let ai = find([/^amount$|amount|amt/]);
    let dbi = find([/debit|withdrawal|charge/]);
    let cri = find([/credit|deposit/]);
    let start = 1;
    if (di < 0 && ci < 0) {   // no recognizable header → assume no header, positional
      header = null; start = 0; di = 0; ci = 1; ai = rows[0].length - 1; dbi = -1; cri = -1;
    }
    const txns = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const date = parseDate(r[di]);
      const desc = (r[ci] || r[ci + 1] || '').trim();
      if (!date || !desc) continue;
      let amount = null;   // spend positive
      if (dbi >= 0 || cri >= 0) {
        const deb = parseFloat(String(r[dbi] || '').replace(/[^0-9.\-]/g, ''));
        const cre = parseFloat(String(r[cri] || '').replace(/[^0-9.\-]/g, ''));
        if (!isNaN(deb) && deb !== 0) amount = Math.abs(deb);          // outflow
        else if (!isNaN(cre) && cre !== 0) amount = -Math.abs(cre);    // inflow
        else continue;
      } else {
        const raw = parseFloat(String(r[ai] || '').replace(/[^0-9.\-]/g, ''));
        if (isNaN(raw)) continue;
        amount = (signMode === 'pos') ? raw : -raw;   // 'neg' (default): purchases are negative → spend positive
      }
      txns.push({ date, desc, amount });
    }
    return { txns };
  }

  const txId = (t, account) => `${t.date}|${normMerchant(t.desc)}|${t.amount}|${account}`;
  let pending = null;   // { account, signMode, parsed:[], newCount, dupCount, total }

  // ---- aggregation ----
  function months() { return [...new Set(B().transactions.map(t => t.date.slice(0, 7)))].sort().reverse(); }
  function txForMonth(m) { const t = B().transactions; return m === 'all' ? t : t.filter(x => x.date.slice(0, 7) === m); }
  function isSpend(t) { return t.category !== 'Income' && t.category !== 'Transfer'; }

  function byCategory(list) {
    const map = {};
    list.forEach(t => { if (!isSpend(t)) return; map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.keys(map).map(c => ({ cat: c, amount: map[c] })).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);
  }
  function totalSpend(list) { return list.filter(isSpend).reduce((s, t) => s + t.amount, 0); }
  function totalIncome(list) { return list.filter(t => t.category === 'Income').reduce((s, t) => s - t.amount, 0); }
  function topMerchants(list, n) {
    const map = {};
    list.forEach(t => { if (!isSpend(t) || t.amount <= 0) return; const m = prettyMerchant(t.desc); map[m] = map[m] || { amount: 0, count: 0, cat: t.category }; map[m].amount += t.amount; map[m].count++; });
    return Object.keys(map).map(m => ({ merchant: m, ...map[m] })).sort((a, b) => b.amount - a.amount).slice(0, n);
  }
  function recurring() {
    const all = B().transactions.filter(t => isSpend(t) && t.amount > 0);
    const map = {};
    all.forEach(t => { const m = prettyMerchant(t.desc); (map[m] = map[m] || []).push(t); });
    const out = [];
    const recurringCats = { Subscriptions: 1, Utilities: 1, Insurance: 1, Housing: 1 };
    Object.keys(map).forEach(m => {
      const arr = map[m]; const mos = [...new Set(arr.map(t => t.date.slice(0, 7)))];
      if (mos.length < 2) return;
      const amts = arr.map(t => t.amount); const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
      const cat = arr[0].category;
      // Known recurring categories allow mild variation; everything else must be a (near-)identical repeating charge
      const consistent = recurringCats[cat]
        ? amts.every(a => Math.abs(a - avg) <= Math.max(3, avg * 0.15))
        : amts.every(a => Math.abs(a - amts[0]) < 0.02);
      if (consistent && avg >= 3 && avg <= 3000) out.push({ merchant: m, monthly: avg, months: mos.length, cat });
    });
    return out.sort((a, b) => b.monthly - a.monthly);
  }
  function monthlyTrend(n) {
    const ms = [...new Set(B().transactions.map(t => t.date.slice(0, 7)))].sort().slice(-n);
    return ms.map(m => ({ month: m, spend: totalSpend(txForMonth(m)) }));
  }

  // ---- rendering ----
  let selMonth = null;
  let showImport = false;

  function renderBudget() {
    const root = $('budget-root'); if (!root) return;
    const b = B();
    const hasData = b.transactions.length > 0;
    const ms = months();
    if (!selMonth || (selMonth !== 'all' && ms.indexOf(selMonth) < 0)) selMonth = ms[0] || 'all';

    let html = `
      <div class="section">
        <div class="section-title" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <span style="display:inline-flex; align-items:center; gap:8px;"><span class="section-icon"><i class="ti ti-wallet"></i></span>Budget</span>
          <button class="btn-primary" onclick="budgetToggleImport()"><i class="ti ti-upload" style="margin-right:6px;"></i>Import statement (CSV)</button>
        </div>
        <div class="info-box" style="margin-bottom:0;">Upload your bank/card <strong>CSV export</strong>. It's parsed in your browser and stored only in your own data — nothing is uploaded anywhere.</div>
        ${showImport ? importPanel() : ''}
      </div>`;

    if (!hasData) {
      html += `<div class="section" style="text-align:center; color:var(--text-secondary); padding:40px 20px;">
        <i class="ti ti-file-dollar" style="font-size:42px; color:var(--text-secondary);"></i>
        <div style="margin-top:12px; font-size:15px;">No transactions yet.</div>
        <div style="font-size:13px; margin-top:6px;">Export transactions from your bank as CSV, then tap <strong>Import statement</strong> above.</div>
      </div>`;
      root.innerHTML = html;
      return;
    }

    const list = txForMonth(selMonth);
    const spend = totalSpend(list), income = totalIncome(list), net = income - spend;
    const cats = byCategory(list);
    const monthOpts = ['all', ...ms].map(m => `<option value="${m}"${m === selMonth ? ' selected' : ''}>${m === 'all' ? 'All time' : monthLabel(m)}</option>`).join('');

    // KPIs + month selector
    html += `<div class="section">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
        <select onchange="budgetSetMonth(this.value)" style="background:var(--bg-hover); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; padding:8px 12px; font-weight:600;">${monthOpts}</select>
        <span style="font-size:12px; color:var(--text-secondary);">${list.length} transactions</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px;">
        ${kpi('Spent', money(spend), 'var(--accent-power)')}
        ${kpi('Income', money(income), 'var(--success)')}
        ${kpi('Net', money(net), net >= 0 ? 'var(--success)' : 'var(--accent-power)')}
      </div>
    </div>`;

    // Category breakdown + budget vs actual
    html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-chart-donut"></i></div>Spending by Category</div>`;
    if (!cats.length) html += `<div style="color:var(--text-secondary); font-size:14px;">No spending in this period.</div>`;
    cats.forEach(c => {
      const pct = spend > 0 ? Math.round(c.amount / spend * 100) : 0;
      const budget = b.budgets[c.cat] || 0;
      const over = budget > 0 && c.amount > budget;
      const barPct = budget > 0 ? Math.min(100, Math.round(c.amount / budget * 100)) : pct;
      const barCol = budget > 0 ? (over ? 'var(--accent-power)' : 'var(--success)') : catColor(c.cat);
      html += `<div style="margin-bottom:12px; cursor:pointer;" onclick="budgetSetBudget('${c.cat}')">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:4px;">
          <span style="display:inline-flex; align-items:center; gap:7px;"><i class="ti ${catIcon(c.cat)}" style="color:${catColor(c.cat)};"></i><strong style="color:var(--text-primary);">${c.cat}</strong><span style="color:var(--text-secondary);">${pct}%</span></span>
          <span style="color:var(--text-primary); font-weight:600;">${money(c.amount)}${budget > 0 ? ` <span style="color:var(--text-secondary); font-weight:400;">/ ${money(budget)}</span>` : ''}</span>
        </div>
        <div style="height:7px; border-radius:4px; background:rgba(148,163,184,.18); overflow:hidden;"><div style="height:100%; width:${barPct}%; background:${barCol};"></div></div>
        ${over ? `<div style="font-size:11px; color:var(--accent-power); margin-top:3px;">Over budget by ${money(c.amount - budget)}</div>` : ''}
      </div>`;
    });
    html += `<div style="font-size:11px; color:var(--text-secondary); margin-top:8px;">Tap a category to set a monthly budget target.</div></div>`;

    // Top merchants
    const tm = topMerchants(list, 8);
    html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-building-store"></i></div>Top Merchants</div>
      <table class="data-table"><tbody>${tm.map(m => `<tr>
        <td><span style="display:inline-flex; align-items:center; gap:7px;"><i class="ti ${catIcon(m.cat)}" style="color:${catColor(m.cat)};"></i>${esc(m.merchant)}</span></td>
        <td style="text-align:right; color:var(--text-secondary); font-size:12px;">${m.count}×</td>
        <td class="data-value" style="text-align:right;">${money(m.amount)}</td>
        <td style="text-align:right; white-space:nowrap;"><select onchange="budgetRecat('${esc(m.merchant)}', this.value)" title="Recategorize" style="background:var(--bg-hover); border:1px solid var(--border); color:var(--text-secondary); border-radius:6px; padding:3px 6px; font-size:11px;">${['', ...CAT_NAMES].map(cn => `<option value="${cn}"${cn === m.cat ? ' selected' : ''}>${cn || '↳ cat'}</option>`).join('')}</select></td>
      </tr>`).join('')}</tbody></table></div>`;

    // Recurring subscriptions
    const rec = recurring();
    if (rec.length) {
      const recTotal = rec.reduce((s, r) => s + r.monthly, 0);
      html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-repeat"></i></div>Recurring / Subscriptions</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">${rec.length} recurring charges · ~${money(recTotal)}/mo · ${money(recTotal * 12)}/yr</div>
        <table class="data-table"><tbody>${rec.slice(0, 12).map(r => `<tr><td>${esc(r.merchant)}</td><td style="text-align:right; color:var(--text-secondary); font-size:12px;">${r.months} mo</td><td class="data-value" style="text-align:right;">${money(r.monthly)}/mo</td></tr>`).join('')}</tbody></table></div>`;
    }

    // Trend
    const trend = monthlyTrend(6);
    if (trend.length > 1) {
      const max = Math.max(...trend.map(t => t.spend), 1);
      html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-chart-bar"></i></div>Monthly Spend Trend</div>
        <div style="display:flex; align-items:flex-end; gap:10px; height:150px; padding-top:10px;">
          ${trend.map(t => `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end;">
            <div style="font-size:11px; color:var(--text-primary); font-weight:600;">${money(t.spend)}</div>
            <div style="width:100%; max-width:48px; height:${Math.max(4, Math.round(t.spend / max * 110))}px; background:var(--grad); border-radius:6px 6px 0 0;"></div>
            <div style="font-size:11px; color:var(--text-secondary);">${monthLabel(t.month, true)}</div>
          </div>`).join('')}
        </div></div>`;
    }

    // Insights
    const ins = insights(list, spend, cats, rec, selMonth);
    if (ins.length) {
      html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-bulb"></i></div>Where to Save</div>
        ${ins.map(x => `<div style="display:flex; gap:9px; align-items:flex-start; font-size:14px; line-height:1.5; margin:7px 0; color:var(--text-primary);"><i class="ti ${x.ok ? 'ti-circle-check' : 'ti-alert-circle'}" style="color:${x.ok ? 'var(--success)' : 'var(--warning)'}; margin-top:2px; flex-shrink:0;"></i><span>${x.text}</span></div>`).join('')}
      </div>`;
    }

    // Manage
    html += `<div class="section"><div class="section-title"><div class="section-icon"><i class="ti ti-settings"></i></div>Manage</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn-secondary" onclick="budgetExport()"><i class="ti ti-download" style="margin-right:6px;"></i>Export transactions (CSV)</button>
        <button class="btn-secondary" onclick="budgetClearAll()" style="border-color:var(--accent-power); color:var(--accent-power);"><i class="ti ti-trash" style="margin-right:6px;"></i>Clear all budget data</button>
      </div>
      <div id="budget-manage-msg" style="margin-top:10px;"></div>
    </div>`;

    root.innerHTML = html;
  }

  function kpi(label, val, color) {
    return `<div style="background:var(--bg-hover); border-radius:12px; padding:14px; text-align:center;">
      <div style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700; color:${color};">${val}</div>
      <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em; margin-top:4px;">${label}</div></div>`;
  }
  function monthLabel(m, short) {
    const [y, mo] = m.split('-'); const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
    return d.toLocaleDateString('en-US', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
  }

  function importPanel() {
    const prev = pending ? `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin-top:12px; font-size:13px;">
        <strong style="color:var(--text-primary);">${pending.parsed.length}</strong> rows parsed · <strong style="color:var(--text-primary);">${pending.newCount}</strong> new, ${pending.dupCount} duplicate${pending.dupCount === 1 ? '' : 's'} · spend <strong>${money(pending.total)}</strong>
        <div style="color:var(--text-secondary); font-size:12px; margin-top:4px;">${pending.range}. If the spend total looks inverted, flip the sign toggle and re-pick the file.</div>
        <button class="btn-primary" style="margin-top:10px;" onclick="budgetAddPending()" ${pending.newCount ? '' : 'disabled'}><i class="ti ti-check" style="margin-right:6px;"></i>Add ${pending.newCount} to budget</button>
      </div>` : '';
    return `<div style="background:var(--bg-hover); border-radius:12px; padding:16px; margin-top:14px;">
      <div class="form-row">
        <div class="form-group"><label>Account / card name</label><input type="text" id="bud-account" placeholder="e.g. Chase Sapphire" value="${esc(pending ? pending.account : '')}"></div>
        <div class="form-group"><label>Purchases show as</label>
          <select id="bud-sign">
            <option value="neg"${(!pending || pending.signMode === 'neg') ? ' selected' : ''}>Negative amounts (most cards)</option>
            <option value="pos"${(pending && pending.signMode === 'pos') ? ' selected' : ''}>Positive amounts (debit column)</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>CSV file</label><input type="file" id="bud-file" accept=".csv,text/csv" onchange="budgetParseFile(this)"></div>
      <div id="bud-import-msg" style="margin-top:8px; font-size:12px;"></div>
      ${prev}
    </div>`;
  }

  function insights(list, spend, cats, rec, month) {
    const out = []; const push = (ok, text) => out.push({ ok, text });
    if (!cats.length) return out;
    const top = cats[0], pct = Math.round(top.amount / spend * 100);
    if (pct >= 25) push(false, `<strong>${top.cat}</strong> is your biggest category at <strong>${pct}%</strong> of spend (${money(top.amount)}). Trimming it has the most leverage.`);
    const dining = cats.find(c => c.cat === 'Dining'), groc = cats.find(c => c.cat === 'Groceries');
    if (dining && groc && dining.amount >= groc.amount * 0.8) push(false, `Dining (${money(dining.amount)}) is nearly as much as groceries (${money(groc.amount)}) — cooking a couple more nights is an easy win.`);
    else if (dining && dining.amount > spend * 0.15) push(false, `Dining out is ${money(dining.amount)} this period — a notable slice of spending.`);
    if (rec.length) { const rt = rec.reduce((s, r) => s + r.monthly, 0); push(rec.length <= 5, `${rec.length} recurring subscriptions total <strong>${money(rt)}/mo</strong> (${money(rt * 12)}/yr). Worth a review for ones you don't use.`); }
    const fees = cats.find(c => c.cat === 'Fees'); if (fees && fees.amount > 0) push(false, `You paid <strong>${money(fees.amount)}</strong> in fees/interest — often avoidable with autopay or a no-fee account.`);
    // budget adherence
    const b = B(); let overs = 0, overAmt = 0;
    cats.forEach(c => { const bud = b.budgets[c.cat] || 0; if (bud > 0 && c.amount > bud) { overs++; overAmt += c.amount - bud; } });
    if (overs) push(false, `Over budget in <strong>${overs}</strong> categor${overs === 1 ? 'y' : 'ies'} by <strong>${money(overAmt)}</strong> total.`);
    // trend vs prior month
    if (month !== 'all') { const ms = [...new Set(B().transactions.map(t => t.date.slice(0, 7)))].sort(); const idx = ms.indexOf(month); if (idx > 0) { const prevSpend = totalSpend(txForMonth(ms[idx - 1])); if (prevSpend > 0) { const diff = spend - prevSpend; const p = Math.round(Math.abs(diff) / prevSpend * 100); if (p >= 8) push(diff < 0, `Spending is <strong>${diff < 0 ? 'down' : 'up'} ${p}%</strong> vs ${monthLabel(ms[idx - 1])} (${money(Math.abs(diff))}).`); } } }
    if (!out.length) push(true, 'Spending looks balanced across categories — nice.');
    return out.slice(0, 6);
  }

  // ---- actions (window-exposed) ----
  window.renderBudget = renderBudget;
  window.budgetToggleImport = function () { showImport = !showImport; pending = null; renderBudget(); };
  window.budgetSetMonth = function (m) { selMonth = m; renderBudget(); };

  window.budgetParseFile = function (input) {
    const file = input.files && input.files[0]; if (!file) return;
    const account = ($('bud-account') && $('bud-account').value.trim()) || 'Account';
    const signMode = ($('bud-sign') && $('bud-sign').value) || 'neg';
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { txns, error } = parseStatement(reader.result, signMode);
        if (error || !txns.length) { if ($('bud-import-msg')) $('bud-import-msg').innerHTML = `<span style="color:var(--accent-power);">Couldn't read that CSV (${error || 'no rows found'}). Make sure it has Date, Description and Amount columns.</span>`; return; }
        const existing = new Set(B().transactions.map(t => t.id));
        const parsed = txns.map(t => ({ ...t, id: txId(t, account), account, category: categorize(t.desc) }));
        const fresh = parsed.filter(t => !existing.has(t.id));
        const dates = parsed.map(t => t.date).sort();
        pending = { account, signMode, parsed, newCount: fresh.length, dupCount: parsed.length - fresh.length, total: parsed.filter(isSpend).reduce((s, t) => s + t.amount, 0), range: `${dates[0]} → ${dates[dates.length - 1]}`, fresh };
        renderBudget();
      } catch (e) { if ($('bud-import-msg')) $('bud-import-msg').innerHTML = `<span style="color:var(--accent-power);">Parse error: ${esc(e.message)}</span>`; }
    };
    reader.readAsText(file);
  };

  window.budgetAddPending = function () {
    if (!pending || !pending.fresh.length) return;
    const b = B();
    b.transactions = b.transactions.concat(pending.fresh);
    b.transactions.sort((a, z) => (a.date < z.date ? 1 : -1));
    const n = pending.fresh.length, acct = pending.account;
    pending = null; showImport = false;
    if (typeof saveData === 'function') saveData(appData);
    renderBudget();
    if ($('budget-manage-msg')) { }
    if (typeof updateStats === 'function') updateStats();
  };

  window.budgetSetMonthBudget = null;
  window.budgetSetBudget = function (cat) {
    const b = B(); const cur = b.budgets[cat] || '';
    const v = prompt(`Monthly budget for ${cat} (dollars). Leave blank to remove.`, cur);
    if (v === null) return;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    if (!v.trim() || isNaN(n) || n <= 0) delete b.budgets[cat]; else b.budgets[cat] = Math.round(n);
    if (typeof saveData === 'function') saveData(appData);
    renderBudget();
  };

  window.budgetRecat = function (merchant, cat) {
    if (!cat) return;
    const b = B(); const key = merchant.toLowerCase();
    // add/replace a rule on the merchant's normalized name, then re-apply to all tx
    b.catRules = (b.catRules || []).filter(r => r.match !== key);
    b.catRules.push({ match: key, category: cat });
    b.transactions.forEach(t => { if (prettyMerchant(t.desc).toLowerCase() === key) t.category = cat; });
    if (typeof saveData === 'function') saveData(appData);
    renderBudget();
  };

  window.budgetExport = function () {
    const rows = [['Date', 'Description', 'Amount(spend+)', 'Category', 'Account']].concat(
      B().transactions.map(t => [t.date, '"' + String(t.desc).replace(/"/g, '""') + '"', t.amount, t.category, t.account]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `budget-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  window.budgetClearAll = function () {
    if (!confirm('Clear ALL budget data (every imported transaction and budget target)? This cannot be undone. Your other tracking is not affected.')) return;
    appData.budget = { transactions: [], budgets: {}, catRules: [] };
    pending = null; selMonth = null;
    if (typeof saveData === 'function') saveData(appData);
    renderBudget();
  };

})();
