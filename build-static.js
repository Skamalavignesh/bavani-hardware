// Builds a static copy of the public site into docs/ (no server or admin panel),
// for hosting on GitHub Pages, Netlify, Vercel or any static host.
// Run: node build-static.js   – re-run it after changing products in the admin panel.
const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "docs");
const db = JSON.parse(fs.readFileSync(path.join(root, "data", "db.json"), "utf8"));

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), out, {
  recursive: true,
  filter: (src) => path.relative(path.join(root, "public"), src).split(path.sep)[0] !== "admin",
});

const cats = db.categories.filter((c) => c.visible);
const ids = new Set(cats.map((c) => c.id));
const site = { settings: db.settings, categories: cats, products: db.products.filter((p) => p.visible && ids.has(p.categoryId)) };
fs.mkdirSync(path.join(out, "data"), { recursive: true });
fs.writeFileSync(path.join(out, "data", "site.json"), JSON.stringify(site));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Built docs/: ${site.categories.length} categories, ${site.products.length} products`);
