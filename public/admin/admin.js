const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked") n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
let db = null, tab = "products", filter = { cat: "", q: "" };

function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 2500);
}
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== "/api/login") { showLogin(); throw new Error("Please log in"); }
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}
const catName = (id) => (db.categories.find((c) => c.id === id) || {}).name || "?";
async function reload() { db = await api("GET", "/api/admin/all"); render(); }

// ---------- login ----------
function showLogin() { $("#app").classList.add("hidden"); $("#login").classList.remove("hidden"); $("#pw").focus(); }
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("POST", "/api/login", { password: $("#pw").value });
    $("#pw").value = ""; $("#login-err").textContent = "";
    $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
    await reload();
  } catch (err) { $("#login-err").textContent = err.message; }
});
$("#logout").onclick = async () => { await api("POST", "/api/logout"); showLogin(); };
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
  render();
});

function render() {
  const m = $("#main"); m.replaceChildren();
  ({ products: viewProducts, categories: viewCategories, shop: viewShop, extras: viewExtras, password: viewPassword })[tab](m);
}

// ---------- products ----------
function viewProducts(m) {
  const list = db.products.filter((p) =>
    (!filter.cat || p.categoryId === filter.cat) &&
    (!filter.q || (p.name + " " + p.brand).toLowerCase().includes(filter.q)));

  const catSel = el("select", { onchange: (e) => { filter.cat = e.target.value; render(); } },
    el("option", { value: "" }, "All categories"),
    db.categories.map((c) => el("option", { value: c.id, selected: filter.cat === c.id }, c.name)));
  const search = el("input", { type: "search", placeholder: "Search…", value: filter.q, oninput: (e) => { filter.q = e.target.value.toLowerCase(); clearTimeout(search.t); search.t = setTimeout(() => { render(); const s = $("#main input[type=search]"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); } });

  m.append(el("div", { class: "bar" }, search, catSel,
    el("button", { class: "btn", onclick: () => productForm() }, "+ Add product"),
    el("button", { class: "btn sec", onclick: bulkPrice }, "Set price for all shown…")),
    el("p", { class: "muted" }, `${list.length} products. Greyed rows are hidden from the website.`));

  const rows = list.map((p) => el("tr", { class: p.visible ? "" : "off" },
    el("td", {}, p.image ? el("img", { src: "/" + p.image, alt: "" }) : ""),
    el("td", {}, el("strong", {}, p.name), p.brand ? el("div", { class: "muted" }, p.brand) : null),
    el("td", {}, catName(p.categoryId)),
    el("td", {}, `₹${p.price}${p.unit ? " / " + p.unit : ""}`),
    el("td", {}, el("label", { class: "inline", style: "margin:0" }, el("input", { type: "checkbox", checked: p.inStock, onchange: (e) => quick(p, { inStock: e.target.checked }) }), "In stock")),
    el("td", {}, el("label", { class: "inline", style: "margin:0" }, el("input", { type: "checkbox", checked: p.visible, onchange: (e) => quick(p, { visible: e.target.checked }) }), "Show")),
    el("td", {}, el("button", { class: "btn sec sm", onclick: () => productForm(p) }, "Edit"), " ",
      el("button", { class: "btn danger sm", onclick: () => delProduct(p) }, "Delete"))));
  m.append(el("div", { class: "scroll" }, el("table", {},
    el("thead", {}, el("tr", {}, ["", "Product", "Category", "Price", "Stock", "Visible", ""].map((h) => el("th", {}, h)))),
    el("tbody", {}, rows))));
}
async function quick(p, patch) {
  try { Object.assign(p, await api("PUT", "/api/admin/products/" + p.id, { ...p, ...patch })); toast("Saved"); render(); } catch (e) { toast(e.message, true); reload(); }
}
async function delProduct(p) {
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  try { await api("DELETE", "/api/admin/products/" + p.id); toast("Deleted"); await reload(); } catch (e) { toast(e.message, true); }
}
async function bulkPrice() {
  const v = prompt(`Set the price (₹) for ${filter.cat ? "all products in this category" : "ALL products"}:`, "1");
  if (v == null) return;
  const price = Number(v);
  if (!Number.isFinite(price) || price < 0) return toast("Enter a valid number", true);
  try { const r = await api("POST", "/api/admin/bulk-price", { price, categoryId: filter.cat }); toast(`${r.updated} prices updated`); await reload(); } catch (e) { toast(e.message, true); }
}

function resizeImage(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = URL.createObjectURL(file);
  });
}

function productForm(p = {}) {
  const d = $("#dlg"); d.replaceChildren();
  const f = { categoryId: p.categoryId || filter.cat || (db.categories[0] || {}).id, name: p.name || "", brand: p.brand || "", price: p.price ?? 1, unit: p.unit || "", description: p.description || "", image: p.image || "", inStock: p.inStock !== false, visible: p.visible !== false };
  const prev = el("img", { class: "imgprev", src: f.image ? "/" + f.image : "", alt: "", style: f.image ? "" : "display:none" });
  const field = (label, key, type = "text") => el("label", {}, label, el("input", { type, value: f[key], step: type === "number" ? "any" : null, min: type === "number" ? "0" : null, oninput: (e) => (f[key] = e.target.value) }));
  const file = el("input", { type: "file", accept: "image/*", onchange: async (e) => {
    const fl = e.target.files[0]; if (!fl) return;
    try { const r = await api("POST", "/api/admin/upload", { data: await resizeImage(fl) }); f.image = r.url; prev.src = "/" + r.url; prev.style.display = ""; toast("Image uploaded"); } catch (err) { toast(err.message, true); }
  } });
  d.append(el("h2", {}, p.id ? "Edit product" : "Add product"),
    el("form", { method: "dialog", onsubmit: async (e) => {
      e.preventDefault();
      try {
        if (p.id) await api("PUT", "/api/admin/products/" + p.id, f); else await api("POST", "/api/admin/products", f);
        d.close(); toast("Saved"); await reload();
      } catch (err) { toast(err.message, true); }
    } },
      el("label", {}, "Category", el("select", { onchange: (e) => (f.categoryId = e.target.value) }, db.categories.map((c) => el("option", { value: c.id, selected: c.id === f.categoryId }, c.name)))),
      el("label", {}, "Product name", el("input", { value: f.name, required: true, oninput: (e) => (f.name = e.target.value) })),
      el("div", { class: "row2" }, field("Brand", "brand"), field("Price (₹)", "price", "number")),
      el("div", { class: "row2" }, field("Unit (e.g. kg, litre, piece)", "unit"), el("span")),
      el("label", {}, "Description", el("textarea", { rows: 3, oninput: (e) => (f.description = e.target.value) }, f.description)),
      el("label", {}, "Photo", prev, file),
      el("label", { class: "inline" }, el("input", { type: "checkbox", checked: f.inStock, onchange: (e) => (f.inStock = e.target.checked) }), "In stock"),
      el("label", { class: "inline" }, el("input", { type: "checkbox", checked: f.visible, onchange: (e) => (f.visible = e.target.checked) }), "Show on website"),
      el("div", { class: "bar" }, el("button", { class: "btn", type: "submit" }, "Save"), el("button", { class: "btn sec", type: "button", onclick: () => d.close() }, "Cancel"))));
  d.showModal();
}

// ---------- categories ----------
function viewCategories(m) {
  m.append(el("div", { class: "bar" }, el("button", { class: "btn", onclick: () => catForm() }, "+ Add category")));
  m.append(el("div", { class: "scroll" }, el("table", {},
    el("thead", {}, el("tr", {}, ["", "Category", "Products", "Visible", ""].map((h) => el("th", {}, h)))),
    el("tbody", {}, db.categories.map((c, i) => el("tr", { class: c.visible ? "" : "off" },
      el("td", {}, c.icon),
      el("td", {}, el("strong", {}, c.name)),
      el("td", {}, String(db.products.filter((p) => p.categoryId === c.id).length)),
      el("td", {}, c.visible ? "Yes" : "Hidden"),
      el("td", {}, el("button", { class: "btn sec sm", onclick: () => catForm(c) }, "Edit"), " ",
        el("button", { class: "btn danger sm", onclick: () => delCat(c) }, "Delete"))))))));
}
function catForm(c = {}) {
  const d = $("#dlg"); d.replaceChildren();
  const f = { name: c.name || "", icon: c.icon || "📦", description: c.description || "", visible: c.visible !== false };
  d.append(el("h2", {}, c.id ? "Edit category" : "Add category"),
    el("form", { method: "dialog", onsubmit: async (e) => {
      e.preventDefault();
      try { if (c.id) await api("PUT", "/api/admin/categories/" + c.id, f); else await api("POST", "/api/admin/categories", f); d.close(); toast("Saved"); await reload(); } catch (err) { toast(err.message, true); }
    } },
      el("label", {}, "Name", el("input", { value: f.name, required: true, oninput: (e) => (f.name = e.target.value) })),
      el("label", {}, "Icon (an emoji)", el("input", { value: f.icon, maxlength: 4, oninput: (e) => (f.icon = e.target.value) })),
      el("label", {}, "Description (optional)", el("input", { value: f.description, oninput: (e) => (f.description = e.target.value) })),
      el("label", { class: "inline" }, el("input", { type: "checkbox", checked: f.visible, onchange: (e) => (f.visible = e.target.checked) }), "Show on website"),
      el("div", { class: "bar" }, el("button", { class: "btn", type: "submit" }, "Save"), el("button", { class: "btn sec", type: "button", onclick: () => d.close() }, "Cancel"))));
  d.showModal();
}
async function delCat(c) {
  if (!confirm(`Delete category "${c.name}"?`)) return;
  try { await api("DELETE", "/api/admin/categories/" + c.id); toast("Deleted"); await reload(); } catch (e) { toast(e.message, true); }
}

// ---------- shop settings ----------
function imageField(label, obj, key) {
  const prev = el("img", { class: "imgprev", src: obj[key] ? "/" + obj[key] : "", alt: "", style: obj[key] ? "" : "display:none" });
  const file = el("input", { type: "file", accept: "image/*", onchange: async (e) => {
    const fl = e.target.files[0]; if (!fl) return;
    try { const r = await api("POST", "/api/admin/upload", { data: await resizeImage(fl) }); obj[key] = r.url; prev.src = "/" + r.url; prev.style.display = ""; toast("Image uploaded – press Save changes"); } catch (err) { toast(err.message, true); }
  } });
  return el("label", {}, label, prev, file);
}
function viewShop(m) {
  const s = { ...db.settings };
  const f = (label, key, area) => el("label", {}, label, area
    ? el("textarea", { rows: 4, oninput: (e) => (s[key] = e.target.value) }, s[key] || "")
    : el("input", { value: s[key] || "", oninput: (e) => (s[key] = e.target.value) }));
  m.append(el("form", { class: "panel", onsubmit: async (e) => {
    e.preventDefault();
    try { db.settings = await api("PUT", "/api/admin/settings", s); toast("Saved"); } catch (err) { toast(err.message, true); }
  } },
    el("h2", {}, "Shop details"),
    f("Shop name", "shopName"), f("Tagline (under the name)", "tagline"),
    f("Home page heading", "heroTitle"), f("Home page text", "heroText", true),
    f("Address", "address"),
    el("div", { class: "row2" }, f("Phone 1", "phone1"), f("Phone 2", "phone2")),
    f("WhatsApp number with country code (e.g. 919597365105)", "whatsapp"),
    f("Instagram link", "instagram"), f("Opening hours", "hours"),
    f("Map location (address or latitude,longitude)", "mapQuery"),
    f("About us text", "about", true), f("Currency symbol", "currency"),
    imageField("Logo (shown in the top bar)", s, "logo"),
    imageField("Shop photo (shown on Home and About)", s, "shopImage"),
    el("label", { class: "inline" }, el("input", { type: "checkbox", checked: s.showPrices !== false, onchange: (e) => (s.showPrices = e.target.checked) }), "Show prices on website (untick to show “Call for price”)"),
    el("button", { class: "btn", type: "submit" }, "Save changes")));
}

// ---------- brands & reviews ----------
function viewExtras(m) {
  const s = db.settings;
  let brands = (s.brands || []).join("\n"), reviews = (s.reviews || []).join("\n");
  m.append(el("form", { class: "panel", onsubmit: async (e) => {
    e.preventDefault();
    const lines = (t) => t.split("\n").map((x) => x.trim()).filter(Boolean);
    try { db.settings = await api("PUT", "/api/admin/settings", { brands: lines(brands), reviews: lines(reviews) }); toast("Saved"); } catch (err) { toast(err.message, true); }
  } },
    el("h2", {}, "Brands & reviews"),
    el("label", {}, "Brands (one per line)", el("textarea", { rows: 8, oninput: (e) => (brands = e.target.value) }, brands)),
    el("label", {}, "Customer reviews to show on the home page (one per line)", el("textarea", { rows: 6, oninput: (e) => (reviews = e.target.value) }, reviews)),
    el("button", { class: "btn", type: "submit" }, "Save changes")));
}

// ---------- password ----------
function viewPassword(m) {
  const f = { current: "", next: "" };
  m.append(el("form", { class: "panel", style: "max-width:420px", onsubmit: async (e) => {
    e.preventDefault();
    try { await api("POST", "/api/admin/password", f); toast("Password changed"); e.target.reset(); } catch (err) { toast(err.message, true); }
  } },
    el("h2", {}, "Change password"),
    el("label", {}, "Current password", el("input", { type: "password", required: true, autocomplete: "current-password", oninput: (e) => (f.current = e.target.value) })),
    el("label", {}, "New password (min 8 characters)", el("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password", oninput: (e) => (f.next = e.target.value) })),
    el("button", { class: "btn", type: "submit" }, "Change password")));
}

// ---------- start ----------
(async () => {
  try { await reload(); $("#app").classList.remove("hidden"); } catch { showLogin(); }
})();
