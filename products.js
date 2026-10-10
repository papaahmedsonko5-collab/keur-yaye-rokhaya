/* Catalogue public : Supabase est la source unique.
   Contrat conservé : window.PRODUCTS (nom, marque, categorie, prix, image, description, options).
   Cette lecture publique ne remplace jamais les contrôles RLS du serveur. */
(function () {
  "use strict";
  window.PRODUCTS = [];

  function liste(table, colonnes) {
    return window.KYR_SUPABASE.from(table).select(colonnes).eq("is_active", true);
  }
  function prix(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function texte(v) { return typeof v === "string" ? v : ""; }
  function noms(lignes, cle) {
    var vus = Object.create(null), resultat = [];
    lignes.forEach(function (v) {
      var nom = texte(v[cle]);
      if (nom && !vus[nom]) { vus[nom] = true; resultat.push(nom); }
    });
    return resultat;
  }
  function mapper(produits, variantes, marques, categories) {
    var marqueParId = new Map(marques.map(function (x) { return [x.id, x.name]; }));
    var categorieParId = new Map(categories.map(function (x) { return [x.id, x.name]; }));
    return produits.filter(function (p) { return p.is_active === true; }).map(function (p) {
      var vs = variantes.filter(function (v) { return v.product_id === p.id && v.is_active === true; });
      var options = {};
      var capacites = noms(vs, "capacity");
      if (capacites.length) options.stockages = capacites.map(function (capacity) {
        var prixCapacite = vs.filter(function (v) { return v.capacity === capacity; }).map(function (v) { return prix(v.price); }).filter(function (x) { return x !== null; });
        return prixCapacite.length ? { nom: capacity, prix: Math.min.apply(null, prixCapacite) } : capacity;
      });
      var couleurs = noms(vs, "color");
      if (couleurs.length) options.couleurs = couleurs.map(function (nom) { return { nom: nom }; });
      var etats = noms(vs, "condition_label");
      if (etats.length) options.etats = etats.map(function (nom) { return { nom: nom }; });
      var sims = noms(vs, "sim_type");
      if (sims.length) options.sims = sims.map(function (nom) { return { nom: nom }; });
      var prixConnus = vs.map(function (v) { return prix(v.price); }).filter(function (x) { return x !== null; });
      var pPublic = {
        id: p.id,
        slug: p.slug,
        nom: p.name,
        marque: marqueParId.get(p.brand_id) || "",
        categorie: categorieParId.get(p.category_id) || "",
        prix: prixConnus.length ? Math.min.apply(null, prixConnus) : null,
        image: p.image_url || "",
        description: texte(p.description),
        options: options,
        variants: vs.map(function (v) {
          return { id: v.id, capacity: texte(v.capacity), color: texte(v.color),
            condition: texte(v.condition_label), sim: texte(v.sim_type), price: prix(v.price) };
        })
      };
      if (p.created_at) pPublic.ajoute = String(p.created_at).slice(0, 10);
      return pPublic;
    });
  }
  async function charger() {
    if (!window.KYR_SUPABASE) throw new Error("Catalogue indisponible : connexion non initialisée.");
    var reponses = await Promise.all([
      liste("products", "id,brand_id,category_id,name,slug,description,image_url,is_active"),
      liste("product_variants", "id,product_id,capacity,color,price,is_active,sim_type,condition_label"),
      liste("brands", "id,name,is_active"),
      liste("categories", "id,name,is_active")
    ]);
    reponses.forEach(function (r) { if (r.error) throw r.error; });
    var produits = mapper(reponses[0].data || [], reponses[1].data || [], reponses[2].data || [], reponses[3].data || []);
    window.PRODUCTS = produits;
    window.dispatchEvent(new CustomEvent("kyr:catalogue-ready", { detail: { count: produits.length } }));
    return produits;
  }
  window.KYR_CATALOGUE = Object.freeze({ mapper: mapper, charger: charger });
  window.KYR_PRODUCTS_READY = charger();
  // Les consommateurs gèrent l'échec de façon explicite ; évite un rejet non traité si aucun widget n'est présent.
  window.KYR_PRODUCTS_READY.catch(function () {});
})();
