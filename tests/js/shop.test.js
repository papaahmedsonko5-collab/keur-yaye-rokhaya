// Tests du catalogue public (products.js) et du panier / messages WhatsApp (shop.js).
// Lancement : node --test tests/js/   (Node 18+, aucune dépendance)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
// Objets créés dans le bac à sable vm : comparés après copie JSON (autre « realm »).
const simple = (x) => JSON.parse(JSON.stringify(x));
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RACINE = path.join(__dirname, "..", "..");

// Bac à sable minimal : window, localStorage, événements, et la partie de KYR (site.js) utilisée par shop.js.
function bac(lignesSupabase) {
  const stockage = new Map();
  const fenetre = {
    addEventListener() {}, dispatchEvent() {},
    KYR_SUPABASE: {
      from(table) {
        const r = { data: lignesSupabase[table] || [], error: null };
        const q = { select() { return q; }, eq() { return Promise.resolve(r); } };
        return q;
      }
    }
  };
  fenetre.window = fenetre;
  fenetre.KYR = {
    CLE_PANIER: "kyr_panier_v1",
    nbPanier() { return JSON.parse(stockage.get("kyr_panier_v1") || "[]").reduce((n, l) => n + l.q, 0); },
    fcfa(n) { return n.toLocaleString("fr-FR") + " FCFA"; },
    slug(nom) { return String(nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  };
  const ctx = vm.createContext({
    window: fenetre, KYR: fenetre.KYR, Map, Promise, Number, Math, JSON, String, Array, Object,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    localStorage: {
      getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
      setItem: (k, v) => stockage.set(k, String(v))
    }
  });
  for (const f of ["products.js", "shop.js"]) vm.runInContext(fs.readFileSync(path.join(RACINE, f), "utf8"), ctx, { filename: f });
  return { fenetre, stockage, shop: fenetre.KYR.shop };
}

const CATALOGUE = {
  products: [
    { id: "p1", brand_id: "b1", category_id: "c1", name: "iPhone 15", slug: "iphone-15", description: "", image_url: "iphone-15.webp", is_active: true },
    { id: "p2", brand_id: "b1", category_id: "c1", name: "iPhone 17 Pro", slug: "iphone-17-pro", description: "", image_url: "", is_active: true },
    { id: "p3", brand_id: "b1", category_id: "c1", name: "Ancien", slug: "ancien", description: "", image_url: "", is_active: false }
  ],
  product_variants: [
    { id: "v1", product_id: "p1", capacity: "128 Go", color: "Noir", price: 450000, is_active: true, sim_type: null, condition_label: null },
    { id: "v2", product_id: "p1", capacity: "256 Go", color: "Noir", price: "520000", is_active: true, sim_type: null, condition_label: null },
    { id: "v3", product_id: "p1", capacity: "512 Go", color: "Noir", price: 0, is_active: true, sim_type: null, condition_label: null },
    { id: "v4", product_id: "p1", capacity: "1 To", color: "Noir", price: 900000, is_active: false, sim_type: null, condition_label: null },
    { id: "v5", product_id: "p2", capacity: "256 Go", color: "Argent", price: null, is_active: true, sim_type: null, condition_label: null }
  ],
  brands: [{ id: "b1", name: "Apple", is_active: true }],
  categories: [{ id: "c1", name: "iPhone", is_active: true }]
};

async function pret() {
  const b = bac(CATALOGUE);
  await b.fenetre.KYR_PRODUCTS_READY;
  return b;
}

test("le catalogue public ne garde que les produits et variantes actifs", async () => {
  const { fenetre } = await pret();
  assert.deepEqual(simple(fenetre.PRODUCTS.map((p) => p.slug)), ["iphone-15", "iphone-17-pro"]);
  const p = fenetre.PRODUCTS[0];
  assert.deepEqual(simple(p.variants.map((v) => v.id)), ["v1", "v2", "v3"]);
  assert.equal(p.marque, "Apple");
});

test("un prix nul, négatif ou absent devient « Sur devis », jamais 0 FCFA", async () => {
  const { fenetre, shop } = await pret();
  const [p15, p17] = fenetre.PRODUCTS;
  assert.equal(p15.variants.find((v) => v.id === "v3").price, null);
  assert.equal(p15.variants.find((v) => v.id === "v2").price, 520000);   // texte converti en nombre
  assert.equal(p15.prix, 450000);
  assert.equal(p17.prix, null);
  assert.equal(shop.prixCarte(p17), "Sur devis");
});

test("le prix vient de la variante exacte du catalogue, pas du panier", async () => {
  const { stockage, shop } = await pret();
  // Panier modifié à la main : prix et variante falsifiés.
  stockage.set("kyr_panier_v1", JSON.stringify([{ id: "iphone-15", v: { stockage: "256 Go", couleur: "Noir", price: 1, variant_id: "v1" }, q: 2 }]));
  const [l] = shop.lignes();
  assert.equal(l.varianteIndisponible, false);
  assert.equal(l.v.variant_id, "v2");           // variant_id falsifié ignoré : variante recalculée depuis les options
  assert.equal(l.unitaire, 520000);
  assert.equal(l.sousTotal, 1040000);
});

test("variante inactive ou inconnue refusée à l'ajout", async () => {
  const { shop } = await pret();
  assert.deepEqual(simple(shop.ajouter("iphone-15", { stockage: "1 To", couleur: "Noir" }, 1)), { ok: false, raison: "variante" });
  assert.deepEqual(simple(shop.ajouter("inconnu", {}, 1)), { ok: false, raison: "produit" });
  assert.equal(shop.ajouter("iphone-15", { stockage: "128 Go", couleur: "Noir" }, 1).ok, true);
});

test("quantités et nombre de lignes plafonnés", async () => {
  const { stockage, shop } = await pret();
  shop.ajouter("iphone-15", { stockage: "128 Go", couleur: "Noir" }, 999);
  assert.equal(shop.lignes()[0].q, shop.MAX_QTE);
  stockage.set("kyr_panier_v1", JSON.stringify(Array.from({ length: 50 }, () => ({ id: "x", v: {}, q: 1 }))));
  assert.equal(shop.lignes().length, 20);
  stockage.set("kyr_panier_v1", "pas du JSON");
  assert.equal(shop.lignes().length, 0);
});

test("total donné seulement si toutes les lignes ont un prix", async () => {
  const { shop } = await pret();
  shop.ajouter("iphone-15", { stockage: "128 Go", couleur: "Noir" }, 1);
  let t = shop.totaux(shop.lignes());
  assert.equal(t.complet, true);
  assert.equal(t.sousTotal, 450000);
  shop.ajouter("iphone-17-pro", { stockage: "256 Go", couleur: "Argent" }, 1);
  t = shop.totaux(shop.lignes());
  assert.equal(t.complet, false);
  assert.equal(t.nbSurDevis, 1);
});

test("message WhatsApp de commande : produits, options, prix et total", async () => {
  const { shop } = await pret();
  shop.ajouter("iphone-15", { stockage: "128 Go", couleur: "Noir" }, 2);
  shop.ajouter("iphone-17-pro", { stockage: "256 Go", couleur: "Argent" }, 1);
  const m = shop.messageCommande(shop.lignes());
  assert.match(m, /^Bonjour Keur Yaye Rokhaya,/);
  assert.match(m, /1\. iPhone 15\n {3}- 128 Go\n {3}- Noir\n {3}- Quantité : 2/);
  assert.match(m, /2\. iPhone 17 Pro[\s\S]*Prix : Sur devis/);
  assert.match(m, /Total : prix à confirmer/);
  assert.match(m, /Merci de me confirmer le prix\.$/);
  assert.doesNotMatch(m, /v1|v5|IMEI|undefined|null|NaN/);
});

test("message de demande de prix pour une variante sur devis", async () => {
  const { fenetre, shop } = await pret();
  const m = shop.messageDevis(fenetre.PRODUCTS[1], { stockage: "256 Go", couleur: "Argent" });
  assert.equal(m, "Bonjour Keur Yaye Rokhaya, je souhaite connaître le prix du iPhone 17 Pro en 256 Go, couleur Argent.");
});
