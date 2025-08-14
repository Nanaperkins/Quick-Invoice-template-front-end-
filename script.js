(function () {
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

  const els = {
    logoInput: $("#logoInput"),
    bizName: $("#bizName"),
    bizEmail: $("#bizEmail"),
    bizPhone: $("#bizPhone"),
    bizAddress: $("#bizAddress"),
    clientName: $("#clientName"),
    clientEmail: $("#clientEmail"),
    clientPhone: $("#clientPhone"),
    clientAddress: $("#clientAddress"),
    invoiceNumber: $("#invoiceNumber"),
    invoiceDate: $("#invoiceDate"),
    dueDate: $("#dueDate"),
    currency: $("#currency"),
    discount: $("#discount"),
    shipping: $("#shipping"),
    notes: $("#notes"),
    terms: $("#terms"),
    itemsBody: $("#itemsBody"),
    itemRowTemplate: $("#itemRowTemplate"),
    subtotal: $("#subtotal"),
    taxTotal: $("#taxTotal"),
    discountOut: $("#discountOut"),
    shippingOut: $("#shippingOut"),
    grandTotal: $("#grandTotal"),
    preview: $("#preview"),
    addItemBtn: $("#addItemBtn"),
    printBtn: $("#printBtn"),
    newBtn: $("#newBtn"),
    saveBtn: $("#saveBtn"),
    loadBtn: $("#loadBtn"),
    exportBtn: $("#exportBtn"),
    importInput: $("#importInput"),
    themeBtn: $("#themeBtn"),
    // conversion
    displayCurrency: $("#displayCurrency"),
    rateInfo: $("#rateInfo"),
    convertedTotal: $("#convertedTotal"),
    convertedLabel: $("#convertedLabel"),
  };

  const THEME_KEY = "qi_theme";
  const DRAFT_KEY = "qi_prowow_draft";
  const STORE_KEY = "qi_prowow_saved";
  const RATE_KEY = "qi_rates_cache"; // stores {base, at, rates:{}}

  function currencySymbol(code) {
    const map = { GHS: "₵", USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh" };
    return map[code] || code + " ";
  }

  // Items
  function addRow(item = {}) {
    const row = els.itemRowTemplate.content.cloneNode(true);
    const tr = row.querySelector("tr");
    $(".desc", tr).value = item.desc || "";
    $(".qty", tr).value = item.qty != null ? item.qty : 1;
    $(".price", tr).value = item.price != null ? item.price : 0;
    $(".tax", tr).value = item.tax != null ? item.tax : 0;

    $(".remove", tr).addEventListener("click", () => {
      tr.classList.add("row-exit");
      tr.addEventListener("animationend", () => { tr.remove(); recalc(); }, { once: true });
    });
    $(".dup", tr).addEventListener("click", () => {
      const data = rowToObj(tr);
      addRow(data); recalc();
    });
    $(".up", tr).addEventListener("click", () => { moveRow(tr, -1); });
    $(".down", tr).addEventListener("click", () => { moveRow(tr, +1); });
    $$("input", tr).forEach(i => i.addEventListener("input", recalc));
    els.itemsBody.appendChild(tr);
  }

  function moveRow(tr, delta) {
    const rows = $$("#itemsBody tr");
    const idx = rows.indexOf(tr);
    const target = idx + delta;
    if (target < 0 || target >= rows.length) return;
    if (delta < 0) tr.parentNode.insertBefore(tr, rows[target]);
    else tr.parentNode.insertBefore(rows[target], tr);
    recalc();
  }

  function rowToObj(tr) {
    return {
      desc: $(".desc", tr).value.trim(),
      qty: parseFloat($(".qty", tr).value) || 0,
      price: parseFloat($(".price", tr).value) || 0,
      tax: parseFloat($(".tax", tr).value) || 0,
    };
  }

  function getItems() {
    return $$("#itemsBody tr").map(rowToObj);
  }

  function formatMoney(n, code) {
    return currencySymbol(code) + (Number(n).toFixed(2));
  }

  function computeTotals() {
    const items = getItems();
    const subtotal = items.reduce((s,it)=>s+it.qty*it.price,0);
    const tax = items.reduce((s,it)=>s+(it.qty*it.price)*(it.tax/100),0);
    const discount = parseFloat(els.discount.value) || 0;
    const shipping = parseFloat(els.shipping.value) || 0;
    const total = subtotal + tax - discount + shipping;
    return { subtotal, tax, discount, shipping, total };
  }

  function pulse(el) {
    el.classList.remove("pulse");
    void el.offsetWidth; // reflow to restart animation
    el.classList.add("pulse");
  }

  function recalc() {
    const items = getItems();
    let subtotal = 0, taxTotal = 0;
    items.forEach((it, idx) => {
      const line = it.qty * it.price;
      const lineTax = (line * it.tax) / 100;
      subtotal += line;
      taxTotal += lineTax;
      const tr = els.itemsBody.children[idx];
      $(".line-total", tr).textContent = (line + lineTax).toFixed(2);
    });

    const t = computeTotals();
    const cur = els.currency.value;

    const outs = [
      [els.subtotal, formatMoney(t.subtotal, cur)],
      [els.taxTotal, formatMoney(t.tax, cur)],
      [els.discountOut, formatMoney(t.discount, cur)],
      [els.shippingOut, formatMoney(t.shipping, cur)],
      [els.grandTotal, formatMoney(t.total, cur)],
    ];
    outs.forEach(([el, text]) => {
      if (el.textContent !== text) { el.textContent = text; pulse(el); }
    });

    renderPreview();
    updateConversion();
    persistDraft();
  }

  function gatherData() {
    return {
      brand: {
        logo: localStorage.getItem("qi_prowow_logo") || null,
        name: els.bizName.value.trim(),
        email: els.bizEmail.value.trim(),
        phone: els.bizPhone.value.trim(),
        address: els.bizAddress.value.trim(),
      },
      client: {
        name: els.clientName.value.trim(),
        email: els.clientEmail.value.trim(),
        phone: els.clientPhone.value.trim(),
        address: els.clientAddress.value.trim(),
      },
      meta: {
        number: els.invoiceNumber.value.trim(),
        date: els.invoiceDate.value,
        due: els.dueDate.value,
        currency: els.currency.value,
        discount: parseFloat(els.discount.value) || 0,
        shipping: parseFloat(els.shipping.value) || 0,
      },
      items: getItems(),
      notes: els.notes.value.trim(),
      terms: els.terms.value.trim(),
      totals: computeTotals()
    };
  }

  function fillForm(d) {
    if (d.brand?.logo) localStorage.setItem("qi_prowow_logo", d.brand.logo);
    els.bizName.value = d.brand?.name || "";
    els.bizEmail.value = d.brand?.email || "";
    els.bizPhone.value = d.brand?.phone || "";
    els.bizAddress.value = d.brand?.address || "";
    els.clientName.value = d.client?.name || "";
    els.clientEmail.value = d.client?.email || "";
    els.clientPhone.value = d.client?.phone || "";
    els.clientAddress.value = d.client?.address || "";
    els.invoiceNumber.value = d.meta?.number || "";
    els.invoiceDate.value = d.meta?.date || "";
    els.dueDate.value = d.meta?.due || "";
    els.currency.value = d.meta?.currency || "GHS";
    els.discount.value = d.meta?.discount || 0;
    els.shipping.value = d.meta?.shipping || 0;
    els.notes.value = d.notes || "";
    els.terms.value = d.terms || "";

    els.itemsBody.innerHTML = "";
    (d.items || []).forEach(addRow);
    if ((d.items || []).length === 0) addRow();
    recalc();
  }

  // Draft storage
  function persistDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(gatherData()));
  }
  function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try { fillForm(JSON.parse(raw)); } catch {}
  }

  // Save and Load named templates
  function saveNamed() {
    const key = prompt("Save as name");
    if (!key) return;
    const store = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    store[key] = gatherData();
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    alert("Saved " + key);
  }
  function loadNamed() {
    const store = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const keys = Object.keys(store);
    if (keys.length === 0) return alert("No saved templates");
    const pick = prompt("Enter name to load:\\n" + keys.join("\\n"));
    if (!pick || !store[pick]) return;
    fillForm(store[pick]);
  }

  // Export and Import JSON
  function exportJson() {
    const blob = new Blob([JSON.stringify(gatherData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (els.invoiceNumber.value || "invoice") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try { fillForm(JSON.parse(reader.result)); } catch { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  }

  // Logo upload stored locally
  function handleLogo(file) {
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem("qi_prowow_logo", reader.result);
      renderPreview();
    };
    reader.readAsDataURL(file);
  }

  // Preview rendering
  function renderPreview() {
    const d = gatherData();
    const cur = d.meta.currency;
    const t = d.totals;
    const logo = localStorage.getItem("qi_prowow_logo");

    $("#preview").innerHTML = `
      <div class="pv-header" style="display:flex; justify-content:space-between; gap:16px;">
        <div style="display:flex; gap:12px; align-items:center;">
          ${logo ? `<img src="${logo}" alt="logo" style="width:56px; height:56px; object-fit:cover; border-radius:8px; border:1px solid var(--border)" />` : ""}
          <div>
            <div style="font-weight:700; font-size:18px; margin-bottom:4px;">${escapeHtml(d.brand.name || "")}</div>
            <div style="color:var(--muted)">${escapeHtml(d.brand.address || "")}</div>
            <div style="color:var(--muted)">${escapeHtml(d.brand.email || "")}${d.brand.phone ? " · " + escapeHtml(d.brand.phone) : ""}</div>
          </div>
        </div>
        <div>
          <div><strong>No:</strong> ${escapeHtml(d.meta.number || "")}</div>
          <div><strong>Date:</strong> ${escapeHtml(d.meta.date || "")}</div>
          <div><strong>Due:</strong> ${escapeHtml(d.meta.due || "")}</div>
        </div>
      </div>

      <div class="pv-billto" style="margin:12px 0 8px;">
        <strong>Bill To</strong>
        <div>${escapeHtml(d.client.name || "")}</div>
        <div>${escapeHtml(d.client.address || "")}</div>
        <div>${escapeHtml(d.client.email || "")}${d.client.phone ? " · " + escapeHtml(d.client.phone) : ""}</div>
      </div>

      <table class="pv-table" style="width:100%; border-collapse:collapse;">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Tax %</th><th>Total</th></tr></thead>
        <tbody>
          ${d.items.map(it => `
            <tr>
              <td>${escapeHtml(it.desc)}</td>
              <td class="numcell">${it.qty}</td>
              <td class="numcell">${formatMoney(it.price, cur)}</td>
              <td class="numcell">${it.tax}%</td>
              <td class="numcell">${formatMoney(it.qty*it.price + (it.qty*it.price)*(it.tax/100), cur)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="pv-totals" style="margin-top:10px;">
        <div style="display:flex; justify-content:flex-end;">
          <div>
            <div style="display:flex; justify-content:space-between; gap:48px;"><span>Subtotal</span><span>${formatMoney(t.subtotal, cur)}</span></div>
            <div style="display:flex; justify-content:space-between; gap:48px;"><span>Tax</span><span>${formatMoney(t.tax, cur)}</span></div>
            <div style="display:flex; justify-content:space-between; gap:48px;"><span>Discount</span><span>${formatMoney(t.discount, cur)}</span></div>
            <div style="display:flex; justify-content:space-between; gap:48px;"><span>Shipping</span><span>${formatMoney(t.shipping, cur)}</span></div>
            <div style="display:flex; justify-content:space-between; gap:48px; font-weight:700;"><span>Total</span><span>${formatMoney(t.total, cur)}</span></div>
          </div>
        </div>
      </div>

      ${d.notes ? `<div class="pv-notes" style="margin-top:8px;"><strong>Notes</strong><p>${escapeHtml(d.notes)}</p></div>` : ""}
      ${d.terms ? `<div class="pv-terms"><strong>Terms</strong><p>${escapeHtml(d.terms)}</p></div>` : ""}
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  // Theme
  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  function initTheme() {
    const cur = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(cur);
  }
  function toggleTheme() {
    const cur = localStorage.getItem(THEME_KEY) || "light";
    const next = cur === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // Live currency converter
  async function getRates(base) {
    try {
      const cacheRaw = localStorage.getItem(RATE_KEY);
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        const age = Date.now() - (cache.at || 0);
        if (cache.base === base && age < 12 * 60 * 60 * 1000) { // 12h
          return cache.rates;
        }
      }
    } catch {}

    // fetch from exchangerate.host (no key required)
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("rate fetch failed");
    const data = await res.json();
    if (!data || !data.rates) throw new Error("bad rate payload");
    localStorage.setItem(RATE_KEY, JSON.stringify({ base, at: Date.now(), rates: data.rates }));
    return data.rates;
  }

  async function updateConversion() {
    const base = els.currency.value;
    const target = els.displayCurrency.value;
    const t = computeTotals();

    if (target === base) {
      els.convertedTotal.textContent = formatMoney(t.total, target);
      els.rateInfo.textContent = "No conversion applied";
      return;
    }
    els.rateInfo.textContent = "Fetching rates...";
    try {
      const rates = await getRates(base);
      const rate = rates[target];
      if (!rate) throw new Error("rate missing");
      const converted = t.total * rate;
      els.convertedTotal.textContent = currencySymbol(target) + converted.toFixed(2);
      els.rateInfo.textContent = `1 ${base} = ${rate.toFixed(4)} ${target}`;
    } catch (e) {
      els.rateInfo.textContent = "Could not fetch live rates. Showing base currency.";
      els.convertedTotal.textContent = formatMoney(t.total, base);
    }
  }

  // Events
  els.addItemBtn.addEventListener("click", () => { addRow(); recalc(); });
  ["input", "change"].forEach(ev => {
    [els.discount, els.shipping, els.currency, els.notes, els.terms,
     els.bizName, els.bizEmail, els.bizPhone, els.bizAddress,
     els.clientName, els.clientEmail, els.clientPhone, els.clientAddress,
     els.invoiceNumber, els.invoiceDate, els.dueDate].forEach(el => el.addEventListener(ev, recalc));
  });
  els.displayCurrency.addEventListener("change", updateConversion);

  els.printBtn.addEventListener("click", () => window.print());
  els.newBtn.addEventListener("click", () => fillForm({ items: [] }));
  els.saveBtn.addEventListener("click", saveNamed);
  els.loadBtn.addEventListener("click", loadNamed);
  els.exportBtn.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });
  els.logoInput.addEventListener("change", e => {
    if (e.target.files && e.target.files[0]) handleLogo(e.target.files[0]);
  });
  els.themeBtn.addEventListener("click", toggleTheme);

  // Init
  initTheme();
  addRow();
  loadDraft();
  recalc();
})();