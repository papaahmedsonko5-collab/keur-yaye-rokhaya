/*
  Boutique : recherche, filtres, tri et cartes produits.
  Tout est construit à partir de products.js : un filtre n'existe que si la donnée existe vraiment.
  Aucun produit, aucun prix, aucun état et aucun stock n'est inventé ici.
*/
(function () {
  "use strict";
  var cataloguePret = window.KYR_PRODUCTS_READY && typeof window.KYR_PRODUCTS_READY.then === "function"
    ? window.KYR_PRODUCTS_READY : Promise.reject(new Error("Chargement du catalogue manquant"));
  cataloguePret.then(function () {
  var S = KYR.shop, tous = S.produits();
  var grille = document.getElementById("grid");
  if (!grille) return;

  var el_ = function (id) { return document.getElementById(id); };
  var champRecherche = el_("recherche"), zoneCats = el_("cats"), panneau = el_("filtres-panel"), zoneChamps = el_("filtres-champs");
  var compteur = el_("compteur"), selTri = el_("tri"), vide = el_("vide"), erreurPrix = el_("erreur-prix"), actifs = el_("filtres-actifs");
  var collateur = (typeof Intl !== "undefined" && Intl.Collator) ? new Intl.Collator("fr", { numeric: true, sensitivity: "base" }) : { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } };

  function el(tag, cls, texte) { var n = document.createElement(tag); if (cls) n.className = cls; if (texte) n.textContent = texte; return n; }

  /* ---------- ce que le catalogue contient vraiment ---------- */
  var index = tous.map(function (p, i) { return { p: p, i: i, texte: S.texteRecherche(p), prix: S.prixListe(p), mini: S.prixMini(p) }; });
  function distincts(fn) {
    var vus = {}, liste = [];
    tous.forEach(function (p) { fn(p).forEach(function (v) { if (v && !vus[v]) { vus[v] = 1; liste.push(v); } }); });
    return liste;
  }
  function go(s) { var m = String(s).match(/^(\d+(?:[.,]\d+)?)\s*(go|to)$/i); return m ? parseFloat(m[1].replace(",", ".")) * (m[2].toLowerCase() === "to" ? 1000 : 1) : 0; }
  var categories = distincts(function (p) { return [p.categorie]; });
  var marques = distincts(function (p) { return [p.marque]; }).sort(collateur.compare);
  var capacites = distincts(S.stockages).sort(function (a, b) { return go(a) - go(b); });
  var couleurs = distincts(S.couleurs).sort(collateur.compare);
  // Un filtre « état » ou « disponibilité » n'est proposé que si TOUS les produits ont l'information.
  var tousOntEtat = tous.length > 0 && tous.every(function (p) { return p.options && p.options.etats && p.options.etats.length; });
  var etats = tousOntEtat ? distincts(function (p) { return p.options.etats.map(function (e) { return e.nom; }); }) : [];
  var tousOntDispo = tous.length > 0 && tous.every(function (p) { return p.disponibilite; });
  var dispos = tousOntDispo ? distincts(function (p) { return [p.disponibilite]; }) : [];
  var tousOntDate = tous.some(function (p) { return /^\d{4}-\d{2}-\d{2}$/.test(p.ajoute || ""); });
  var prixConnus = index.reduce(function (a, x) { return a.concat(x.prix); }, []);
  var prixMin = prixConnus.length ? Math.min.apply(null, prixConnus) : 0, prixMax = prixConnus.length ? Math.max.apply(null, prixConnus) : 0;

  /* ---------- état de la recherche (synchronisé avec l'adresse de la page) ---------- */
  var VIDE = { q: "", cat: "", marque: "", cap: "", couleur: "", etat: "", dispo: "", min: "", max: "", tri: "pertinence" };
  var etat = Object.assign({}, VIDE);
  var CLES = Object.keys(VIDE);
  function lireAdresse() {
    var a = new URLSearchParams(location.search);
    CLES.forEach(function (k) { if (a.has(k)) etat[k] = String(a.get(k)).slice(0, 80); });
    if (categories.indexOf(etat.cat) === -1) etat.cat = "";
    if (marques.indexOf(etat.marque) === -1) etat.marque = "";
    if (capacites.indexOf(etat.cap) === -1) etat.cap = "";
    if (couleurs.indexOf(etat.couleur) === -1) etat.couleur = "";
    if (etats.indexOf(etat.etat) === -1) etat.etat = "";
    if (dispos.indexOf(etat.dispo) === -1) etat.dispo = "";
    etat.min = /^\d+$/.test(etat.min) ? etat.min : ""; etat.max = /^\d+$/.test(etat.max) ? etat.max : "";
    if (["pertinence", "prix-asc", "prix-desc", "nom", "nouveautes"].indexOf(etat.tri) === -1 || (etat.tri === "nouveautes" && !tousOntDate)) etat.tri = "pertinence";
  }
  function ecrireAdresse() {
    var a = new URLSearchParams();
    CLES.forEach(function (k) { if (etat[k] && etat[k] !== VIDE[k]) a.set(k, etat[k]); });
    var s = a.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash); } catch (e) { /* adresse non modifiable */ }
  }

  /* ---------- construction de l'interface ---------- */
  function champSelect(id, libelle, valeurs) {
    var d = el("div", "field"), l = el("label", "", libelle); l.setAttribute("for", id);
    var s = document.createElement("select"); s.id = id;
    var tout = el("option", "", "Tous"); tout.value = ""; s.appendChild(tout);
    valeurs.forEach(function (v) { var o = el("option", "", v); o.value = v; s.appendChild(o); });
    d.appendChild(l); d.appendChild(s); zoneChamps.appendChild(d);
    return s;
  }
  function champPrix(id, libelle, exemple) {
    var d = el("div", "field"), l = el("label", "", libelle); l.setAttribute("for", id);
    var i = document.createElement("input"); i.id = id; i.type = "text"; i.inputMode = "numeric"; i.autocomplete = "off"; i.placeholder = exemple ? "Ex. " + exemple : "";
    d.appendChild(l); d.appendChild(i); zoneChamps.appendChild(d);
    return i;
  }
  var cMarque = marques.length ? champSelect("f-marque", "Marque", marques) : null;
  var cCap = capacites.length ? champSelect("f-cap", "Capacité", capacites) : null;
  var cCouleur = couleurs.length ? champSelect("f-couleur", "Couleur", couleurs) : null;
  var cEtat = etats.length ? champSelect("f-etat", "État", etats) : null;
  var cDispo = dispos.length ? champSelect("f-dispo", "Disponibilité", dispos) : null;
  var cMin = prixConnus.length ? champPrix("f-min", "Prix minimum (FCFA)", prixMin.toLocaleString("fr-FR")) : null;
  var cMax = prixConnus.length ? champPrix("f-max", "Prix maximum (FCFA)", prixMax.toLocaleString("fr-FR")) : null;

  [["pertinence", "Pertinence"], ["prix-asc", "Prix croissant"], ["prix-desc", "Prix décroissant"], ["nom", "Nom (A à Z)"]]
    .concat(tousOntDate ? [["nouveautes", "Nouveautés"]] : [])
    .forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; selTri.appendChild(op); });

  function bouton(texte, valeur, nb) {
    var b = el("button", "", texte + (nb !== undefined ? " (" + nb + ")" : "")); b.type = "button"; b.setAttribute("data-cat", valeur);
    b.addEventListener("click", function () { etat.cat = valeur; maj(); });
    zoneCats.appendChild(b);
  }
  bouton("Tous", "", tous.length);
  categories.forEach(function (c) { bouton(c, c, tous.filter(function (p) { return p.categorie === c; }).length); });

  /* ---------- filtrage et tri ---------- */
  function correspond(x) {
    var p = x.p;
    if (etat.cat && p.categorie !== etat.cat) return false;
    if (etat.marque && p.marque !== etat.marque) return false;
    if (etat.cap && S.stockages(p).indexOf(etat.cap) === -1) return false;
    if (etat.couleur && S.couleurs(p).indexOf(etat.couleur) === -1) return false;
    if (etat.etat && !((p.options && p.options.etats) || []).some(function (e) { return e.nom === etat.etat; })) return false;
    if (etat.dispo && p.disponibilite !== etat.dispo) return false;
    var min = etat.min === "" ? null : parseInt(etat.min, 10), max = etat.max === "" ? null : parseInt(etat.max, 10);
    if (min !== null && max !== null && min > max) { min = null; max = null; }
    if (min !== null || max !== null) {
      // un produit sans prix ne peut pas correspondre à une fourchette de prix
      if (!x.prix.some(function (n) { return (min === null || n >= min) && (max === null || n <= max); })) return false;
    }
    return true;
  }
  function trier(liste, jetons) {
    var t = etat.tri;
    liste.forEach(function (x) { x.score = jetons.length ? S.score(x.p, jetons, x.texte) : 1; });
    liste.sort(function (a, b) {
      if (t === "prix-asc" || t === "prix-desc") {
        if (a.mini === null && b.mini === null) return a.i - b.i;
        if (a.mini === null) return 1; if (b.mini === null) return -1;
        return (t === "prix-asc" ? a.mini - b.mini : b.mini - a.mini) || a.i - b.i;
      }
      if (t === "nom") return collateur.compare(a.p.nom, b.p.nom) || a.i - b.i;
      if (t === "nouveautes") return String(b.p.ajoute || "").localeCompare(String(a.p.ajoute || "")) || a.i - b.i;
      return (b.score - a.score) || (a.i - b.i);
    });
    return liste;
  }

  /* ---------- cartes ---------- */
  function carte(p) {
    var c = el("article", "card"), lien = el("a", "card-link");
    lien.href = "produit.html?p=" + encodeURIComponent(p.slug || KYR.slug(p.nom));
    var media = el("div", p.image ? "card-media has-img" : "card-media");
    if (p.image) { var img = document.createElement("img"); img.src = p.image; img.alt = p.nom; img.loading = "lazy"; media.appendChild(img); }
    else media.appendChild(document.createTextNode(p.nom));
    media.appendChild(el("span", "tag-pill", p.categorie));
    var corps = el("div", "card-body");
    corps.appendChild(el("h3", "", p.nom));
    var st = S.stockages(p);
    if (st.length) corps.appendChild(el("p", "card-meta", st.join(" · ")));
    var cl = (p.options && p.options.couleurs) || [];
    if (cl.length) {   // V2 : aperçu des couleurs (purement visuel)
      var sw = el("span", "card-swatches"); sw.setAttribute("role", "img"); sw.setAttribute("aria-label", cl.length + " couleur" + (cl.length > 1 ? "s" : ""));
      cl.slice(0, 6).forEach(function (c) { var d = document.createElement("i"); if (/^#[0-9A-Fa-f]{6}$/.test(c.hex || "")) d.style.setProperty("--c", c.hex); sw.appendChild(d); });
      if (cl.length > 6) sw.appendChild(el("b", "", "+" + (cl.length - 6)));
      corps.appendChild(sw);
    }
    corps.appendChild(el("p", "price", S.prixCarte(p)));
    corps.appendChild(el("span", "pill-link", "Détails →"));
    lien.appendChild(media); lien.appendChild(corps); c.appendChild(lien);
    return c;
  }

  /* ---------- affichage ---------- */
  function majErreurPrix() {
    var min = etat.min === "" ? null : parseInt(etat.min, 10), max = etat.max === "" ? null : parseInt(etat.max, 10);
    var bad = min !== null && max !== null && min > max;
    erreurPrix.hidden = !bad;
    erreurPrix.textContent = bad ? "Le prix minimum est plus grand que le prix maximum. Le filtre de prix est ignoré." : "";
  }
  function nbFiltres() {
    return ["marque", "cap", "couleur", "etat", "dispo", "min", "max"].filter(function (k) { return etat[k] !== ""; }).length;
  }
  function maj() {
    var jetons = S.normaliser(etat.q).split(" ").filter(Boolean);
    var liste = index.filter(function (x) { return correspond(x) && (!jetons.length || S.score(x.p, jetons, x.texte) > 0); });
    trier(liste, jetons);
    grille.innerHTML = "";
    liste.forEach(function (x) { grille.appendChild(carte(x.p)); });
    var n = liste.length;
    compteur.textContent = n === 0 ? "Aucun produit" : n + " produit" + (n > 1 ? "s" : "");
    vide.hidden = n !== 0;
    grille.hidden = n === 0;
    // reflète l'état dans les champs
    if (champRecherche.value !== etat.q) champRecherche.value = etat.q;
    if (cMarque) cMarque.value = etat.marque; if (cCap) cCap.value = etat.cap; if (cCouleur) cCouleur.value = etat.couleur;
    if (cEtat) cEtat.value = etat.etat; if (cDispo) cDispo.value = etat.dispo;
    if (cMin && cMin.value !== etat.min) cMin.value = etat.min; if (cMax && cMax.value !== etat.max) cMax.value = etat.max;
    selTri.value = etat.tri;
    Array.prototype.forEach.call(zoneCats.children, function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cat") === etat.cat ? "true" : "false"); });
    var f = nbFiltres();
    actifs.textContent = f ? "(" + f + ")" : "";
    majErreurPrix();
    ecrireAdresse();
  }
  function reinitialiser() { etat = Object.assign({}, VIDE); maj(); champRecherche.focus(); }

  /* ---------- événements ---------- */
  var minuteur = null;
  champRecherche.addEventListener("input", function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { etat.q = champRecherche.value.slice(0, 80); maj(); }, 120);
  });
  champRecherche.addEventListener("search", function () { etat.q = champRecherche.value.slice(0, 80); maj(); });
  function lie(champ, cle) { if (champ) champ.addEventListener("change", function () { etat[cle] = champ.value; maj(); }); }
  lie(cMarque, "marque"); lie(cCap, "cap"); lie(cCouleur, "couleur"); lie(cEtat, "etat"); lie(cDispo, "dispo");
  [[cMin, "min"], [cMax, "max"]].forEach(function (c) {
    if (!c[0]) return;
    c[0].addEventListener("input", function () { c[0].value = c[0].value.replace(/[^\d]/g, "").slice(0, 9); etat[c[1]] = c[0].value; maj(); });
  });
  selTri.addEventListener("change", function () { etat.tri = selTri.value; maj(); });
  el_("reinit").addEventListener("click", reinitialiser);
  el_("reinit2").addEventListener("click", reinitialiser);

  // filtres ouverts d'office sur grand écran, repliés sur téléphone
  var grand = window.matchMedia("(min-width: 820px)");
  function ouvrirSelonTaille() { if (grand.matches) panneau.setAttribute("open", ""); }
  ouvrirSelonTaille();

  lireAdresse();
  if (nbFiltres()) panneau.setAttribute("open", "");
  maj();
  }).catch(function () {
    var grille = document.getElementById("grid");
    if (grille) grille.textContent = "Le catalogue est momentanément indisponible. Réessayez plus tard ou contactez-nous sur WhatsApp.";
  });
})();
