/*
  Catalogue et panier : logique commune à la boutique, à la fiche produit et au panier.
  Aucune donnée n'est inventée : produits, variantes et prix viennent uniquement de products.js.
  Le panier ne garde que (produit, variante, quantité) : les prix sont recalculés à chaque affichage
  depuis le catalogue, donc un panier modifié à la main ne peut pas imposer un prix.
*/
(function () {
  "use strict";
  var MAX_LIGNES = 20, MAX_QTE = 20;

  function produits() { return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []; }
  function trouver(slug) {
    var liste = produits();
    for (var i = 0; i < liste.length; i++) if (KYR.slug(liste[i].nom) === slug) return liste[i];
    return null;
  }

  /* ---------- données du catalogue ---------- */
  function nomStock(s) { return typeof s === "object" ? s.nom : s; }
  function stockages(p) { return ((p.options && p.options.stockages) || []).map(nomStock); }
  function couleurs(p) { return ((p.options && p.options.couleurs) || []).map(function (c) { return c.nom; }); }
  function prixValide(n) { return typeof n === "number" && isFinite(n) && n > 0 ? n : null; }
  // Prix d'un produit pour une capacité donnée. null = pas de prix exploitable (affiché « Sur devis »).
  function prixDe(p, stockage) {
    var st = (p.options && p.options.stockages) || [], parCapacite = false, i;
    for (i = 0; i < st.length; i++) if (typeof st[i] === "object" && prixValide(st[i].prix) !== null) parCapacite = true;
    if (parCapacite) {
      // Produit avec des prix par capacité : seule la capacité choisie compte. Sans prix propre, c'est « Sur devis ».
      for (i = 0; i < st.length; i++) {
        if (typeof st[i] === "object" && st[i].nom === stockage && prixValide(st[i].prix) !== null) return st[i].prix;
      }
      return null;
    }
    return prixValide(p.prix);
  }
  // Capacité la moins chère dont le prix est connu (null si le produit n'a pas de prix par capacité).
  function capaciteMini(p) {
    var st = (p.options && p.options.stockages) || [], meilleur = null;
    st.forEach(function (s) { if (typeof s === "object" && prixValide(s.prix) !== null && (!meilleur || s.prix < meilleur.prix)) meilleur = s; });
    return meilleur;
  }
  // Texte de prix d'une carte : « À partir de » seulement si la plus petite capacité a un prix.
  function prixCarte(p) {
    var l = prixListe(p);
    if (!l.length) return "Sur devis";
    var st = (p.options && p.options.stockages) || [], mini = capaciteMini(p);
    if (!mini) return KYR.fcfa(l[0]);
    var premiere = st[0];
    var premierePrixee = typeof premiere === "object" && prixValide(premiere.prix) !== null;
    return premierePrixee ? "À partir de " + KYR.fcfa(mini.prix) : KYR.fcfa(mini.prix) + " (" + mini.nom + ")";
  }
  // Tous les prix connus d'un produit (prix de base ou prix par capacité).
  function prixListe(p) {
    var liste = [], st = (p.options && p.options.stockages) || [];
    st.forEach(function (s) { if (typeof s === "object" && prixValide(s.prix) !== null) liste.push(s.prix); });
    if (!liste.length && prixValide(p.prix) !== null) liste.push(p.prix);
    return liste;
  }
  function aPrix(p) { return prixListe(p).length > 0; }
  function prixMini(p) { var l = prixListe(p); return l.length ? Math.min.apply(null, l) : null; }
  function prixTexte(n) { return n === null || n === undefined ? "Sur devis" : KYR.fcfa(n); }

  /* ---------- variantes ---------- */
  var CHAMPS = ["couleur", "stockage", "etat", "sim"];
  var ETIQUETTES = { couleur: "Couleur", stockage: "Capacité", etat: "État", sim: "SIM" };
  function valeursPossibles(p, champ) {
    var o = p.options || {};
    if (champ === "couleur") return couleurs(p);
    if (champ === "stockage") return stockages(p);
    if (champ === "etat") return (o.etats || []).map(function (e) { return e.nom; });
    if (champ === "sim") return (o.sims || []).map(function (e) { return e.nom; });
    return [];
  }
  // Ne garde que des choix qui existent vraiment dans les options du produit.
  function varianteValide(p, v) {
    var sortie = { couleur: "", stockage: "", etat: "", sim: "" };
    CHAMPS.forEach(function (c) {
      var val = v && typeof v[c] === "string" ? v[c] : "";
      if (val && valeursPossibles(p, c).indexOf(val) !== -1) sortie[c] = val;
    });
    return sortie;
  }
  function lignesVariante(v) {
    var l = [];
    // V2 : ordre d'affichage Produit > Capacité > Couleur (puis état et SIM)
    ["stockage", "couleur", "etat", "sim"].forEach(function (c) { if (v && v[c]) l.push(ETIQUETTES[c] + " : " + v[c]); });
    return l;
  }
  // Libellés lisibles d'une variante, sans étiquette : capacité, couleur, état, SIM (V2)
  function partsVariante(v) {
    var l = [];
    if (v && v.stockage) l.push(v.stockage);
    if (v && v.couleur) l.push(v.couleur);
    if (v && v.etat) l.push(v.etat);
    if (v && v.sim) l.push(v.sim);
    return l;
  }
  function resumeVariante(v) { return partsVariante(v).join(" · "); }
  function cleLigne(id, v) { return [id, v.couleur, v.stockage, v.etat, v.sim].join("|"); }

  /* ---------- panier (localStorage) ---------- */
  function lireBrut() {
    var brut = [];
    try { brut = JSON.parse(localStorage.getItem(KYR.CLE_PANIER) || "[]"); } catch (e) { brut = []; }
    if (!Array.isArray(brut)) return [];
    var sortie = [];
    brut.slice(0, MAX_LIGNES).forEach(function (l) {
      if (!l || typeof l.id !== "string" || l.id.length > 80) return;
      var q = parseInt(l.q, 10);
      if (!(q >= 1)) return;
      var v = {};
      CHAMPS.forEach(function (c) { v[c] = l.v && typeof l.v[c] === "string" ? l.v[c].slice(0, 60) : ""; });
      sortie.push({ id: l.id, v: v, q: Math.min(q, MAX_QTE) });
    });
    return sortie;
  }
  function ecrire(lignes) {
    try { localStorage.setItem(KYR.CLE_PANIER, JSON.stringify(lignes)); } catch (e) { /* stockage indisponible : le panier ne sera pas conservé */ }
    window.dispatchEvent(new CustomEvent("kyr:panier"));
  }
  function ajouter(slug, variante, qte) {
    var p = trouver(slug);
    if (!p) return { ok: false, raison: "produit" };
    var v = varianteValide(p, variante), q = Math.max(1, Math.min(MAX_QTE, parseInt(qte, 10) || 1));
    var lignes = lireBrut(), cle = cleLigne(slug, v), existe = null;
    lignes.forEach(function (l) { if (cleLigne(l.id, l.v) === cle) existe = l; });
    if (existe) existe.q = Math.min(MAX_QTE, existe.q + q);
    else if (lignes.length >= MAX_LIGNES) return { ok: false, raison: "plein" };
    else lignes.push({ id: slug, v: v, q: q });
    ecrire(lignes);
    return { ok: true, nombre: KYR.nbPanier() };
  }
  function changerQte(cle, qte) {
    var q = parseInt(qte, 10);
    if (!(q >= 1)) return supprimer(cle);
    var lignes = lireBrut();
    lignes.forEach(function (l) { if (cleLigne(l.id, l.v) === cle) l.q = Math.min(MAX_QTE, q); });
    ecrire(lignes);
  }
  function supprimer(cle) { ecrire(lireBrut().filter(function (l) { return cleLigne(l.id, l.v) !== cle; })); }
  function vider() { ecrire([]); }

  // Lignes prêtes à afficher. produit = null si le produit n'est plus au catalogue.
  function lignes() {
    return lireBrut().map(function (l) {
      var p = trouver(l.id), v = p ? varianteValide(p, l.v) : l.v;
      var unitaire = p ? prixDe(p, v.stockage) : null;
      return { cle: cleLigne(l.id, l.v), id: l.id, produit: p, v: v, q: l.q, unitaire: unitaire, sousTotal: unitaire === null ? null : unitaire * l.q };
    });
  }
  // Le total n'est donné que si TOUTES les lignes disponibles ont un prix réel.
  function totaux(liste) {
    var dispo = liste.filter(function (l) { return l.produit; }), somme = 0, devis = 0;
    dispo.forEach(function (l) { if (l.sousTotal === null) devis++; else somme += l.sousTotal; });
    return { nb: dispo.length, quantite: dispo.reduce(function (n, l) { return n + l.q; }, 0), sousTotal: somme, nbSurDevis: devis, complet: dispo.length > 0 && devis === 0, indisponibles: liste.length - dispo.length };
  }

  /* ---------- messages WhatsApp (jamais d'IMEI, jamais de donnée interne) ---------- */
  var ENTETE = "Bonjour Keur Yaye Rokhaya 👋\n\nJe souhaite commander :\n";
  var PIED = "\nMerci de me confirmer la disponibilité et les modalités de commande.";
  function lignesMessage(p, v, q, unitaire, prefixe) {
    var l = [prefixe + "Produit : " + p.nom];
    if (v.stockage) l.push("• Capacité : " + v.stockage);
    if (v.couleur) l.push("• Couleur : " + v.couleur);
    if (v.etat) l.push("• État : " + v.etat);
    if (v.sim) l.push("• SIM : " + v.sim);
    l.push("• Quantité : " + q);
    l.push("• Prix unitaire : " + prixTexte(unitaire));
    if (unitaire !== null) l.push("• Total : " + KYR.fcfa(unitaire * q));
    return l;
  }
  function messageProduit(p, variante, qte) {
    var v = varianteValide(p, variante), q = Math.max(1, Math.min(MAX_QTE, parseInt(qte, 10) || 1));
    return ENTETE + "\n" + lignesMessage(p, v, q, prixDe(p, v.stockage), "• ").join("\n") + "\n" + PIED;
  }
  function messageCommande(liste) {
    var dispo = liste.filter(function (l) { return l.produit; }), t = totaux(liste), corps = [];
    dispo.forEach(function (l, i) {
      var lg = lignesMessage(l.produit, l.v, l.q, l.unitaire, (i + 1) + ") ");
      corps.push(lg.join("\n   ").replace(/\n {3}• Total :/, "\n   • Sous-total :"));
    });
    var total = t.complet ? "Total : " + KYR.fcfa(t.sousTotal) : "Total : à confirmer (" + t.nbSurDevis + " produit" + (t.nbSurDevis > 1 ? "s" : "") + " sur devis)";
    return ENTETE + "\n" + corps.join("\n\n") + "\n\n" + total + "\n" + PIED;
  }

  /* ---------- recherche ---------- */
  // Normalise : minuscules, sans accents, « 128go » devient « 128 go », « iphone15 » devient « iphone 15 ».
  function normaliser(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
      .replace(/\b(\d+) (gb|g)\b/g, "$1 go").replace(/\b(\d+) tb\b/g, "$1 to")
      .replace(/\s+/g, " ").trim();
  }
  // Texte réellement présent dans les données d'un produit, en deux parties :
  // « court » (nom, catégorie, marque, options) et « long » (description, disponibilité).
  function texteRecherche(p) {
    var o = p.options || {}, court = [p.nom, p.categorie, p.marque], long = [p.description, p.disponibilite];
    stockages(p).forEach(function (s) { court.push(s); });
    couleurs(p).forEach(function (c) { court.push(c); });
    (o.etats || []).forEach(function (e) { court.push(e.nom); });
    (o.sims || []).forEach(function (e) { court.push(e.nom); });
    return { court: normaliser(court.filter(Boolean).join(" ")).split(" "), long: normaliser(long.filter(Boolean).join(" ")).split(" ") };
  }
  // Chaque mot cherché doit être trouvé. Dans le nom et les options, un début de mot suffit (« sams » trouve Samsung).
  // Dans la description, un mot court doit être exact (« pro » ne trouve pas « prolongée »).
  function score(p, jetons, texte) {
    if (!jetons.length) return 1;
    var nom = " " + normaliser(p.nom) + " ", total = 0;
    for (var i = 0; i < jetons.length; i++) {
      var j = jetons[i], dansCourt = false, dansLong = false, k;
      for (k = 0; k < texte.court.length; k++) {
        if (j.length === 1 ? texte.court[k] === j : texte.court[k].indexOf(j) === 0) { dansCourt = true; break; }
      }
      if (!dansCourt) {
        for (k = 0; k < texte.long.length; k++) {
          if (j.length <= 3 ? texte.long[k] === j : texte.long[k].indexOf(j) === 0) { dansLong = true; break; }
        }
      }
      if (!dansCourt && !dansLong) return 0;
      total += nom.indexOf(" " + j) !== -1 ? 3 : (dansCourt ? 2 : 1);
    }
    return total;
  }

  window.KYR.shop = {
    MAX_QTE: MAX_QTE, produits: produits, trouver: trouver, stockages: stockages, couleurs: couleurs,
    prixDe: prixDe, prixCarte: prixCarte, capaciteMini: capaciteMini, prixListe: prixListe, aPrix: aPrix, prixMini: prixMini, prixTexte: prixTexte,
    varianteValide: varianteValide, lignesVariante: lignesVariante, partsVariante: partsVariante, resumeVariante: resumeVariante,
    ajouter: ajouter, changerQte: changerQte, supprimer: supprimer, vider: vider, lignes: lignes, totaux: totaux,
    messageProduit: messageProduit, messageCommande: messageCommande,
    normaliser: normaliser, texteRecherche: texteRecherche, score: score
  };
})();
