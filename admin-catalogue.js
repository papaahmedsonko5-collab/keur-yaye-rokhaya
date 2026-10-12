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

  /* ---------- Photo du produit : envoi vers le stockage Supabase (bucket public « product-images ») ---------- */
  var DOSSIER_PHOTOS = "product-images";
  var PHOTO_MAX_OCTETS = 15 * 1024 * 1024;   // photo d'origine ; elle est réduite avant l'envoi
  var PHOTO_COTE_MAX = 1600;

  // Réduit la photo (1600 px max) et la convertit en WebP (JPEG si le navigateur ne sait pas) : légère, rapide à charger, orientation respectée.
  async function preparerPhoto(fichier) {
    if (!fichier || !/^image\/(jpeg|png|webp)$/.test(fichier.type)) throw new Error("Format non accepté : choisissez une photo JPG, PNG ou WebP.");
    if (fichier.size > PHOTO_MAX_OCTETS) throw new Error("Photo trop lourde (15 Mo maximum).");
    var image;
    try { image = await createImageBitmap(fichier); } catch (e) { throw new Error("Cette photo ne peut pas être lue. Essayez une autre image."); }
    var ratio = Math.min(1, PHOTO_COTE_MAX / Math.max(image.width, image.height));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    var ctx = canvas.getContext("2d");
    function versBlob(type, qualite) { return new Promise(function (ok) { canvas.toBlob(ok, type, qualite); }); }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    var blob = await versBlob("image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") {
      ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await versBlob("image/jpeg", 0.88);
    }
    if (!blob) throw new Error("Impossible de préparer la photo.");
    return blob;
  }

  function messagePhoto(e) {
    var brut = String((e && (e.message || e.error)) || ""), statut = String((e && (e.statusCode || e.status)) || "");
    if (/Format non accepté|trop lourde|ne peut pas être lue|Impossible de préparer/.test(brut)) return brut;
    if (/Bucket not found/i.test(brut)) return "Le stockage des photos n’est pas encore activé. Contactez le support.";
    if (/row-level security|unauthorized|not allowed/i.test(brut) || statut === "403" || statut === "401") return "Envoi refusé : seul le propriétaire, connecté avec la double authentification, peut ajouter des photos.";
    if (/exceeded|too large|payload/i.test(brut) || statut === "413") return "Photo trop lourde pour le serveur.";
    if (/mime|type/i.test(brut) && /not supported|not allowed|invalid/i.test(brut)) return "Format non accepté par le serveur.";
    return "L’envoi de la photo a échoué. Vérifiez la connexion puis réessayez.";
  }

  function champPhoto(form, valeur) {
    var url = champ(form, "image_url", "Adresse de la photo (remplie automatiquement après l’envoi)", valeur, "text");
    var id = "adm-photo-" + Math.random().toString(36).slice(2, 8);
    var fichier = document.createElement("input");
    fichier.type = "file"; fichier.id = id; fichier.className = "adm-champ"; fichier.accept = "image/jpeg,image/png,image/webp";
    var etat = ui.el("p", { class: "adm-note", "aria-live": "polite" });
    var apercu = document.createElement("img");
    apercu.className = "adm-apercu-photo"; apercu.alt = "Aperçu de la photo"; apercu.hidden = true;
    apercu.addEventListener("error", function () { apercu.hidden = true; });
    function majApercu() {
      var v = url.value.trim();
      if (v && !/^(javascript|data):/i.test(v)) { apercu.src = v; apercu.hidden = false; } else { apercu.removeAttribute("src"); apercu.hidden = true; }
    }
    function actions(bloquer) { Array.prototype.forEach.call(document.querySelectorAll("#adm-dialog-actions button"), function (b) { b.disabled = bloquer; }); }
    url.addEventListener("change", majApercu);
    fichier.addEventListener("change", async function () {
      var f = fichier.files && fichier.files[0];
      if (!f) return;
      fichier.disabled = true; actions(true); etat.textContent = "Préparation de la photo…";
      try {
        var blob = await preparerPhoto(f);
        etat.textContent = "Envoi de la photo…";
        var ext = blob.type === "image/webp" ? "webp" : "jpg";
        var chemin = "products/" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "." + ext;
        var depot = window.KYR_SUPABASE.storage.from(DOSSIER_PHOTOS);
        var r = await depot.upload(chemin, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
        if (r.error) throw r.error;
        url.value = depot.getPublicUrl(chemin).data.publicUrl;
        majApercu();
        etat.textContent = "Photo envoyée. Cliquez sur « Enregistrer » pour l’associer au produit.";
      } catch (e) { etat.textContent = messagePhoto(e); }
      finally { fichier.value = ""; fichier.disabled = false; actions(false); }
    });
    form.appendChild(ui.el("label", { for: id, text: "Envoyer une photo (JPG, PNG ou WebP)" }));
    form.appendChild(fichier); form.appendChild(etat); form.appendChild(apercu);
    majApercu();
    return url;
  }

  function champsVariante(zone, v) {
    var bloc = document.createElement("fieldset"); bloc.className = "adm-bloc";
    bloc.dataset.variantId = v && v.id ? v.id : "";
    var legend = document.createElement("legend"); legend.textContent = v && v.id ? "Variante existante" : "Nouvelle variante"; bloc.appendChild(legend);
    [
      ["sku", "SKU", ""], ["capacity", "Capacité", ""], ["color", "Couleur", ""],
      ["price", "Prix (laisser vide si non défini)", "number"],
      ["compare_at_price", "Ancien prix barré, pour une promo (facultatif : laisser vide hors promo)", "number"],
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
      if (v.compare_at_price !== null && (v.price === null || v.compare_at_price <= v.price)) throw new Error("Pour une promo, l’ancien prix barré doit être supérieur au prix. Videz-le s’il n’y a pas de promo.");
      return v;
    });
  }

  function slugifier(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // Traduit les erreurs connues de l'enregistrement en messages clairs. Aucune donnée interne n'est affichée.
  function messageCatalogue(e) {
    var code = String((e && e.code) || ""), msg = String((e && e.message) || "");
    if (code === "23505") {
      if (msg.indexOf("products_slug_key") !== -1) return "Ce slug est déjà utilisé par un autre produit. Choisissez-en un autre.";
      if (msg.indexOf("product_variants_sku_key") !== -1) return "Ce SKU est déjà utilisé par une autre variante.";
      if (msg.indexOf("product_variants_unique_active_options") !== -1) return "Une variante active avec les mêmes options existe déjà.";
      return "Cette valeur existe déjà et doit être unique.";
    }
    if (code === "22023" && msg) return msg;
    if (code === "22P02") return "Un identifiant n’est pas valide. Fermez le formulaire, actualisez la liste puis réessayez.";
    // Message de contrôle écrit par ce formulaire (Error simple, sans code serveur ni statut réseau) : affiché tel quel.
    if (e && e.name === "Error" && !e.code && !e.status && msg) return msg;
    return null;
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
      champPhoto(form, product && product.image_url);
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
          var precis = messageCatalogue(e);
          if (precis) {
            erreur.textContent = "";
            erreur.appendChild(ui.el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: precis }));
            return;
          }
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
  /* ---------- Stock : quantités par variante, modifiables par le propriétaire (kyr_set_stock) ---------- */
  function texteServeur(e) {
    var brut = String((e && e.message) || "");
    var m = /KYR_(?:INVALID|NOT_FOUND)[A-Z_]*:\s*([^\n]{3,200})/.exec(brut);
    return m ? m[1].trim() : ui.messageErreur(e);
  }
  function nomVariante(l) { return l.variante && l.variante !== "—" ? l.produit + " (" + l.variante + ")" : l.produit; }

  async function lireStock() {
    var sb = window.KYR_SUPABASE;
    var r = await Promise.all([
      sb.from("inventory").select("variant_id,quantity,reserved_quantity,updated_at").limit(1000),
      sb.from("product_variants").select("id,product_id,sku,capacity,color,sim_type,condition_label").limit(1000),
      sb.from("products").select("id,name").limit(1000)
    ]);
    r.forEach(function (x) { if (x.error) throw x.error; });
    var variantes = {}, produits = {};
    (r[1].data || []).forEach(function (v) { variantes[v.id] = v; });
    (r[2].data || []).forEach(function (p) { produits[p.id] = p; });
    return (r[0].data || []).map(function (i) {
      var v = variantes[i.variant_id] || {}, p = produits[v.product_id] || {};
      var q = Number(i.quantity) || 0, res = Number(i.reserved_quantity) || 0;
      return {
        produit: p.name || "—",
        variante: [v.capacity, v.color, v.condition_label, v.sim_type].filter(Boolean).join(" · ") || "—",
        sku: v.sku || "", quantity: q, reserved_quantity: res, disponible: Math.max(0, q - res),
        updated_at: i.updated_at, variant_id: i.variant_id
      };
    }).sort(function (a, b) { return (a.produit + a.variante).localeCompare(b.produit + b.variante, "fr"); });
  }

  function dialogueStock(ligne, rafraichir) {
    var zone = ui.el("div");
    zone.appendChild(ui.el("p", { text: nomVariante(ligne) }));
    zone.appendChild(ui.el("p", { class: "adm-note", text: "Quantité actuelle : " + ligne.quantity + " · Réservé : " + ligne.reserved_quantity + ". Saisissez la quantité réellement comptée en boutique." }));
    var q = ui.el("input", { type: "number", class: "adm-champ", id: "adm-stock-qte", min: "0", step: "1", inputmode: "numeric" });
    q.value = String(ligne.quantity);
    var motif = ui.el("input", { type: "text", class: "adm-champ", id: "adm-stock-motif", maxlength: "200", placeholder: "Ex. : réception fournisseur, inventaire" });
    zone.appendChild(ui.el("label", { for: "adm-stock-qte", text: "Nouvelle quantité" })); zone.appendChild(q);
    zone.appendChild(ui.el("label", { for: "adm-stock-motif", text: "Motif (facultatif)" })); zone.appendChild(motif);
    var erreur = ui.el("div", { "aria-live": "polite" });
    zone.appendChild(erreur);
    var envoi = false;
    function bloquer(oui) { Array.prototype.forEach.call(document.querySelectorAll("#adm-dialog-actions button"), function (b) { b.disabled = oui; }); }
    async function enregistrer() {
      if (envoi) return;
      erreur.textContent = "";
      var v = q.value.trim(), n = Number(v), msg = null;
      if (!/^[0-9]{1,7}$/.test(v) || n > 1000000) msg = "La quantité doit être un entier entre 0 et 1 000 000.";
      else if (n < ligne.reserved_quantity) msg = "La quantité ne peut pas être inférieure au stock réservé (" + ligne.reserved_quantity + ").";
      if (msg) { erreur.appendChild(ui.el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: msg })); return; }
      envoi = true; bloquer(true);
      try {
        var r = await window.KYR_SUPABASE.rpc("kyr_set_stock", { p_variant_id: ligne.variant_id, p_quantity: n, p_reason: motif.value.trim() || null });
        if (r.error) throw r.error;
        document.getElementById("adm-dialog").close();
        ui.toast(n === ligne.quantity ? "Quantité inchangée." : "Stock mis à jour : " + n + ".", n === ligne.quantity ? "info" : "succes");
        rafraichir();
      } catch (e) {
        var k = null;
        if (window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur) { try { k = await window.KYR_ADMIN.reagirErreur(e); } catch (x) { k = null; } }
        if (k !== "UNAUTHENTICATED" && k !== "MFA_REQUIRED") {
          erreur.textContent = "";
          erreur.appendChild(ui.el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: texteServeur(e) }));
        }
      } finally { envoi = false; bloquer(false); }
    }
    ui.dialogue({ titre: "Modifier le stock", corps: zone, actions: [{ libelle: "Enregistrer", principal: true, garder: true, clic: enregistrer }, { libelle: "Fermer" }] });
  }

  function stock(corps, ctx) {
    var proprietaire = ctx.role === "owner", lignes = [];
    corps.textContent = "";
    corps.appendChild(ui.el("p", { class: "adm-intro", text: proprietaire
      ? "Quantité en boutique de chaque variante. Disponible = quantité moins réservé. « Modifier » enregistre la quantité comptée."
      : "Quantité en boutique de chaque variante (consultation). Seul le propriétaire modifie le stock." }));
    var filtre = ui.el("input", { type: "search", class: "adm-champ", placeholder: "Produit, capacité, couleur ou référence", "aria-label": "Filtrer le stock", maxlength: "60" });
    corps.appendChild(ui.el("div", { class: "adm-barre-outils" }, [ui.el("label", { class: "adm-etiquette" }, [ui.el("span", { text: "Filtrer" }), filtre])]));
    var zone = ui.el("div", { class: "adm-resultat", "aria-live": "polite" });
    corps.appendChild(zone);
    function dessiner() {
      var t = filtre.value.trim().toLowerCase();
      var vues = lignes.filter(function (l) { return !t || (l.produit + " " + l.variante + " " + l.sku).toLowerCase().indexOf(t) !== -1; });
      zone.textContent = "";
      if (vues.length === 0) { ui.vide(zone, lignes.length ? "Aucune variante ne correspond." : "Aucune ligne de stock."); return; }
      zone.appendChild(ui.tableau(vues, {
        colonnes: ["produit", "variante", "sku", "quantity", "reserved_quantity", "disponible", "updated_at"], masquer: ["variant_id"],
        libelles: { produit: "Produit", variante: "Variante", sku: "Référence", quantity: "Quantité", reserved_quantity: "Réservé", disponible: "Disponible", updated_at: "Mis à jour le" },
        legende: "Stock par variante",
        actions: proprietaire ? [{ libelle: "Modifier", clic: function (l) { dialogueStock(l, charge); } }] : null
      }));
    }
    function charge() { ui.charger(ctx, zone, lireStock, function (res) { lignes = res; dessiner(); }); }
    filtre.addEventListener("input", dessiner);
    charge();
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

    stock: stock,

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
