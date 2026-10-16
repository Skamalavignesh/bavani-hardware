const menuBtn = document.querySelector(".menu-btn");
const navList = document.querySelector(".nav ul");
if (menuBtn && navList) menuBtn.addEventListener("click", () => navList.classList.toggle("open"));

// tiny DOM helper: el("div", {class:"card"}, "text" | node, ...)
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
const digits = (s) => String(s || "").replace(/\D/g, "");

function money(s, v) {
  const n = Number(v);
  return `${s.currency || "₹"}${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function productCard(s, p) {
  const img = p.image ? el("img", { src: p.image, alt: p.name, loading: "lazy", class: "pimg" }) : null;
  return el("div", { class: "card product" + (p.inStock ? "" : " out") },
    img,
    el("h3", {}, p.name),
    p.brand ? el("p", { class: "muted" }, p.brand) : null,
    p.description ? el("p", {}, p.description) : null,
    el("p", { class: "price" },
      s.showPrices ? money(s, p.price) + (p.unit ? " / " + p.unit : "") : "Call for price",
      p.inStock ? null : el("span", { class: "badge" }, "Out of stock")));
}

function renderFooter(s) {
  const f = document.querySelector("footer");
  if (!f) return;
  const link = (href, t) => el("a", { href, style: "color:#c3cde0", target: href.startsWith("http") ? "_blank" : null, rel: "noopener" }, t);
  f.replaceChildren(el("div", { class: "container" },
    el("div", { class: "cols" },
      el("div", {}, el("h4", {}, s.shopName), s.address),
      el("div", {}, el("h4", {}, "Call us"),
        s.phone1 ? link("tel:+91" + digits(s.phone1).slice(-10), s.phone1) : null, el("br"),
        s.phone2 ? link("tel:+91" + digits(s.phone2).slice(-10), s.phone2) : null),
      el("div", {}, el("h4", {}, "Follow"), s.instagram ? link(s.instagram, "Instagram") : null)),
    el("p", { class: "copy" }, `© ${new Date().getFullYear()} ${s.shopName}. All rights reserved.`)));
  if (s.whatsapp) document.body.append(el("a", { class: "whatsapp", href: "https://wa.me/" + digits(s.whatsapp), target: "_blank", rel: "noopener" }, "WhatsApp"));
}

// Products page: one card per category; typing in the search box lists matching products instead.
function renderCategoryIndex(s, cats, prods, grid, catLink) {
  const results = document.getElementById("search-results");
  const search = document.getElementById("search");
  grid.replaceChildren(...cats.map((c) => {
    const list = prods.filter((p) => p.categoryId === c.id);
    return el("a", { class: "card catcard" + (/tool/i.test(c.name) ? " tools" : ""), href: catLink(c) },
      el("div", { class: "icon" }, c.icon), el("h3", {}, c.name),
      c.description ? el("p", {}, c.description) : null,
      el("ul", { class: "plist" }, list.map((p) => el("li", {}, p.name))),
      el("p", { class: "price" }, `${list.length} product${list.length === 1 ? "" : "s"} →`));
  }));
  reveal(grid);
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    results.replaceChildren();
    grid.style.display = q ? "none" : "";
    if (!q) return;
    const list = prods.filter((p) => (p.name + " " + p.brand).toLowerCase().includes(q));
    results.append(list.length ? el("div", { class: "grid" }, list.map((p) => productCard(s, p))) : el("p", { class: "lead" }, "No products found."));
    reveal(results);
  });
}

// One category's page: /category.html?c=<id>
function renderCategoryPage(s, cats, prods, root, catLink) {
  const id = new URLSearchParams(location.search).get("c");
  const i = cats.findIndex((c) => c.id === id);
  const title = document.getElementById("cat-title");
  if (i < 0) { title.textContent = "Category not found"; root.append(el("p", { class: "lead" }, el("a", { href: "products.html" }, "← See all categories"))); return; }
  const c = cats[i];
  if (/tool/i.test(c.name)) document.body.classList.add("theme-tools");
  document.title = `${c.name} – ${s.shopName}`;
  title.textContent = `${c.icon} ${c.name}`;
  const sub = document.getElementById("cat-sub"); if (sub) sub.textContent = c.description || "Call or WhatsApp us for availability and bulk rates.";
  const list = prods.filter((p) => p.categoryId === c.id);
  root.append(el("p", { class: "muted", style: "margin-bottom:16px" }, el("a", { href: "products.html" }, "← All categories"), ` · ${list.length} products`),
    list.length ? el("div", { class: "grid" }, list.map((p) => productCard(s, p))) : el("p", { class: "lead" }, "No products in this category yet."));
  const prev = cats[i - 1], next = cats[i + 1];
  root.append(el("div", { class: "pager" },
    prev ? el("a", { class: "btn sec", href: catLink(prev) }, "← " + prev.name) : el("span"),
    next ? el("a", { class: "btn sec", href: catLink(next) }, next.name + " →") : el("span")));
  reveal(root);
}

// Fade-and-rise animation as elements scroll into view (skipped for reduced-motion users).
function reveal(root) {
  const items = root.querySelectorAll(".card, .stats > div, .shopimg, .chip, .pager");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  items.forEach((n, i) => { n.classList.add("reveal"); n.style.transitionDelay = Math.min(i % 6, 5) * 60 + "ms"; io.observe(n); });
}

(async function init() {
  let data;
  try { data = await (await fetch("/api/site")).json(); } catch { return; }
  const { settings: s, categories: cats, products: prods } = data;

  document.querySelectorAll("[data-s]").forEach((n) => { n.textContent = s[n.dataset.s] || ""; });
  document.querySelectorAll(".logo").forEach((n) => n.replaceChildren(
    s.logo ? el("img", { src: "/" + s.logo, alt: "", class: "logo-img" }) : null,
    el("div", {}, s.shopName, el("span", {}, s.tagline))));
  document.querySelectorAll("[data-img]").forEach((i) => { const v = s[i.dataset.img]; if (v) i.src = "/" + v; else i.remove(); });
  renderFooter(s);

  const home = document.getElementById("home-cats");
  if (home) {
    home.replaceChildren(...cats.map((c) => el("a", { class: "card", href: "category.html?c=" + encodeURIComponent(c.id), style: "color:inherit" },
      el("div", { class: "icon" }, c.icon), el("h3", {}, c.name),
      el("p", { class: "muted" }, prods.filter((p) => p.categoryId === c.id).slice(0, 4).map((p) => p.name).join(", ")))));
  }
  const stat = document.getElementById("stat-cats"); if (stat) stat.textContent = cats.length;
  const stat2 = document.getElementById("stat-prods"); if (stat2) stat2.textContent = prods.length;

  const rev = document.getElementById("reviews");
  if (rev) rev.replaceChildren(...(s.reviews || []).map((r) => el("div", { class: "card" }, el("p", {}, "“" + r + "”"))));

  const br = document.getElementById("brands-root");
  if (br) br.replaceChildren(...(s.brands || []).map((b) => el("span", { class: "chip" }, b)));

  const catLink = (c) => "category.html?c=" + encodeURIComponent(c.id);
  const catGrid = document.getElementById("cat-grid");
  if (catGrid) renderCategoryIndex(s, cats, prods, catGrid, catLink);
  const one = document.getElementById("cat-products");
  if (one) renderCategoryPage(s, cats, prods, one, catLink);

  const map = document.getElementById("map");
  if (map && s.mapQuery) map.src = "https://www.google.com/maps?q=" + encodeURIComponent(s.mapQuery) + "&z=17&output=embed";
  const dir = document.getElementById("directions");
  if (dir && s.mapQuery) dir.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.mapQuery);
  document.querySelectorAll("[data-tel]").forEach((a) => {
    const v = s[a.dataset.tel]; if (v) { a.href = "tel:+91" + digits(v).slice(-10); a.textContent = v; } else a.remove();
  });
  const ig = document.getElementById("ig-link"); if (ig && s.instagram) ig.href = s.instagram;
  reveal(document);
})();

const form = document.querySelector("#contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const text = `Hello, I am ${f.get("name")} (${f.get("contact")}). ${f.get("message")}`;
    fetch("/api/site").then((r) => r.json()).then(({ settings }) => {
      window.open("https://wa.me/" + digits(settings.whatsapp) + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    document.querySelector(".form-msg").textContent = "Opening WhatsApp with your enquiry…";
    form.reset();
  });
}
