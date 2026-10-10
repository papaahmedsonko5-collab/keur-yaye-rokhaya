/* Administration — Catalogue et Stock
   Lecture et édition catalogue. Source de vérité : Supabase + RLS.
   Les contrôles d'accès et l'AAL2 restent imposés côté serveur.
*/

(function () {
  "use strict";

  const ui = window.KYR_ADMIN_UI;

  if (!ui) {
    console.error("KYR_ADMIN_UI introuvable.");
    return;
  }

  function vue(table, titre, intro, options) {
    options = options || {};

    return function (corps, ctx) {
      ui.listeTable(corps, ctx, {
        table: table,
        titre: titre,
        intro: intro,
        taille: options.taille || 25,
        tri: options.tri,
        colonnes: options.colonnes,
        masquer: options.masquer || [],
        libelles: options.libelles || {},
        legende: options.legende || titre
      });
    };
  }

  function chargerVariantes(productId) {
    return window.KYR_SUPABASE.from("product_variants")
      .select("id,product_id,sku,capacity,color,price,compare_at_price,is_active,sim_type,condition_label")
      .eq("product_id", productId);
  }

  function champ(form, cle, libelle, valeur, type) {
    var id = "adm-cat-" + cle + "-" + Math.random().toString(36).slice(2, 8);
    var l = ui.el("label", { for: id, text: libelle });
    var i = document.createElement(type === "textarea" ? "textarea" : "input");
    i.id = id; i.name = cle; i.className = "adm-champ";
    if (type !== "textarea") i.type = type || "text";
    if (type === "checkbox") i.checked = valeur === true;
    else i.value = valeur === null || valeur === undefined ? "" : String(valeur);
    if (cle === "price" || cle === "compare_at_price") { i.inputMode = "decimal"; i.step = "any"; }
    form.appendChild(l); form.appendChild(i);
    return i;
  }

  function selecteur(form, cle, libelle, choix, valeur) {
    var id = "adm-cat-" + cle + "-" + Math.random().toString(36).slice(2, 8);
    var l = ui.el("label", { for: id, text: libelle });
    var s = document.createElement("select"); s.id = id; s.name = cle; s.className = "adm-champ";
    [["", "Non renseigné"]].concat(choix.map(function (x) { return [x.id, x.name]; })).forEach(function (o) {
      var option = document.createElement("option"); option.value = o[0]; option.textContent = o[1];
      if (String(valeur || "") === String(o[0])) option.selected = true;
      s.appendChild(option);
    });
    form.appendChild(l); form.appendChild(s);
    return s;
  }

  function caseACocher(form, cle, libelle, checked) {
    var ligne = ui.el("label", { class: "adm-etiquette" });
    var input = document.createElement("input"); input.type = "checkbox"; input.name = cle; input.checked = checked === true;
    ligne.appendChild(input); ligne.appendChild(document.createTextNode(" " + libelle)); form.appendChild(ligne);
    return input;
  }

  function champsVariante(zone, v) {
    var bloc = document.createElement("fieldset"); bloc.className = "adm-bloc";
    bloc.dataset.variantId = v && v.id ? v.id : "";
    var legend = document.createElement("legend"); legend.textContent = v && v.id ? "Variante existante" : "Nouvelle variante"; bloc.appendChild(legend);
    [
      ["sku", "SKU", ""], ["capacity", "Capacité", ""], ["color", "Couleur", ""],
      ["price", "Prix (laisser vide si non défini)", "number"],
      ["compare_at_price", "Prix comparatif (facultatif)", "number"],
      ["sim_type", "Type de SIM", ""], ["condition_label", "État", ""]
    ].forEach(function (d) {
      var wrap = document.createElement("div");
      var i = document.createElement("input"); i.name = d[0]; i.className = "adm-champ"; i.type = d[2] === "number" ? "number" : "text";
      if (d[2] === "number") { i.min = "0.01"; i.step = "any"; i.inputMode = "decimal"; }
      var id = "adm-variant-" + d[0] + "-" + Math.random().toString(36).slice(2, 8); i.id = id;
      i.value = v && v[d[0]] !== null && v[d[0]] !== undefined ? String(v[d[0]]) : "";
      wrap.appendChild(ui.el("label", { for: id, text: d[1] })); wrap.appendChild(i); bloc.appendChild(wrap);
    });
    var actif = document.createElement("input"); actif.type = "checkbox"; actif.name = "is_active"; actif.checked = !v || v.is_active !== false;
    var actifLabel = ui.el("label", { class: "adm-etiquette" }); actifLabel.appendChild(actif); actifLabel.appendChild(document.createTextNode(" Variante active")); bloc.appendChild(actifLabel);
    zone.appendChild(bloc);
  }

  function lireVariantesForm(form) {
    return Array.prototype.map.call(form.querySelectorAll("fieldset[data-variant-id]"), function (bloc) {
      var v = { id: bloc.dataset.variantId || null };
      ["sku", "capacity", "color", "price", "compare_at_price", "sim_type", "condition_label"].forEach(function (k) {
        var value = bloc.querySelector('[name="' + k + '"]').value.trim();
        if (k === "price" || k === "compare_at_price") {
          if (!value) v[k] = null;
          else {
            var n = Number(value);
            if (!Number.isFinite(n) || n <= 0) throw new Error("Un prix renseigné doit être un nombre positif. Laissez le champ vide si le prix n’est pas défini.");
            v[k] = n;
          }
        } else v[k] = value || null;
      });
      v.is_active = bloc.querySelector('[name="is_active"]').checked;
      return v;
    });
  }

  function slugifier(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  async function ouvrirEditeur(product, ctx, rafraichir) {
    var zone = ui.el("div");
    ui.chargement(zone);
    ui.dialogue({ titre: product ? "Modifier le produit" : "Nouveau produit", corps: zone, actions: [{ libelle: "Fermer" }] });
    try {
      var refs = await Promise.all([
        window.KYR_SUPABASE.from("brands").select("id,name").order("name"),
        window.KYR_SUPABASE.from("categories").select("id,name").order("name"),
        product ? chargerVariantes(product.id) : Promise.resolve({ data: [], error: null })
      ]);
      refs.forEach(function (r) { if (r.error) throw r.error; });
      if (!ctx.actif()) return;
      zone.textContent = "";
      var form = document.createElement("form"); form.noValidate = true;
      var name = champ(form, "name", "Nom du produit", product && product.name, "text");
      var slug = champ(form, "slug", "Slug stable", product && product.slug, "text");
      if (product) slug.readOnly = true;
      var slugManuel = !!product;
      slug.addEventListener("input", function () { slugManuel = true; });
      name.addEventListener("input", function () { if (!slugManuel) slug.value = slugifier(name.value); });
      selecteur(form, "brand_id", "Marque", refs[0].data || [], product && product.brand_id);
      selecteur(form, "category_id", "Catégorie", refs[1].data || [], product && product.category_id);
      champ(form, "description", "Description", product && product.description, "textarea");
      champ(form, "image_url", "Image (chemin ou URL existante ; aucun téléversement configuré)", product && product.image_url, "text");
      caseACocher(form, "is_active", "Produit actif", !product || product.is_active === true);
      caseACocher(form, "is_featured", "Produit mis en avant", product && product.is_featured === true);
      var zoneVariants = ui.el("div", { class: "adm-pile" });
      (refs[2].data || []).forEach(function (v) { champsVariante(zoneVariants, v); });
      var ajouter = ui.el("button", { type: "button", class: "adm-btn adm-btn-secondaire", text: "Ajouter une variante" });
      ajouter.addEventListener("click", function () { champsVariante(zoneVariants, null); });
      var erreur = ui.el("div", { "aria-live": "polite" });
      form.appendChild(ui.el("h3", { text: "Variantes" })); form.appendChild(zoneVariants); form.appendChild(ajouter); form.appendChild(erreur);
      zone.appendChild(form);
      var envoi = false, resultatInconnu = false;
      async function enregistrer() {
        if (envoi || resultatInconnu || !ctx.actif()) return;
        envoi = true;
        const boutons = document.querySelectorAll("#adm-dialog-actions button"); boutons.forEach(function (b) { b.disabled = true; });
        try {
          var fd = new FormData(form);
          var nom = String(fd.get("name") || "").trim(), identifiant = String(fd.get("slug") || "").trim();
          if (!nom || !identifiant || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identifiant)) throw new Error("Le nom et un slug valide sont obligatoires.");
          var image = String(fd.get("image_url") || "").trim();
          if (image && /^(javascript|data):/i.test(image)) throw new Error("Le chemin d’image doit être une URL ou un fichier sûr.");
          var payload = {
            id: product ? product.id : null, name: nom, slug: identifiant,
            brand_id: fd.get("brand_id") || null, category_id: fd.get("category_id") || null,
            description: String(fd.get("description") || "").trim() || null, image_url: image || null,
            is_active: form.querySelector('[name="is_active"]').checked,
            is_featured: form.querySelector('[name="is_featured"]').checked
          };
          var r = await window.KYR_SUPABASE.rpc("kyr_save_catalogue_product", { p_product: payload, p_variants: lireVariantesForm(form) });
          if (r.error) throw r.error;
          if (!r.data) throw new Error("Le serveur n’a pas confirmé l’enregistrement du produit.");
          ui.toast("Produit et variantes enregistrés.", "succes");
          document.getElementById("adm-dialog").close();
          rafraichir();
        } catch (e) {
          var classe = window.KYR_ADMIN && window.KYR_ADMIN.classer ? window.KYR_ADMIN.classer(e) : "INCONNUE";
          if (classe === "RESEAU" || (e && (Number(e.status) >= 500 || e.name === "AbortError"))) {
            resultatInconnu = true;
            await ui.gererErreur(erreur, e, null);
            erreur.appendChild(ui.el("p", { class: "adm-note", text: "Résultat inconnu : le serveur a peut-être enregistré l’opération avant la coupure. Ne la renvoyez pas. Fermez et actualisez la liste pour vérifier l’état courant." }));
            erreur.appendChild(ui.el("button", { type: "button", class: "adm-btn adm-btn-secondaire", text: "Fermer et actualiser la liste", clic: function () {
              document.getElementById("adm-dialog").close();
              if (ctx.actif()) rafraichir();
            } }));
          } else {
            await ui.gererErreur(erreur, e, function () { form.requestSubmit(); });
          }
        } finally {
          envoi = false;
          boutons.forEach(function (b) { b.disabled = resultatInconnu && b.textContent.trim() === "Enregistrer"; });
        }
      }
      form.addEventListener("submit", function (e) { e.preventDefault(); enregistrer(); });
      ui.dialogue({ titre: product ? "Modifier le produit" : "Nouveau produit", corps: zone, actions: [
        { libelle: "Enregistrer", principal: true, garder: true, clic: function () { form.requestSubmit(); } },
        { libelle: "Fermer" }
      ] });
    } catch (e) {
      await ui.gererErreur(zone, e, function () { ouvrirEditeur(product, ctx, rafraichir); });
    }
  }

  function produits(corps, ctx) {
    function rendre() {
      corps.textContent = "";
      var liste = ui.el("div");
      if (ctx.role === "owner") {
        var creer = ui.el("button", { type: "button", class: "adm-btn adm-btn-primaire", text: "Ajouter un produit" });
        creer.addEventListener("click", function () { ouvrirEditeur(null, ctx, rendre); });
        corps.appendChild(creer);
      }
      corps.appendChild(liste);
      ui.listeTable(liste, ctx, {
        table: "products", titre: "Produits", taille: 25, tri: ["created_at"],
        intro: "Catalogue Supabase. Les écritures nécessitent la permission catalogue.manage et l’AAL2 côté serveur.",
        colonnes: ["id", "name", "slug", "brand_id", "category_id", "is_active", "created_at"], masquer: ["id"],
        libelles: { name: "Produit", slug: "Slug", brand_id: "Marque", category_id: "Catégorie", is_active: "Actif", created_at: "Créé le" },
        legende: "Produits du catalogue",
        actionsLigne: ctx.role === "owner" ? [
          { libelle: "Modifier", clic: function (l) { ouvrirEditeur(l, ctx, rendre); } },
          { libelle: "Désactiver", clic: async function (l) {
            if (l.is_active !== true) return;
            var ok = await ui.confirmer({ titre: "Désactiver le produit", message: "Le produit « " + l.name + " » ne sera plus affiché dans la boutique. Il ne sera pas supprimé.", libelle: "Désactiver", danger: true });
            if (!ok || !ctx.actif()) return;
            try {
              var r = await window.KYR_SUPABASE.rpc("kyr_deactivate_catalogue_product", { p_product_id: l.id });
              if (r.error) throw r.error;
              if (r.data !== true) {
                ui.toast("Désactivation non confirmée. Le produit est peut-être déjà inactif; actualisez la liste.", "erreur");
                rendre();
                return;
              }
              ui.toast("Produit désactivé.", "succes");
            } catch (e) {
              var classe = window.KYR_ADMIN && window.KYR_ADMIN.classer ? window.KYR_ADMIN.classer(e) : "INCONNUE";
              if (classe === "RESEAU" || (e && (Number(e.status) >= 500 || e.name === "AbortError"))) {
                try {
                  var etat = await window.KYR_SUPABASE.from("products").select("id,is_active").eq("id", l.id).maybeSingle();
                  if (etat.error || !etat.data) throw etat.error || new Error("État non retourné");
                  ui.toast(etat.data.is_active === false ? "État actuel confirmé : produit désactivé." : "État actuel confirmé : produit encore actif; aucune réussite annoncée.", "info");
                } catch (lecture) {
                  ui.toast("Résultat inconnu : la mise à jour a peut-être été enregistrée. La relecture a échoué; actualisez la liste.", "erreur");
                }
              } else {
                ui.toast(ui.messageErreur(e), "erreur");
              }
            }
            rendre();
          } }
        ] : [{ libelle: "Détails", clic: function (l) { ui.dialogue({ titre: "Produit", corps: ui.listeCles(l) }); } }]
      });
    }
    rendre();
  }
  ui.enregistrer("catalogue", {

    /* =========================
       PRODUITS
       ========================= */

    produits: produits,

    /* =========================
       VARIANTES
       ========================= */

    variantes: vue(
      "product_variants",
      "Variantes et capacités",
      "Variantes réellement enregistrées dans Supabase avec leurs capacités et leurs prix.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "product_id",
          "capacity",
          "color",
          "sku",
          "price",
          "compare_at_price",
          "is_active",
          "sim_type",
          "condition_label",
          "created_at"
        ],
        libelles: {
          id: "ID",
          product_id: "Produit",
          capacity: "Capacité",
          color: "Couleur",
          sku: "SKU",
          price: "Prix",
          compare_at_price: "Prix comparatif",
          is_active: "Actif",
          sim_type: "SIM",
          condition_label: "État",
          created_at: "Créé le"
        },
        legende: "Variantes et capacités"
      }
    ),

    /* =========================
       MARQUES
       ========================= */

    marques: vue(
      "brands",
      "Marques",
      "Marques enregistrées dans le catalogue Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "name",
          "slug",
          "created_at"
        ],
        libelles: {
          id: "ID",
          name: "Marque",
          slug: "Slug",
          created_at: "Créé le"
        },
        legende: "Marques"
      }
    ),

    /* =========================
       CATÉGORIES
       ========================= */

    categories: vue(
      "categories",
      "Catégories",
      "Catégories enregistrées dans le catalogue Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "name",
          "slug",
          "created_at"
        ],
        libelles: {
          id: "ID",
          name: "Catégorie",
          slug: "Slug",
          created_at: "Créé le"
        },
        legende: "Catégories"
      }
    ),

    /* =========================
       STOCK
       ========================= */

    stock: vue(
      "inventory",
      "Stock global",
      "Quantités de stock réellement enregistrées dans Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "product_variant_id",
          "quantity",
          "created_at",
          "updated_at"
        ],
        libelles: {
          id: "ID",
          product_variant_id: "Variante",
          quantity: "Quantité",
          created_at: "Créé le",
          updated_at: "Mis à jour le"
        },
        legende: "Stock global"
      }
    ),

    /* =========================
       INVENTAIRE / IMEI
       ========================= */

    imei: vue(
      "inventory_units",
      "Inventaire et IMEI",
      "Unités individuelles enregistrées dans Supabase lorsque le suivi par appareil est utilisé.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "inventory_id",
          "imei",
          "serial_number",
          "status",
          "created_at"
        ],
        libelles: {
          id: "ID",
          inventory_id: "Inventaire",
          imei: "IMEI",
          serial_number: "Numéro de série",
          status: "Statut",
          created_at: "Créé le"
        },
        legende: "Inventaire et IMEI"
      }
    )

  });

})();
