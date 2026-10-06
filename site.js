/* Éléments communs à toutes les pages : lien WhatsApp, barre d'onglets en pilule, bouton Discuter */
(function () {
  // ---- CONFIGURATION : seul endroit où écrire les numéros (format international, sans +) ----
  var NUMERO = "221772615354";      // NUMÉRO PRINCIPAL : toutes les commandes WhatsApp (+221 77 261 53 54)
  var TEL_COMMERCIAL = "221775797948"; // TÉLÉPHONE COMMERCIAL : appels uniquement, jamais WhatsApp (+221 77 579 79 48)
  var NUMERO2 = "221784852982";     // contact secondaire (+221 78 485 29 82)
  var TIKTOK_URL = "https://www.tiktok.com/@keur_yaye_rokhaya_apple";
  var TIKTOK_NOM = "@keur_yaye_rokhaya_apple";
  var EMAIL = "contact@keuryayerokhaya.com";

  function affiche(n) {
    var m = String(n).match(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? "+" + m[1] + " " + m[2] + " " + m[3] + " " + m[4] + " " + m[5] : "+" + n;
  }

  var CLE_PANIER = "kyr_panier_v1";
  function nbPanier() {
    var n = 0;
    try { JSON.parse(localStorage.getItem(CLE_PANIER) || "[]").forEach(function (l) { n += Math.max(0, Math.min(20, parseInt(l && l.q, 10) || 0)); }); } catch (e) { n = 0; }
    return n;
  }

  // Répare un nom dont les accents ont été lus avec un mauvais encodage (UTF-8 lu comme Latin-1) : le slug d'un produit
  // (adresse de sa fiche) doit être identique sur la boutique, la fiche, le panier et Malick, quel que soit l'encodage de la page.
  function reparerEncodage(s) {
    s = String(s);
    if (!/[\u00C2-\u00F4]/.test(s) || /[^\u0000-\u00FF]/.test(s) || typeof TextDecoder === "undefined") return s;
    try {
      var octets = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) octets[i] = s.charCodeAt(i);
      return new TextDecoder("utf-8", { fatal: true }).decode(octets);
    } catch (e) { return s; }                          // texte déjà correct : inchangé
  }

  window.KYR = {
    CLE_PANIER: CLE_PANIER,
    nbPanier: nbPanier,
    numero: NUMERO,
    numero2: NUMERO2,
    telCommercial: TEL_COMMERCIAL,
    tiktok: TIKTOK_URL,
    tiktokNom: TIKTOK_NOM,
    email: EMAIL,
    affiche: affiche,
    fcfa: function (n) { return n.toLocaleString("fr-FR") + " FCFA"; },
    // un produit a-t-il un prix différent selon la capacité ?
    aPrixParCapacite: function (p) {
      var st = p && p.options && p.options.stockages;
      return !!(st && st.some(function (s) { return typeof s === "object" && typeof s.prix === "number"; }));
    },
    // prix le plus bas du produit (prix de base ou capacité la moins chère)
    prixMini: function (p) {
      var st = p && p.options && p.options.stockages, prix = [];
      if (st) st.forEach(function (s) { if (typeof s === "object" && typeof s.prix === "number") prix.push(s.prix); });
      return prix.length ? Math.min.apply(null, prix) : p.prix;
    },
    // lien(message) : numéro 1 ; lien(message, 2) : numéro 2
    lien: function (message, n) {
      return "https://wa.me/" + (n === 2 ? NUMERO2 : NUMERO) + "?text=" + encodeURIComponent(message);
    },
    slug: function (nom) {
      return reparerEncodage(nom).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
  };

  // Liens et numéros des pages : data-wa="message" (+ data-wa-num="2"), data-tel="1|2|c" (c = téléphone commercial), data-num="1|2|c", data-mail, data-tiktok
  function appliquerNumeros() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-wa]"), function (a) {
      var msg = a.getAttribute("data-wa") || "Bonjour, je souhaite commander un produit chez Keur Yaye Rokhaya.";
      a.href = window.KYR.lien(msg, a.getAttribute("data-wa-num") === "2" ? 2 : 1);
      a.target = "_blank";
      a.rel = "noopener";
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-mail]"), function (a) {
      a.href = "mailto:" + EMAIL;
      if (!a.textContent.trim()) a.textContent = EMAIL;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tel]"), function (a) {
      var c = a.getAttribute("data-tel"), n = c === "c" ? TEL_COMMERCIAL : (c === "2" ? NUMERO2 : NUMERO);
      a.href = "tel:+" + n;
      if (!a.textContent.trim()) a.textContent = affiche(n);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-num]"), function (e) {
      var c = e.getAttribute("data-num");
      e.textContent = affiche(c === "c" ? TEL_COMMERCIAL : (c === "2" ? NUMERO2 : NUMERO));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tiktok]"), function (a) {
      a.href = TIKTOK_URL; a.target = "_blank"; a.rel = "noopener noreferrer";
      if (!a.textContent.trim()) a.textContent = "TikTok " + TIKTOK_NOM;
    });
  }
  appliquerNumeros();

  function icone(chemin) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemin + "</svg>";
  }

  var ONGLETS = [
    { id: "accueil", nom: "Accueil", href: "index.html", svg: icone('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>') },
    { id: "boutique", nom: "Boutique", href: "index.html#nos-produits", svg: icone('<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>') },
    { id: "echange", nom: "Échange", href: "estimation.html?type=echange", svg: icone('<path d="M4 8h14"/><path d="M14 4l4 4-4 4"/><path d="M20 16H6"/><path d="M10 12l-4 4 4 4"/>') },
    { id: "vendre", nom: "Vendre", href: "estimation.html?type=vendre", svg: icone('<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M15 9.2c-.5-.9-1.6-1.4-3-1.4-1.7 0-3 .8-3 2 0 1.3 1.3 1.7 3 2.1s3 .8 3 2.1c0 1.2-1.3 2-3 2-1.4 0-2.5-.5-3-1.4"/>') },
    { id: "retrograder", nom: "Rétrograde", href: "estimation.html?type=retrograder", svg: icone('<circle cx="12" cy="12" r="9"/><path d="M12 7v9"/><path d="M8.5 12.5l3.5 3.5 3.5-3.5"/>') },
    { id: "epargne", nom: "Épargne", href: "index.html#epargne", svg: icone('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') }
  ];

  function ongletActif() {
    var page = location.pathname.split("/").pop() || "index.html";
    if (page === "estimation.html") {
      var t = new URLSearchParams(location.search).get("type");
      return ({ echange: "echange", vendre: "vendre", retrograder: "retrograder" })[t] || "";
    }
    if (page === "produit.html") return "boutique";
    if (page === "index.html") {
      if (location.hash === "#nos-produits") return "boutique";
      if (location.hash === "#epargne") return "epargne";
      return "accueil";
    }
    return "";
  }

  var barre = document.createElement("nav");
  barre.className = "tabbar";
  barre.setAttribute("aria-label", "Navigation rapide");
  barre.innerHTML = ONGLETS.map(function (o) {
    return '<a href="' + o.href + '" data-tab="' + o.id + '">' + o.svg + "<span>" + o.nom + "</span></a>";
  }).join("");

  function majOnglet() {
    var actif = ongletActif();
    Array.prototype.forEach.call(barre.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-tab") === actif) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }
  majOnglet();
  window.addEventListener("hashchange", majOnglet);
  document.body.appendChild(barre);

  // ---- Menu mobile (hamburger) : le menu du haut s'ouvre en liste sur téléphone ----
  (function menuMobile() {
    var grille = document.querySelector(".header-grid");
    var nav = grille && grille.querySelector(".nav");
    if (!grille || !nav) return;
    nav.id = nav.id || "menu-principal";
    var compteLien = document.createElement("a");
    compteLien.className = "nav-extra";
    compteLien.href = "connexion.html";
    compteLien.textContent = "Connexion / Espace Client";
    nav.appendChild(compteLien);
    var panierLien = document.createElement("a");
    panierLien.className = "nav-cart"; panierLien.href = "panier.html";
    panierLien.innerHTML = 'Panier <span class="cart-count" data-cart-count hidden>0</span>';
    nav.appendChild(panierLien);
    var wa = document.createElement("a");
    wa.className = "nav-extra"; wa.href = "#"; wa.textContent = "Commander sur WhatsApp";
    wa.setAttribute("data-wa", "Bonjour, je souhaite commander un produit chez Keur Yaye Rokhaya.");
    nav.appendChild(wa);
    var appel = document.createElement("a");
    appel.className = "nav-extra"; appel.href = "#"; appel.setAttribute("data-tel", "c"); appel.textContent = "Appeler le magasin";
    nav.appendChild(appel);
    appliquerNumeros();
    var b = document.createElement("button");
    b.type = "button"; b.className = "menu-btn";
    b.setAttribute("aria-controls", nav.id); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "Ouvrir le menu");
    var barres = '<path d="M4 7h16M4 12h16M4 17h16"/>', croix = '<path d="M6 6l12 12M18 6L6 18"/>';
    b.innerHTML = icone(barres);
    grille.appendChild(b);
    function etat(ouvert) {
      grille.classList.toggle("menu-ouvert", ouvert);
      b.setAttribute("aria-expanded", ouvert ? "true" : "false");
      b.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
      b.innerHTML = icone(ouvert ? croix : barres);
    }
    b.addEventListener("click", function () { etat(!grille.classList.contains("menu-ouvert")); });
    nav.addEventListener("click", function (e) { var t = e.target; while (t && t !== nav) { if (t.tagName === "A") { etat(false); return; } t = t.parentNode; } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && grille.classList.contains("menu-ouvert")) { etat(false); b.focus(); } });
    var large = window.matchMedia("(min-width: 1080px)");
    function surTaille() { if (large.matches) etat(false); }
    if (large.addEventListener) large.addEventListener("change", surTaille); else if (large.addListener) large.addListener(surTaille);
  })();

  // ---- Pied de page commun à toutes les pages (le pied de page simple du HTML reste en secours) ----
  (function piedDePage() {
    var f = document.querySelector(".site-footer");
    if (!f) return;
    f.innerHTML =
      '<div class="wrap footer-grid">' +
        '<div class="fcol">' +
          '<a class="brand" href="index.html"><img src="logo.png" alt="" width="30" height="36">Keur Yaye Rokhaya</a>' +
          '<p>Boutique de produits Apple et de smartphones à Keur Mbaye Fall, Dakar. Livraison partout au Sénégal.</p>' +
        '</div>' +
        '<nav class="fcol" aria-label="Boutique et services">' +
          '<p class="ftitre">Boutique</p>' +
          '<a href="index.html#nos-produits">Tous les produits</a>' +
          '<a href="index.html#services">Services</a>' +
          '<a href="index.html#epargne">Coffre Épargne</a>' +
          '<a href="panier.html">Panier</a>' +
          '<a href="estimation.html?type=echange">Échange iPhone</a>' +
          '<a href="estimation.html?type=vendre">Vendre mon iPhone</a>' +
          '<a href="estimation.html?type=retrograder">Rétrograder mon iPhone</a>' +
        '</nav>' +
        '<div class="fcol">' +
          '<p class="ftitre">Contact</p>' +
          '<address>Keur Mbaye Fall, en face école Fogny, Dakar</address>' +
          '<a href="#" data-wa="Bonjour, j’ai une question." data-wa-num="1">WhatsApp commandes <span data-num="1"></span></a>' +
          '<a href="#" data-tel="c">Téléphone commercial <span data-num="c"></span></a>' +
          '<a href="#" data-wa="Bonjour, j’ai une question." data-wa-num="2">Contact secondaire <span data-num="2"></span></a>' +
          '<a href="#" data-mail></a>' +
          '<p class="ftitre">Suivez-nous</p>' +
          '<a class="f-social" href="#" data-tiktok>' + icone('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.4 2 4 4.5 4.2"/>') + '<span>TikTok ' + TIKTOK_NOM + '</span></a>' +
        '</div>' +
        '<nav class="fcol" aria-label="Informations légales">' +
          '<p class="ftitre">Informations</p>' +
          '<a href="cgu.html">Conditions d’utilisation</a>' +
          '<a href="confidentialite.html">Confidentialité</a>' +
        '</nav>' +
        '<div class="footer-bas"><p>© 2026 Keur Yaye Rokhaya</p><p class="credit">Site conçu par Sultan Agency</p></div>' +
      '</div>';
    appliquerNumeros();
  })();

  // ---- Boutons flottants : Malick (assistant) et Discuter (WhatsApp) ----
  var flottants = document.createElement("div");
  flottants.className = "floats";

  var malick = document.createElement("button");
  malick.type = "button";
  malick.className = "malick-launcher";
  malick.setAttribute("aria-label", "Discuter avec Malick, l’assistant Keur Yaye Rokhaya");
  malick.setAttribute("aria-haspopup", "dialog");
  malick.innerHTML = '<span class="malick-avatar" aria-hidden="true">M</span><span>Malick</span>';
  flottants.appendChild(malick);

  // L'assistant ne se charge qu'au premier clic : le site reste rapide.
  var malickEnCours = false;
  function chargerMalick(fichier, type) {
    return new Promise(function (ok, ko) {
      var n = document.createElement(type === "css" ? "link" : "script");
      if (type === "css") { n.rel = "stylesheet"; n.href = fichier; } else { n.src = fichier; }
      n.onload = ok; n.onerror = ko;
      document.head.appendChild(n);
    });
  }
  // Si les fichiers de Malick ne se chargent pas (hors connexion...), on l'indique ; WhatsApp reste un lien que le visiteur choisit de toucher.
  function avisMalickIndisponible() {
    var ancien = document.querySelector(".malick-avis"); if (ancien) ancien.parentNode.removeChild(ancien);
    var a = document.createElement("div"); a.className = "malick-avis"; a.setAttribute("role", "alert");
    a.appendChild(document.createTextNode("Malick n’est pas disponible pour le moment. "));
    var l = document.createElement("a"); l.href = window.KYR.lien("Bonjour Keur Yaye Rokhaya, j’ai une question."); l.target = "_blank"; l.rel = "noopener"; l.textContent = "Écrire à l’équipe sur WhatsApp";
    var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Fermer ce message"); x.textContent = "×";
    x.addEventListener("click", function () { if (a.parentNode) a.parentNode.removeChild(a); });
    a.appendChild(l); a.appendChild(x); document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 15000);
  }
  malick.addEventListener("click", function () {
    if (window.Malick) { window.Malick.ouvrir(malick); return; }
    if (malickEnCours) return;
    malickEnCours = true;
    malick.classList.add("charge");
    Promise.all([chargerMalick("malick.css", "css"), chargerMalick("malick-config.js", "js")])
      .then(function () { return chargerMalick("malick.js", "js"); })
      .then(function () { malick.classList.remove("charge"); malickEnCours = false; window.Malick.ouvrir(malick); })
      .catch(function () {
        malick.classList.remove("charge"); malickEnCours = false;
        avisMalickIndisponible();
      });
  });

  if (!document.body.hasAttribute("data-no-chat")) {
    var chat = document.createElement("a");
    chat.className = "float-chat";
    chat.href = window.KYR.lien("Bonjour, je souhaite commander un produit chez Keur Yaye Rokhaya.");
    chat.target = "_blank";
    chat.rel = "noopener";
    chat.setAttribute("aria-label", "Discuter sur WhatsApp");
    chat.innerHTML = icone('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3z"/>') + "Discuter";
    flottants.appendChild(chat);
  }
  // Panier flottant : n'apparaît que s'il contient des produits (et pas sur la page Panier elle-même)
  var pagePanier = (location.pathname.split("/").pop() || "") === "panier.html";
  var flotPanier = document.createElement("a");
  flotPanier.className = "float-cart"; flotPanier.href = "panier.html"; flotPanier.hidden = true;
  flotPanier.innerHTML = icone('<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>') + '<span>Panier <b data-cart-count>0</b></span>';
  if (!pagePanier) flottants.insertBefore(flotPanier, flottants.firstChild);

  function majCompteurPanier() {
    var n = nbPanier();
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-count]"), function (e) {
      e.textContent = n; if (e.tagName === "SPAN" && e.classList.contains("cart-count")) e.hidden = n === 0;
    });
    flotPanier.hidden = n === 0;
    flotPanier.setAttribute("aria-label", "Voir le panier, " + n + " article" + (n > 1 ? "s" : ""));
  }
  window.addEventListener("kyr:panier", majCompteurPanier);
  window.addEventListener("storage", function (e) { if (e.key === CLE_PANIER) majCompteurPanier(); });

  document.body.appendChild(flottants);
  majCompteurPanier();   // après l'ajout au document : met à jour aussi la pastille du panier flottant
})();
