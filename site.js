/* Éléments communs à toutes les pages : lien WhatsApp, barre d'onglets en pilule, bouton Discuter */
(function () {
  // ---- CONFIGURATION : seul endroit où écrire les numéros (format international, sans +) ----
  var NUMERO = "221784852982";      // WhatsApp et téléphone principal
  var NUMERO2 = "221772615354";     // deuxième téléphone

  function affiche(n) {
    var m = String(n).match(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/);
    return m ? "+" + m[1] + " " + m[2] + " " + m[3] + " " + m[4] + " " + m[5] : "+" + n;
  }

  window.KYR = {
    numero: NUMERO,
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
    lien: function (message) {
      return "https://wa.me/" + NUMERO + "?text=" + encodeURIComponent(message);
    },
    slug: function (nom) {
      return String(nom).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
  };

  // Liens et numéros des pages : data-wa="message", data-tel="1|2", data-num="1|2"
  function appliquerNumeros() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-wa]"), function (a) {
      var msg = a.getAttribute("data-wa") || "Bonjour, je souhaite commander un produit chez Keur Yaye Rokhaya.";
      a.href = window.KYR.lien(msg);
      a.target = "_blank";
      a.rel = "noopener";
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tel]"), function (a) {
      var n = a.getAttribute("data-tel") === "2" ? NUMERO2 : NUMERO;
      a.href = "tel:+" + n;
      if (!a.textContent.trim()) a.textContent = affiche(n);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-num]"), function (e) {
      e.textContent = affiche(e.getAttribute("data-num") === "2" ? NUMERO2 : NUMERO);
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

  if (!document.body.hasAttribute("data-no-chat")) {
    var chat = document.createElement("a");
    chat.className = "float-chat";
    chat.href = window.KYR.lien("Bonjour, je souhaite commander un produit chez Keur Yaye Rokhaya.");
    chat.target = "_blank";
    chat.rel = "noopener";
    chat.setAttribute("aria-label", "Discuter sur WhatsApp");
    chat.innerHTML = icone('<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3z"/>') + "Discuter";
    document.body.appendChild(chat);
  }
})();
