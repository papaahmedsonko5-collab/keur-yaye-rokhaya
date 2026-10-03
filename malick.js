/*
  Malick, assistant de Keur Yaye Rokhaya (niveau 1).
  - Charge malick-kb.json (base de connaissances) et le catalogue products.js.
  - Sans apiUrl (malick-config.js) : répond localement, rien n'est envoyé ailleurs.
  - Avec apiUrl : envoie la conversation à un service sécurisé qui détient la clé IA.
  Aucun secret dans ce fichier.
*/
(function () {
  "use strict";
  if (window.Malick) return;

  var CFG = { apiUrl: "", delaiMs: 650, messageMaxCaracteres: 500, historiqueMax: 30, delaiApiMs: 20000 };
  var surcharge = window.MALICK_CONFIG || {};
  Object.keys(surcharge).forEach(function (k) { CFG[k] = surcharge[k]; });

  var CLE = "malick_conversation";
  var SUGGESTIONS = ["📱 Nos iPhone", "💰 Coffre Épargne", "🔧 Réparation", "♻️ Échange / reprise", "📍 Nous contacter"];
  var MODIFS = ["pro", "max", "plus", "air", "mini", "ultra", "e", "xr", "xs", "fe"];
  var PRIORITAIRES = ["identite", "echange", "vente", "retrograde", "estimation", "reparation", "coffre", "garantie", "paiement", "livraison", "commande", "horaires", "fonds-ecran", "ipad-mac", "promotion"];

  var kb = null, ui = null, historique = [], registre = "vous", ouvert = false, occupe = false, declencheur = null, apiEnPanne = false;

  /* ---------- outils ---------- */
  function el(tag, cls, texte) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte) n.textContent = texte;
    return n;
  }
  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function court(n) { return KYR.affiche(n).replace("+221 ", ""); }
  function chargerScript(src, fini) {
    var s = document.createElement("script");
    s.src = src; s.onload = function () { fini(true); }; s.onerror = function () { fini(false); };
    document.head.appendChild(s);
  }
  function chargerDonnees(fini) {
    var attente = 2, ok = true;
    function un(reussi) { if (!reussi) ok = false; if (--attente === 0) fini(ok); }
    fetch("malick-kb.json").then(function (r) { return r.json(); }).then(function (j) { kb = j; un(true); }).catch(function () { un(false); });
    if (Array.isArray(window.PRODUCTS)) un(true); else chargerScript("products.js", un);
  }
  function valeurContact(cle) {
    var c = (kb && kb.contact) || {};
    if (cle === "tel1") return KYR.affiche(KYR.numero);
    if (cle === "tel2") return KYR.affiche(KYR.numero2);
    if (cle === "telcom") return KYR.affiche(KYR.telCommercial);
    if (cle === "tiktok") return KYR.tiktokNom;
    if (cle === "email") return KYR.email;
    return c[cle] || "";
  }
  /* {vous|tu} : choisit selon le registre ; {tel1}, {email}, {adresse} : coordonnées */
  function formater(t) {
    t = t.replace(/\{(tel1|tel2|telcom|tiktok|email|adresse)\}/g, function (_, k) { return valeurContact(k); });
    return t.replace(/\{([^{}|]+)\|([^{}]+)\}/g, function (_, a, b) { return registre === "tu" ? b : a; });
  }
  var RE_TU = /(^| )(tu|toi|ton|ta|tes|salut|slt|wesh|stp|t as|t es|dis moi|j veux|tas)( |$)/;
  function majRegistre(texte) { if (RE_TU.test(norm(texte))) registre = "tu"; }

  /* ---------- actions (boutons sous les réponses) ---------- */
  function actionsContact() {
    return [
      { label: "WhatsApp " + court(KYR.numero), href: KYR.lien("Bonjour Keur Yaye Rokhaya, j’ai une question.", 1), ext: true },
      { label: "Appeler " + court(KYR.telCommercial), href: "tel:+" + KYR.telCommercial },
      { label: "WhatsApp " + court(KYR.numero2), href: KYR.lien("Bonjour Keur Yaye Rokhaya, j’ai une question.", 2), ext: true },
      { label: "TikTok", href: KYR.tiktok, ext: true },
      { label: "E-mail", href: "mailto:" + KYR.email }
    ];
  }
  function actionsDe(liste) {
    var sortie = [];
    (liste || []).forEach(function (a) {
      if (a.contact) sortie = sortie.concat(actionsContact());
      else if (a.wa) sortie.push({ label: a.label, href: KYR.lien(a.wa, a.num || 1), ext: true });
      else sortie.push({ label: a.label, href: a.href, ext: !!a.ext });
    });
    return sortie;
  }

  /* ---------- catalogue ---------- */
  function produits() { return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []; }
  function alias(nom) {
    var res = [norm(nom)];
    nom.split(/[\/()]/).forEach(function (seg) { var n = norm(seg); if (n && res.indexOf(n) === -1) res.push(n); });
    var n0 = res[0], sans = n0.replace(/^(google|galaxy|apple|samsung) /, "");
    if (sans !== n0 && res.indexOf(sans) === -1) res.push(sans);
    return res;
  }
  function trouverProduit(nq) {
    var q = nq.split(" "), meilleur = null, longueur = 0;
    produits().forEach(function (p) {
      alias(p.nom).forEach(function (a) {
        var at = a.split(" ");
        for (var i = 0; i + at.length <= q.length; i++) {
          var ok = true;
          for (var j = 0; j < at.length; j++) { if (q[i + j] !== at[j]) { ok = false; break; } }
          if (!ok) continue;
          var suivant = q[i + at.length];
          if (suivant && MODIFS.indexOf(suivant) !== -1) continue;   // une variante est demandée (ex. iPhone 15 Pro)
          if (at.length > longueur) { longueur = at.length; meilleur = p; }
        }
      });
    });
    return meilleur;
  }
  function iphoneCite(nq) {
    var m = nq.match(/iphone (\d{1,2}e?|x|xr|xs|se)( pro max| promax| pro| plus| air| mini| max| e)?( |$)/);
    return m ? ("iPhone " + m[1] + (m[2] ? " " + m[2].trim() : "")).replace("promax", "pro max") : "";
  }
  function capaciteDemandee(nq) {
    var m = nq.match(/(^| )(\d{2,3}) ?(go|gb|g)( |$)/);
    if (m) return m[2] + " Go";
    m = nq.match(/(^| )(1|2) ?(to|tb)( |$)/);
    return m ? m[2] + " To" : "";
  }
  function messageProduit(p) {
    return "Bonjour Keur Yaye Rokhaya, je suis intéressé(e) par : " + p.nom + ". Pouvez-vous me confirmer la disponibilité et le prix ?";
  }
  // V2 : demande de prix pour une capacité sans prix affiché (« Sur devis »)
  function messageDevis(p, cap) {
    return "Bonjour Keur Yaye Rokhaya, je souhaite connaître le prix du " + p.nom + (cap ? " en " + cap : "") + ".";
  }
  function reponseProduit(p, nq) {
    var st = p.options && p.options.stockages, cap = capaciteDemandee(nq), t, devisCap = "", aDevis = false;
    if (KYR.aPrixParCapacite(p)) {
      var nomS = function (s) { return typeof s === "object" ? s.nom : s; };
      var prixS = function (s) { return typeof s === "object" && typeof s.prix === "number" ? s.prix : null; };
      var choisi = cap ? st.filter(function (s) { return nomS(s) === cap; })[0] : null;
      if (choisi && prixS(choisi) !== null) t = p.nom + " " + cap + " : " + KYR.fcfa(prixS(choisi)) + " (prix affiché sur le site).";
      else if (choisi) { aDevis = true; devisCap = cap; t = p.nom + " " + cap + " : Sur devis. Le prix de cette capacité n’est pas affiché sur le site : " + (registre === "tu" ? "demande-le" : "demandez-le") + " sur WhatsApp, l’équipe " + (registre === "tu" ? "te" : "vous") + " le donne."; }
      else {
        aDevis = st.some(function (s) { return prixS(s) === null; });
        t = p.nom + " : le prix change selon la capacité. Prix affichés sur le site :\n" +
          st.map(function (s) { return "• " + nomS(s) + " : " + (prixS(s) !== null ? KYR.fcfa(prixS(s)) : "Sur devis"); }).join("\n") +
          (aDevis ? "\n\nPour une capacité « Sur devis », " + (registre === "tu" ? "demande" : "demandez") + " le prix sur WhatsApp." : "");
      }
    } else if (typeof p.prix === "number" && p.prix > 0) {
      t = p.nom + " : " + KYR.fcfa(p.prix) + " (prix affiché sur le site).";
    } else {
      t = p.nom + " est sur le site, mais son prix n’est pas affiché. L’équipe " + (registre === "tu" ? "te" : "vous") + " le confirmera.";
    }
    if (p.description) t += "\n" + p.description;
    t += "\n\nCe prix est indicatif. Je n’ai pas accès au stock en temps réel : l’équipe confirme la disponibilité et le prix à jour sur WhatsApp.";
    return { texte: t, actions: [
      { label: "Voir la fiche", href: "produit.html?p=" + KYR.slug(p.nom) },
      { label: aDevis ? "Demander le prix sur WhatsApp" : "Demander sur WhatsApp", href: KYR.lien(aDevis ? messageDevis(p, devisCap) : messageProduit(p), 1), ext: true }
    ] };
  }
  function reponseCategorie(cat, nq) {
    var liste = produits().filter(function (p) { return p.categorie === cat; });
    if (!liste.length) return null;
    liste.sort(function (a, b) { return KYR.prixMini(a) - KYR.prixMini(b); });
    var vous = registre === "tu" ? "te" : "vous";
    var t;
    if (cat === "Accessoires") {
      t = "Oui 😊 Voici les accessoires affichés sur le site :\n" + liste.map(function (p) { return "• " + p.nom + " : " + KYR.fcfa(KYR.prixMini(p)); }).join("\n");
    } else {
      var a = liste[0], b = liste[liste.length - 1];
      t = "Oui 😊 Sur le site, il y a " + liste.length + " produit" + (liste.length > 1 ? "s" : "") + " dans « " + cat + " »" +
        (liste.length > 1 ? ", de " + a.nom + " (" + KYR.fcfa(KYR.prixMini(a)) + ") à " + b.nom + " (" + KYR.fcfa(KYR.prixMini(b)) + ")" : " : " + a.nom + " (" + KYR.fcfa(KYR.prixMini(a)) + ")") + ".";
      t += "\n\n" + (registre === "tu" ? "Dis-moi" : "Dites-moi") + " quel modèle " + (registre === "tu" ? "t’" : "vous ") + "intéresse et je " + vous + " donne le prix affiché.";
    }
    t += "\nLes prix sont indicatifs : l’équipe confirme le prix et la disponibilité sur WhatsApp.";
    return { texte: t, actions: [{ label: "Voir la boutique", href: "index.html#nos-produits" }, { label: "Écrire sur WhatsApp", href: KYR.lien("Bonjour Keur Yaye Rokhaya, je souhaite des informations sur : " + cat + ".", 1), ext: true }] };
  }
  function categorieCitee(nq) {
    var q = " " + nq + " ";
    if (/ (accessoire|accessoires|coque|coques|chargeur|chargeurs|cable|cables|verre|clavier|claviers|pencil|stylet|adaptateur|pochette) /.test(q)) return "Accessoires";
    if (/ (samsung|galaxy) /.test(q)) return "Samsung";
    if (/ (pixel|google) /.test(q)) return "Google Pixel";
    if (/ (watch|montre|montres) /.test(q)) return "Apple Watch";
    if (/ (iphone|iphones) /.test(q)) return "iPhone";
    return "";
  }

  /* ---------- base de connaissances ---------- */
  function score(nq, sujet) {
    var sc = 0, rembourre = " " + nq + " ";
    sujet.mots.forEach(function (m) {
      var prefixe = /\*$/.test(m), k = norm(m.replace(/\*$/, ""));
      if (!k) return;
      var trouve = prefixe ? new RegExp("(^| )" + k + "[a-z0-9]*").test(nq) : rembourre.indexOf(" " + k + " ") !== -1;
      if (trouve) sc += k.indexOf(" ") !== -1 ? 2 : 1;
    });
    return sc;
  }
  function meilleurSujet(nq) {
    var best = null, max = 0;
    (kb.sujets || []).forEach(function (s) { var sc = score(nq, s); if (sc > max) { max = sc; best = s; } });
    return best;
  }
  function reponseKB(sujet) { return { texte: sujet.reponse, actions: actionsDe(sujet.actions) }; }

  function reponseInconnue() { return { texte: kb.inconnu, actions: actionsContact() }; }

  function repondreLocal(question) {
    var nq = norm(question), r;
    var salue = /^(bonjour|bonsoir|salut|slt|coucou|hello|hey|salam)( |$)/.test(nq);
    if (/^(bonjour|bonsoir|salut|slt|coucou|hello|hey|salam)( malick)?( ca va)?$/.test(nq)) {
      return { texte: (nq.indexOf("ca va") !== -1 ? "Ça va bien, merci 😊 " : "Bonjour 👋 ") + "Comment puis-je " + (registre === "tu" ? "t’" : "vous ") + "aider ?", actions: [] };
    }
    if (/(^| )(merci|thanks|jerejef)( |$)/.test(nq)) {
      return { texte: "Avec plaisir 😊 N’hésitez pas si vous avez d’autres questions.".replace("N’hésitez pas si vous avez", registre === "tu" ? "N’hésite pas si tu as" : "N’hésitez pas si vous avez"), actions: [] };
    }
    if (/(au revoir|a bientot|bonne journee|bonne soiree)/.test(nq)) {
      return { texte: "Avec plaisir ! À bientôt chez Keur Yaye Rokhaya 👋", actions: [] };
    }
    var best = meilleurSujet(nq);
    if (best && PRIORITAIRES.indexOf(best.id) !== -1) r = reponseKB(best);
    if (!r) {
      var p = trouverProduit(nq);
      if (p) r = reponseProduit(p, nq);
    }
    if (!r) {
      var cite = iphoneCite(nq);
      if (cite) {
        r = { texte: "Je ne vois pas l’" + cite + " dans les produits affichés sur le site. Il n’est peut-être pas disponible ou pas encore listé : " + (registre === "tu" ? "demande" : "demandez") + " à l’équipe sur WhatsApp.", actions: [{ label: "Voir les iPhone", href: "index.html#nos-produits" }, { label: "Demander sur WhatsApp", href: KYR.lien("Bonjour Keur Yaye Rokhaya, avez-vous l’" + cite + " ? Pouvez-vous me confirmer la disponibilité et le prix ?", 1), ext: true }] };
      }
    }
    if (!r) { var cat = categorieCitee(nq); if (cat) r = reponseCategorie(cat, nq); }
    if (!r && best) r = reponseKB(best);
    if (!r) r = reponseInconnue();
    r.texte = formater(r.texte);
    if (salue && !/^(bonjour|bienvenue)/i.test(r.texte)) r.texte = "Bonjour 👋 " + r.texte;
    return r;
  }

  /* ---------- service IA sécurisé (facultatif) ---------- */
  function appelerApi() {
    var derniers = historique.slice(-10).map(function (m) { return { role: m.r === "u" ? "user" : "assistant", content: m.t }; });
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var minuteur = setTimeout(function () { if (ctrl) ctrl.abort(); }, CFG.delaiApiMs);
    return fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: derniers }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(minuteur);
      if (!r.ok) throw new Error("service");
      return r.json();
    }).then(function (j) {
      if (!j || typeof j.reply !== "string" || !j.reply.trim() || j.reply.length > 2000) throw new Error("réponse");
      var inconnu = /pas encore cette information|whatsapp|équipe/i.test(j.reply);
      return { texte: j.reply.trim(), actions: inconnu ? actionsContact() : [] };
    });
  }
  function repondre(question) {
    var local = repondreLocal(question);
    // Produits, prix, services, contact : toujours répondus depuis les données du site, jamais par l'IA.
    if (!CFG.apiUrl || local.texte.indexOf(formater(kb.inconnu)) === -1) return Promise.resolve(local);
    return appelerApi().then(function (r) { apiEnPanne = false; return r; }).catch(function () {
      var r = local;
      if (!apiEnPanne) { r.texte = "Mon service de réponses avancées est momentanément indisponible. Voici ce que je peux " + (registre === "tu" ? "te" : "vous") + " dire :\n\n" + r.texte; }
      apiEnPanne = true;
      return r;
    });
  }

  /* ---------- interface ---------- */
  function icone(chemin) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemin + "</svg>";
  }
  function enregistrer() {
    try { sessionStorage.setItem(CLE, JSON.stringify({ h: historique.slice(-CFG.historiqueMax), r: registre })); } catch (e) { /* stockage indisponible */ }
  }
  function restaurer() {
    try {
      var d = JSON.parse(sessionStorage.getItem(CLE) || "null");
      if (d && Array.isArray(d.h)) { historique = d.h; registre = d.r === "tu" ? "tu" : "vous"; }
    } catch (e) { historique = []; }
  }
  function defiler() { requestAnimationFrame(function () { ui.log.scrollTop = ui.log.scrollHeight; }); }

  function ajouterMessage(role, texte, actions, suggestions) {
    var m = el("div", "malick-msg " + (role === "u" ? "malick-user" : "malick-bot"));
    var b = el("div", "malick-bulle", texte);
    m.appendChild(b);
    if (actions && actions.length) {
      var zone = el("div", "malick-actions");
      actions.forEach(function (a) {
        var l = el("a", "malick-action", a.label);
        l.href = a.href;
        if (a.ext) { l.target = "_blank"; l.rel = "noopener"; }
        zone.appendChild(l);
      });
      m.appendChild(zone);
    }
    if (suggestions) {
      var s = el("div", "malick-suggestions");
      SUGGESTIONS.forEach(function (txt) {
        var c = el("button", "malick-chip", txt); c.type = "button";
        c.addEventListener("click", function () { envoyer(txt); });
        s.appendChild(c);
      });
      m.appendChild(s);
    }
    ui.log.appendChild(m);
    defiler();
    return m;
  }
  function retirerSuggestions() {
    Array.prototype.forEach.call(ui.log.querySelectorAll(".malick-suggestions"), function (n) { n.parentNode.removeChild(n); });
  }
  function indicateur(actif) {
    var ex = ui.log.querySelector(".malick-ecrit");
    if (actif && !ex) {
      var m = el("div", "malick-msg malick-bot malick-ecrit");
      m.appendChild(el("div", "malick-bulle", "Malick écrit…"));
      ui.log.appendChild(m); defiler();
    } else if (!actif && ex) { ex.parentNode.removeChild(ex); }
  }

  function envoyer(texte) {
    texte = String(texte || "").replace(/\s+/g, " ").trim().slice(0, CFG.messageMaxCaracteres);
    if (!texte || occupe) return;
    occupe = true;
    ui.bouton.disabled = true;
    retirerSuggestions();
    majRegistre(texte);
    historique.push({ r: "u", t: texte });
    ajouterMessage("u", texte);
    ui.champ.value = "";
    indicateur(true);
    var debut = Date.now();
    repondre(texte).then(function (r) {
      var attente = Math.max(0, (CFG.apiUrl ? 0 : CFG.delaiMs) - (Date.now() - debut));
      return new Promise(function (ok) { setTimeout(function () { ok(r); }, attente); });
    }).then(function (r) {
      indicateur(false);
      historique.push({ r: "b", t: r.texte, a: r.actions });
      ajouterMessage("b", r.texte, r.actions);
      enregistrer();
    }).catch(function () {
      indicateur(false);
      var r = reponseInconnue(); r.texte = formater(r.texte);
      historique.push({ r: "b", t: r.texte, a: r.actions });
      ajouterMessage("b", r.texte, r.actions);
    }).then(function () {
      occupe = false;
      ui.bouton.disabled = false;
      if (ouvert && !window.matchMedia("(pointer: coarse)").matches) ui.champ.focus();
    });
  }

  function construire() {
    var panneau = el("div", "malick");
    panneau.id = "malick"; panneau.hidden = true;
    panneau.setAttribute("role", "dialog");
    panneau.setAttribute("aria-labelledby", "malick-titre");

    var entete = el("div", "malick-entete");
    var av = el("span", "malick-avatar", "M"); av.setAttribute("aria-hidden", "true");
    var qui = el("div", "malick-qui");
    var nom = el("strong", "", "Malick"); nom.id = "malick-titre";
    qui.appendChild(nom); qui.appendChild(el("span", "", "Assistant Keur Yaye Rokhaya"));
    var fermer = el("button", "malick-fermer"); fermer.type = "button";
    fermer.setAttribute("aria-label", "Fermer le chat");
    fermer.innerHTML = icone('<path d="M6 6l12 12M18 6L6 18"/>');
    entete.appendChild(av); entete.appendChild(qui); entete.appendChild(fermer);

    var log = el("div", "malick-log");
    log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite"); log.tabIndex = 0;

    var form = el("form", "malick-form"); form.setAttribute("novalidate", "");
    var champ = document.createElement("input");
    champ.type = "text"; champ.className = "malick-champ"; champ.maxLength = CFG.messageMaxCaracteres;
    champ.placeholder = "Écrivez votre message…"; champ.autocomplete = "off"; champ.enterKeyHint = "send";
    champ.setAttribute("aria-label", "Votre message à Malick");
    var bouton = el("button", "malick-envoi"); bouton.type = "submit";
    bouton.setAttribute("aria-label", "Envoyer le message");
    bouton.innerHTML = icone('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>');
    form.appendChild(champ); form.appendChild(bouton);

    var note = el("p", "malick-note", "Malick est un assistant virtuel. Ne partagez pas d’informations personnelles ici.");

    panneau.appendChild(entete); panneau.appendChild(log); panneau.appendChild(form); panneau.appendChild(note);
    document.body.appendChild(panneau);

    ui = { panneau: panneau, log: log, champ: champ, bouton: bouton, fermer: fermer };

    fermer.addEventListener("click", fermerChat);
    form.addEventListener("submit", function (e) { e.preventDefault(); envoyer(champ.value); });
    panneau.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); fermerChat(); return; }
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call(panneau.querySelectorAll("button, a[href], input"), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var premier = f[0], dernier = f[f.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    });

    // contenu initial
    if (historique.length) {
      historique.forEach(function (m) { ajouterMessage(m.r, m.t, m.a); });
    } else {
      ajouterMessage("b", formater(kb.accueil), [], true);
    }
  }

  function ajusterClavier() {
    if (!ui) return;
    var v = window.visualViewport;
    if (v && window.matchMedia("(max-width: 819px)").matches) {
      ui.panneau.style.height = v.height + "px";
      ui.panneau.style.top = v.offsetTop + "px";
    } else { ui.panneau.style.height = ""; ui.panneau.style.top = ""; }
    defiler();
  }

  function ouvrir(source) {
    if (ouvert) return;
    declencheur = source || null;
    if (!ui) {
      restaurer();
      if (!kb) { return; }
      construire();
    }
    ui.panneau.hidden = false;
    ouvert = true;
    document.documentElement.classList.add("malick-ouvert");
    if (declencheur) declencheur.setAttribute("aria-expanded", "true");
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", ajusterClavier); window.visualViewport.addEventListener("scroll", ajusterClavier); }
    ajusterClavier();
    defiler();
    if (!window.matchMedia("(pointer: coarse)").matches) ui.champ.focus(); else ui.log.focus();
  }
  function fermerChat() {
    if (!ouvert) return;
    ui.panneau.hidden = true;
    ouvert = false;
    document.documentElement.classList.remove("malick-ouvert");
    if (window.visualViewport) { window.visualViewport.removeEventListener("resize", ajusterClavier); window.visualViewport.removeEventListener("scroll", ajusterClavier); }
    if (declencheur) { declencheur.setAttribute("aria-expanded", "false"); declencheur.focus(); }
  }

  window.Malick = {
    ouvrir: function (source) {
      if (kb) return ouvrir(source);
      chargerDonnees(function (ok) {
        if (!ok) { if (source) window.open(KYR.lien("Bonjour Keur Yaye Rokhaya, j’ai une question."), "_blank", "noopener"); return; }
        ouvrir(source);
      });
    },
    fermer: fermerChat,
    _repondreLocal: repondreLocal   // utilisé par les tests
  };
})();
