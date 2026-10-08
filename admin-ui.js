/* Administration — Keur Yaye Rokhaya : interface partagée (navigation, routeur, états, tableaux, dialogues, tableau de bord).

   PRINCIPES
   - LECTURE SEULE. Ce fichier n'écrit rien dans Supabase : aucun insert / update / upsert / delete, aucun appel à une fonction métier qui écrit.
     Les seules fonctions appelées sont les 4 fonctions de lecture reconnues sûres (STABLE, n'atteignant que du STABLE) :
     staff_list_orders, staff_get_order, staff_list_team, staff_search_customers (+ my_roles dans admin.js).
   - Le navigateur ne décide ni du rôle, ni des droits, ni des prix, ni du stock : le rôle sert à CHOISIR LES SECTIONS AFFICHÉES (repère d'interface).
     Chaque lecture est de toute façon contrôlée par Supabase (RLS, require_permission, AAL2) ; un refus s'affiche tel quel.
   - Toutes les données reçues sont écrites avec textContent / createElement : jamais innerHTML.
   - Rien n'est stocké dans le navigateur (ni rôle, ni données).
   - Aucune donnée n'est inventée : une valeur indisponible s'affiche « — », une fonctionnalité non branchée s'affiche « Module en préparation ». */
(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const client = function () { return window.KYR_SUPABASE; };

  // ---------- Construction DOM sûre ----------
  function el(tag, attrs, enfants) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "text") n.textContent = String(v);
        else if (k === "class") n.className = String(v);
        else if (k === "clic") n.addEventListener("click", v);
        else n.setAttribute(k, v === true ? "" : String(v));
      });
    }
    (enfants || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  // ---------- Libellés ----------
  const LIBELLES = {
    id: "Identifiant", order_number: "N° commande", customer_number: "N° client", customer_name: "Client", first_name: "Prénom", last_name: "Nom",
    phone_masked: "Téléphone", email: "E-mail", status: "Statut", items_count: "Articles", total_indicative_fcfa: "Total indicatif", total_confirmed_fcfa: "Total confirmé",
    prices_to_confirm: "Prix à confirmer", created_at: "Créé le", updated_at: "Modifié le", at: "Date", actor_role: "Rôle", action: "Action", table_name: "Table",
    record_id: "Enregistrement", details: "Détails", role: "Rôle", active: "Actif", user_id: "Utilisateur", name: "Nom", slug: "Identifiant court", price_fcfa: "Prix",
  };
  const STATUTS = {
    requested: "Demande reçue", confirmed: "Confirmée", preparing: "En préparation", ready: "Prête", delivered: "Livrée", cancelled: "Annulée",
    draft: "Brouillon", issued: "Émise", partially_paid: "Partiellement payée", paid: "Payée", pending: "À venir", overdue: "En retard",
  };
  const STATUTS_COMMANDE = ["requested", "confirmed", "preparing", "ready", "delivered", "cancelled"];
  const RE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function libelleColonne(c) { return LIBELLES[c] || (c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ")); }

  function valeurAffichee(col, v) {
    if (v === null || v === undefined || v === "") return { texte: "—" };
    if (typeof v === "boolean") return { texte: v ? "Oui" : "Non" };
    if (typeof v === "number") return { texte: /_fcfa$/i.test(col) ? v.toLocaleString("fr-FR") + " FCFA" : v.toLocaleString("fr-FR") };
    if (typeof v === "string") {
      if (RE_DATE.test(v)) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return { texte: d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }), titre: v };
      }
      if (RE_UUID.test(v)) return { texte: v.slice(0, 8) + "…", titre: v };
      if (col === "status" && STATUTS[v]) return { texte: STATUTS[v], titre: v, badge: true };
      return v.length > 140 ? { texte: v.slice(0, 140) + "…", titre: v.slice(0, 600) } : { texte: v };
    }
    let j; try { j = JSON.stringify(v); } catch (e) { j = "[données]"; }
    return j.length > 80 ? { texte: j.slice(0, 80) + "…", titre: j.slice(0, 600) } : { texte: j };
  }

  // ---------- Erreurs : messages en français, jamais d'erreur SQL brute ----------
  const MESSAGES = {
    KYR_UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous.",
    KYR_MFA_REQUIRED: "Authentification renforcée requise : validez votre code à 6 chiffres.",
    KYR_FORBIDDEN: "Accès non autorisé pour votre rôle.",
    KYR_NOT_FOUND: "Élément introuvable.",
    KYR_ORDER_NOT_FOUND: "Commande introuvable.",
    KYR_ORDER_CANCELLED: "Cette commande est annulée.",
    KYR_ORDER_PRICE_NOT_CONFIRMED: "Les prix de cette commande ne sont pas tous confirmés.",
    KYR_INVOICE_NOT_FOUND: "Facture introuvable.",
    KYR_INVOICE_ALREADY_EXISTS: "Une facture existe déjà pour cette commande.",
    KYR_PAYMENT_EXCEEDS_INVOICE: "Le paiement dépasse le montant restant de la facture.",
    KYR_INVALID_AMOUNT: "Montant invalide.",
    KYR_INSTALLMENT_ALREADY_EXISTS: "Cette échéance existe déjà.",
    KYR_INSTALLMENTS_EXCEED_INVOICE: "Les échéances dépassent le montant de la facture.",
    KYR_PAYMENT_OVERALLOCATED: "Ce paiement est déjà entièrement affecté.",
    KYR_INSTALLMENT_OVERALLOCATED: "Cette échéance est déjà entièrement payée.",
    KYR_INVALID: "Valeur invalide.",
    KYR_BAD_TRANSITION: "Ce changement n'est pas permis dans l'état actuel.",
  };

  function codeKyr(e) {
    const m = /KYR_[A-Z_]+/.exec(String((e && e.message) || "") + " " + String((e && e.details) || ""));
    return m ? m[0] : null;
  }

  function messageErreur(e) {
    const c = codeKyr(e);
    if (c && MESSAGES[c]) return MESSAGES[c];
    const code = String((e && e.code) || "");
    if (code === "PGRST205" || code === "42P01") return "Ces données ne sont pas disponibles sur ce projet : module en préparation.";
    const k = window.KYR_ADMIN && window.KYR_ADMIN.classer ? window.KYR_ADMIN.classer(e) : "INCONNUE";
    if (k === "FORBIDDEN") return MESSAGES.KYR_FORBIDDEN;
    if (k === "RESEAU") return "Connexion impossible pour le moment. Vérifiez votre réseau puis réessayez.";
    return "Une erreur est survenue. Réessayez.";
  }

  // ---------- États : chargement / vide / erreur / module en préparation ----------
  function chargement(zone, texte) {
    zone.textContent = "";
    zone.appendChild(el("div", { class: "adm-etat adm-etat-chargement", role: "status" }, [
      el("span", { class: "adm-squelette" }), el("span", { class: "adm-squelette adm-squelette-court" }), el("span", { class: "adm-sr", text: texte || "Chargement en cours…" }),
    ]));
  }

  function vide(zone, texte) {
    zone.textContent = "";
    zone.appendChild(el("div", { class: "adm-etat adm-etat-vide" }, [el("p", { text: texte || "Aucune donnée à afficher." })]));
  }

  function blocPreparation(elements, sujet) {
    return el("section", { class: "adm-prepa", "aria-label": "Module en préparation" }, [
      el("h3", { text: sujet ? "Module en préparation : " + sujet : "Module en préparation" }),
      el("p", { text: "Ces actions ne sont pas encore branchées au serveur : aucune écriture n'est simulée et aucune donnée n'est modifiée." }),
      el("ul", null, elements.map(function (t) { return el("li", { text: t }); })),
    ]);
  }

  async function gererErreur(zone, e, reessayer) {
    // Détails techniques : console uniquement, et seulement le code et le message (jamais de données).
    console.error("Administration — erreur de chargement :", String((e && (e.code || e.name)) || "?"), String((e && e.message) || "").slice(0, 140));
    let k = "INCONNUE";
    if (window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur) k = await window.KYR_ADMIN.reagirErreur(e);
    if (k === "UNAUTHENTICATED" || k === "MFA_REQUIRED") return;       // l'écran est géré par le noyau (admin.js)
    zone.textContent = "";
    const bloc = el("div", { class: "adm-etat adm-etat-erreur", role: "alert" }, [el("p", { text: messageErreur(e) })]);
    if (k !== "FORBIDDEN" && reessayer) bloc.appendChild(el("button", { type: "button", class: "adm-btn adm-btn-secondaire", text: "Réessayer", clic: reessayer }));
    zone.appendChild(bloc);
  }

  // Charge puis affiche. `valide` (facultatif) écarte les réponses périmées (navigation ou filtre changé entre-temps).
  async function charger(ctx, zone, chargeur, rendu, valide) {
    chargement(zone);
    try {
      const res = await chargeur();
      if (!ctx.actif() || (valide && !valide())) return;
      zone.textContent = "";
      rendu(res);
    } catch (e) {
      if (!ctx.actif() || (valide && !valide())) return;
      await gererErreur(zone, e, function () { return charger(ctx, zone, chargeur, rendu, valide); });
    }
  }

  // ---------- Tableaux ----------
  function tableau(lignes, opts) {
    opts = opts || {};
    const masquer = opts.masquer || [];
    let cols = (opts.colonnes && opts.colonnes.length)
      ? opts.colonnes.filter(function (c) { return lignes.some(function (l) { return c in l; }); })
      : Object.keys(lignes[0] || {});
    cols = cols.filter(function (c) { return masquer.indexOf(c) === -1; });
    if (opts.maxColonnes) cols = cols.slice(0, opts.maxColonnes);
    const table = el("table", { class: "adm-table" });
    table.appendChild(el("caption", { class: "adm-sr", text: opts.legende || "Tableau de données" }));
    const trh = el("tr");
    cols.forEach(function (c) { trh.appendChild(el("th", { scope: "col", text: (opts.libelles && opts.libelles[c]) || libelleColonne(c) })); });
    if (opts.actions && opts.actions.length) trh.appendChild(el("th", { scope: "col", text: "Actions" }));
    table.appendChild(el("thead", null, [trh]));
    const tbody = el("tbody");
    lignes.forEach(function (l) {
      const tr = el("tr");
      cols.forEach(function (c) {
        const v = valeurAffichee(c, l[c]);
        const td = el("td", { "data-libelle": (opts.libelles && opts.libelles[c]) || libelleColonne(c) });
        if (v.badge) td.appendChild(el("span", { class: "adm-badge", text: v.texte })); else td.textContent = v.texte;
        if (v.titre) td.setAttribute("title", v.titre);
        tr.appendChild(td);
      });
      if (opts.actions && opts.actions.length) {
        const td = el("td", { class: "adm-td-actions" });
        opts.actions.forEach(function (a) { td.appendChild(el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: a.libelle, clic: function () { a.clic(l); } })); });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return el("div", { class: "adm-table-wrap", role: "region", "aria-label": opts.legende || "Tableau de données", tabindex: "0" }, [table]);
  }

  function listeCles(objet) {
    const dl = el("dl", { class: "adm-cles" });
    Object.keys(objet || {}).forEach(function (k) {
      const v = objet[k];
      dl.appendChild(el("dt", { text: libelleColonne(k) }));
      if (v !== null && typeof v === "object") {
        let j; try { j = JSON.stringify(v, null, 2); } catch (e) { j = "[données]"; }
        dl.appendChild(el("dd", null, [el("pre", { class: "adm-pre", text: j.length > 4000 ? j.slice(0, 4000) + "\n…" : j })]));
      } else {
        dl.appendChild(el("dd", { text: valeurAffichee(k, v).texte }));
      }
    });
    return dl;
  }

  function pagination(p, onChange) {
    const suivantPossible = p.total !== null && p.total !== undefined ? (p.page + 1) * p.taille < p.total : p.nb >= p.taille;
    const texte = p.total !== null && p.total !== undefined
      ? "Page " + (p.page + 1) + " sur " + Math.max(1, Math.ceil(p.total / p.taille)) + " — " + p.total.toLocaleString("fr-FR") + " ligne(s)"
      : "Page " + (p.page + 1);
    return el("nav", { class: "adm-pagination", "aria-label": "Pagination" }, [
      el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Précédent", disabled: p.page === 0, clic: function () { onChange(p.page - 1); } }),
      el("span", { class: "adm-pagination-texte", text: texte }),
      el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Suivant", disabled: !suivantPossible, clic: function () { onChange(p.page + 1); } }),
    ]);
  }

  // ---------- Dialogues et notifications ----------
  function dialogue(opts) {
    const d = $("adm-dialog");
    $("adm-dialog-titre").textContent = opts.titre || "";
    const corps = $("adm-dialog-corps"); corps.textContent = ""; if (opts.corps) corps.appendChild(opts.corps);
    const act = $("adm-dialog-actions"); act.textContent = "";
    (opts.actions || [{ libelle: "Fermer" }]).forEach(function (a) {
      act.appendChild(el("button", {
        type: "button", class: "adm-btn " + (a.danger ? "adm-btn-danger" : (a.principal ? "adm-btn-primaire" : "adm-btn-secondaire")), text: a.libelle,
        clic: function () { if (a.clic) a.clic(); if (!a.garder) d.close(); },
      }));
    });
    if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
    $("adm-dialog-titre").focus();
  }

  // Confirmation avant une action destructive (disponible pour les futurs modules d'écriture ; aucune action de ce type n'est branchée aujourd'hui).
  function confirmer(opts) {
    return new Promise(function (resolve) {
      const d = $("adm-dialog");
      function fin() { d.removeEventListener("close", fin); resolve(false); }
      d.addEventListener("close", fin);
      dialogue({
        titre: opts.titre, corps: el("p", { text: opts.message }),
        actions: [
          { libelle: "Annuler", clic: function () { resolve(false); } },
          { libelle: opts.libelle || "Confirmer", danger: !!opts.danger, principal: !opts.danger, clic: function () { resolve(true); } },
        ],
      });
    });
  }

  function toast(texte, type) {
    const t = el("div", { class: "adm-toast adm-toast-" + (type || "info"), text: texte });
    $("adm-toasts").appendChild(t);
    window.setTimeout(function () { t.remove(); }, 5000);
  }

  // ---------- Lecture d'une table (RLS) avec pagination, tri récent d'abord ----------
  async function lireTable(table, opts) {
    opts = opts || {};
    const taille = opts.taille || 25, page = opts.page || 0;
    const colsTri = opts.tri || ["created_at", "at"];
    let dernier = null;
    const essais = colsTri.concat([null]);
    for (let i = 0; i < essais.length; i++) {
      let q = client().from(table).select("*", { count: "exact" });
      (opts.filtres || []).forEach(function (f) { q = f(q); });
      if (essais[i]) q = q.order(essais[i], { ascending: false });
      q = q.range(page * taille, page * taille + taille - 1);
      const r = await q;
      if (!r.error) return { lignes: r.data || [], total: typeof r.count === "number" ? r.count : null };
      dernier = r.error;
      if (String(r.error.code) !== "42703" || !essais[i]) break;      // 42703 = colonne de tri inexistante : on essaie la suivante, puis sans tri
    }
    throw dernier;
  }

  // ---------- Liste paginée générique (tables et fonctions) ----------
  function liste(corps, ctx, cfg) {
    const etat = { page: 0, valeurs: {}, recherche: "", seq: 0 };
    const taille = cfg.taille || 25;
    corps.textContent = "";
    if (cfg.intro) corps.appendChild(el("p", { class: "adm-intro", text: cfg.intro }));
    const barre = el("div", { class: "adm-barre-outils" });
    (cfg.filtres || []).forEach(function (f) {
      const sel = el("select", { class: "adm-champ", id: "adm-f-" + f.cle, "aria-label": f.libelle });
      f.options.forEach(function (o) { sel.appendChild(el("option", { value: o[0], text: o[1] })); });
      sel.addEventListener("change", function () { etat.valeurs[f.cle] = sel.value; etat.page = 0; recharger(); });
      barre.appendChild(el("label", { class: "adm-etiquette" }, [el("span", { text: f.libelle }), sel]));
    });
    if (cfg.recherche) {
      let minuterie = null;
      const champ = el("input", { type: "search", class: "adm-champ", placeholder: cfg.recherche.placeholder || "Rechercher", "aria-label": cfg.recherche.libelle || "Rechercher", maxlength: "60" });
      champ.addEventListener("input", function () {
        window.clearTimeout(minuterie);
        minuterie = window.setTimeout(function () { etat.recherche = champ.value.trim().slice(0, 60); etat.page = 0; recharger(); }, 400);
      });
      barre.appendChild(el("label", { class: "adm-etiquette" }, [el("span", { text: cfg.recherche.libelle || "Recherche" }), champ]));
    }
    if (cfg.dates) {
      [["du", "Du"], ["au", "Au"]].forEach(function (d) {
        const inp = el("input", { type: "date", class: "adm-champ", "aria-label": d[1] });
        inp.addEventListener("change", function () { etat.valeurs[d[0]] = inp.value; etat.page = 0; recharger(); });
        barre.appendChild(el("label", { class: "adm-etiquette" }, [el("span", { text: d[1] }), inp]));
      });
    }
    const champPage = el("input", { type: "search", class: "adm-champ", placeholder: "Filtrer cette page", "aria-label": "Filtrer les lignes de la page affichée" });
    barre.appendChild(el("label", { class: "adm-etiquette" }, [el("span", { text: "Filtrer la page" }), champPage]));
    corps.appendChild(barre);
    const zone = el("div", { class: "adm-resultat", "aria-live": "polite" });
    corps.appendChild(zone);
    if (cfg.preparation && ctx.role === "owner") corps.appendChild(blocPreparation(cfg.preparation, cfg.titrePreparation));

    function appliquerFiltrePage() {
      const t = champPage.value.trim().toLowerCase();
      Array.prototype.forEach.call(zone.querySelectorAll("tbody tr"), function (tr) { tr.hidden = t !== "" && tr.textContent.toLowerCase().indexOf(t) === -1; });
    }
    function rendre(res) {
      const lignes = res.lignes || [];
      if (lignes.length === 0) {
        vide(zone, cfg.vide || "Aucune donnée à afficher.");
      } else {
        const actions = cfg.actionsLigne || [{ libelle: "Détails", clic: function (l) { dialogue({ titre: "Détails", corps: listeCles(l) }); } }];
        zone.appendChild(tableau(lignes, { colonnes: cfg.colonnes, libelles: cfg.libelles, masquer: cfg.masquer, actions: actions, legende: cfg.legende || cfg.titre }));
      }
      if (lignes.length > 0 || etat.page > 0) zone.appendChild(pagination({ page: etat.page, taille: taille, total: res.total, nb: lignes.length }, function (p) { etat.page = p; recharger(); }));
      appliquerFiltrePage();
    }
    function recharger() {
      const mon = ++etat.seq;
      charger(ctx, zone, function () { return cfg.charger({ page: etat.page, taille: taille, valeurs: etat.valeurs, recherche: etat.recherche }); }, rendre, function () { return mon === etat.seq; });
    }
    champPage.addEventListener("input", appliquerFiltrePage);
    recharger();
  }

  function listeTable(corps, ctx, cfg) {
    liste(corps, ctx, Object.assign({}, cfg, {
      charger: function (p) {
        const filtres = (cfg.filtres || []).filter(function (f) { return p.valeurs[f.cle]; }).map(function (f) { return function (q) { return f.appliquer(q, p.valeurs[f.cle]); }; });
        if (cfg.recherche && p.recherche) filtres.push(function (q) { return cfg.recherche.appliquer(q, p.recherche); });
        (cfg.filtresPlus ? cfg.filtresPlus(p.valeurs) : []).forEach(function (f) { filtres.push(f); });
        return lireTable(cfg.table, { page: p.page, taille: p.taille, filtres: filtres, tri: cfg.tri });
      },
    }));
  }

  // ---------- Tableau de bord (lectures seules ; chaque indicateur indépendant ; rien d'inventé) ----------
  async function compter(table, filtre) {
    let q = client().from(table).select("*", { count: "exact", head: true });
    if (filtre) q = filtre(q);
    const r = await q;
    if (r.error) throw r.error;
    return r.count;
  }

  function vueTableau(corps, ctx) {
    corps.textContent = "";
    corps.appendChild(el("p", { class: "adm-intro", text: "Vue d'ensemble calculée à partir des données réelles de Supabase. Une valeur « — » signifie que la donnée n'est pas disponible : aucun chiffre n'est inventé." }));
    const grille = el("div", { class: "adm-kpis" });
    corps.appendChild(grille);
    const cartes = {};
    function carte(cle, titre, note) {
      const valeur = el("p", { class: "adm-kpi-valeur", text: "…" });
      const n = el("p", { class: "adm-kpi-note", text: note || "" });
      grille.appendChild(el("article", { class: "adm-kpi" }, [el("h3", { class: "adm-kpi-titre", text: titre }), valeur, n]));
      cartes[cle] = { valeur: valeur, note: n };
      return cartes[cle];
    }
    function fixer(cle, v, note) { if (!ctx.actif()) return; cartes[cle].valeur.textContent = v; if (note !== undefined) cartes[cle].note.textContent = note; }
    async function echec(cle, e) {
      if (!ctx.actif()) return;
      console.error("Administration — indicateur indisponible :", String((e && (e.code || e.name)) || "?"), String((e && e.message) || "").slice(0, 120));
      const k = window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur ? await window.KYR_ADMIN.reagirErreur(e) : "INCONNUE";
      if (!ctx.actif()) return;
      fixer(cle, "—", k === "FORBIDDEN" ? "Non autorisé pour votre rôle" : (k === "RESEAU" ? "Indisponible (réseau)" : "Indisponible"));
    }
    const defs = [
      ["produits", "Produits", "dans le catalogue", function () { return compter("products"); }],
      ["variantes", "Variantes", "toutes capacités et couleurs", function () { return compter("product_variants"); }],
      ["inventaire", "Lignes d'inventaire", "une par variante suivie", function () { return compter("inventory"); }],
      ["paiements", "Paiements enregistrés", "nombre d'enregistrements", function () { return compter("payments"); }],
      ["fact_emises", "Factures émises", "statut « émise » (non soldées)", function () { return compter("invoices", function (q) { return q.eq("status", "issued"); }); }],
      ["fact_partielles", "Factures partiellement payées", "statut « partiellement payée »", function () { return compter("invoices", function (q) { return q.eq("status", "partially_paid"); }); }],
      ["ech_venir", "Échéances à venir", "statut « à venir »", function () { return compter("installments", function (q) { return q.eq("status", "pending"); }); }],
      ["ech_retard", "Échéances en retard", "statut « en retard »", function () { return compter("installments", function (q) { return q.eq("status", "overdue"); }); }],
    ];
    defs.forEach(function (d) {
      carte(d[0], d[1], d[2]);
      d[3]().then(function (n) { fixer(d[0], Number(n).toLocaleString("fr-FR")); }, function (e) { return echec(d[0], e); });
    });
    [["stock_total", "Stock total"], ["sans_stock", "Produits sans stock"], ["actifs", "Produits actifs"]].forEach(function (d) {
      carte(d[0], d[1], "Module en préparation").valeur.textContent = "—";
    });

    // Commandes par statut : un seul appel (fonction de lecture sûre), 100 dernières commandes au maximum.
    const blocCmd = el("section", { class: "adm-bloc", "aria-labelledby": "adm-bloc-cmd" }, [el("h3", { id: "adm-bloc-cmd", text: "Commandes" })]);
    const zoneCmd = el("div"); blocCmd.appendChild(zoneCmd); corps.appendChild(blocCmd);
    charger(ctx, zoneCmd, async function () {
      const r = await client().rpc("staff_list_orders", { p_status: null, p_limit: 100, p_offset: 0 });
      if (r.error) throw r.error;
      return r.data || [];
    }, function (lignes) {
      if (lignes.length === 0) { vide(zoneCmd, "Aucune commande enregistrée pour le moment."); return; }
      const compteurs = el("div", { class: "adm-compteurs" });
      STATUTS_COMMANDE.forEach(function (s) {
        const n = lignes.filter(function (l) { return l.status === s; }).length;
        compteurs.appendChild(el("div", { class: "adm-compteur" }, [el("strong", { text: String(n) }), el("span", { text: STATUTS[s] })]));
      });
      zoneCmd.appendChild(compteurs);
      const confirmes = lignes.filter(function (l) { return l.status !== "cancelled" && typeof l.total_confirmed_fcfa === "number"; });
      const somme = confirmes.reduce(function (t, l) { return t + l.total_confirmed_fcfa; }, 0);
      zoneCmd.appendChild(el("p", { class: "adm-note", text: (lignes.length >= 100 ? "Calculé sur les 100 dernières commandes. " : lignes.length + " commande(s) au total. ") + "Total confirmé (hors annulées) : " + somme.toLocaleString("fr-FR") + " FCFA." }));
      zoneCmd.appendChild(el("h4", { text: "Dernières commandes" }));
      zoneCmd.appendChild(tableau(lignes.slice(0, 5), { colonnes: ["order_number", "status", "customer_name", "total_confirmed_fcfa", "created_at"], legende: "Dernières commandes" }));
    });

    // Dernières opérations financières et derniers événements d'audit : lectures simples, tableaux courts.
    [["Dernières opérations financières", "payments", { maxColonnes: 6 }], ["Derniers événements d'audit", "audit_log", { colonnes: ["at", "actor_role", "action", "table_name"] }]].forEach(function (b, i) {
      const bloc = el("section", { class: "adm-bloc", "aria-labelledby": "adm-bloc-" + i }, [el("h3", { id: "adm-bloc-" + i, text: b[0] })]);
      const zone = el("div"); bloc.appendChild(zone); corps.appendChild(bloc);
      charger(ctx, zone, function () { return lireTable(b[1], { taille: 5 }); }, function (res) {
        if (res.lignes.length === 0) vide(zone, "Aucune donnée pour le moment."); else zone.appendChild(tableau(res.lignes, Object.assign({ legende: b[0] }, b[2])));
      });
    });
  }

  // ---------- Navigation, routeur, menu mobile ----------
  const TOUS = ["owner", "admin"], PROPRIO = ["owner"];
  const VUES = [
    { id: "tableau", titre: "Tableau de bord", groupe: null, roles: TOUS },
    { id: "produits", titre: "Produits", groupe: "Catalogue", roles: TOUS, module: "catalogue" },
    { id: "variantes", titre: "Variantes et capacités", groupe: "Catalogue", roles: TOUS, module: "catalogue" },
    { id: "marques", titre: "Marques", groupe: "Catalogue", roles: TOUS, module: "catalogue" },
    { id: "categories", titre: "Catégories", groupe: "Catalogue", roles: TOUS, module: "catalogue" },
    { id: "stock", titre: "Stock global", groupe: "Stock", roles: TOUS, module: "catalogue" },
    { id: "imei", titre: "Inventaire et IMEI", groupe: "Stock", roles: TOUS, module: "catalogue" },
    { id: "clients", titre: "Clients", groupe: "Clients", roles: TOUS, module: "ventes" },
    { id: "commandes", titre: "Commandes", groupe: "Commandes", roles: TOUS, module: "ventes" },
    { id: "paiements", titre: "Paiements", groupe: "Finance", roles: TOUS, module: "finance" },
    { id: "echeanciers", titre: "Échéanciers", groupe: "Finance", roles: TOUS, module: "finance" },
    { id: "factures", titre: "Factures", groupe: "Finance", roles: TOUS, module: "finance" },
    { id: "equipe", titre: "Équipe et rôles", groupe: "Administration", roles: PROPRIO, module: "gestion" },
    { id: "audit", titre: "Audit", groupe: "Administration", roles: TOUS, module: "gestion" },
    { id: "parametres", titre: "Paramètres", groupe: "Administration", roles: PROPRIO, module: "gestion" },
  ];
  const FICHIERS = { catalogue: "admin-catalogue.js", ventes: "admin-ventes.js", finance: "admin-finance.js", gestion: "admin-gestion.js" };
  const etat = { role: null, entre: false, compteur: 0, courant: 0, modules: {}, promesses: {} };

  function chargerModule(nom) {
    if (etat.modules[nom]) return Promise.resolve();
    if (!etat.promesses[nom]) {
      etat.promesses[nom] = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = FICHIERS[nom];                                     // nom de fichier constant (jamais une donnée reçue)
        s.onload = resolve;
        s.onerror = function () { delete etat.promesses[nom]; reject(new Error("module introuvable")); };
        document.head.appendChild(s);
      });
    }
    return etat.promesses[nom];
  }

  function enregistrer(nom, vues) { etat.modules[nom] = vues; }

  function construireNav() {
    const ul = $("adm-nav"); ul.textContent = "";
    let groupe;
    VUES.filter(function (v) { return v.roles.indexOf(etat.role) !== -1; }).forEach(function (v) {
      if (v.groupe && v.groupe !== groupe) ul.appendChild(el("li", { class: "adm-nav-groupe", text: v.groupe }));
      groupe = v.groupe;
      ul.appendChild(el("li", null, [el("a", { class: "adm-nav-lien", href: "#/" + v.id, "data-vue": v.id, text: v.titre })]));
    });
  }

  function marquerNav(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".adm-nav-lien"), function (a) {
      if (a.getAttribute("data-vue") === id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function ouvrirMenu() { $("adm-side").classList.add("ouvert"); $("adm-menu-btn").setAttribute("aria-expanded", "true"); $("adm-voile").hidden = false; window.setTimeout(function () { const a = document.querySelector(".adm-side .adm-nav-lien"); if (a && $("adm-side").classList.contains("ouvert")) a.focus(); }, 260); }
  function fermerMenu() { const s = $("adm-side"); if (!s) return; s.classList.remove("ouvert"); $("adm-menu-btn").setAttribute("aria-expanded", "false"); $("adm-voile").hidden = true; }

  function route() {
    if (!etat.entre) return;
    const id = (window.location.hash.replace(/^#\/?/, "") || "tableau").split("?")[0];
    const vue = VUES.filter(function (v) { return v.id === id; })[0] || VUES[0];
    const mon = ++etat.compteur; etat.courant = mon;
    const ctx = { actif: function () { return etat.entre && etat.courant === mon; }, role: etat.role };
    marquerNav(vue.id); fermerMenu();
    const zone = $("adm-vue"); zone.textContent = "";
    const titre = el("h2", { id: "adm-vue-titre", tabindex: "-1", text: vue.titre });
    zone.appendChild(el("header", { class: "adm-vue-entete" }, [titre, el("span", { class: "adm-badge", text: vue.id === "tableau" ? "Lecture seule" : (vue.id === "parametres" ? "En préparation" : "Lecture") })]));
    const corps = el("div", { class: "adm-vue-corps" }); zone.appendChild(corps);
    titre.focus({ preventScroll: true });
    if (vue.roles.indexOf(etat.role) === -1) {
      corps.appendChild(el("div", { class: "adm-etat adm-etat-vide" }, [el("p", { text: "Cette section est réservée au propriétaire. Cet affichage est un repère : la sécurité réelle est contrôlée par Supabase." })]));
      return;
    }
    if (!vue.module) { vueTableau(corps, ctx); return; }
    chargement(corps);
    chargerModule(vue.module).then(function () {
      if (!ctx.actif()) return;
      const m = etat.modules[vue.module];
      if (m && m[vue.id]) m[vue.id](corps, ctx);
      else corps.appendChild(blocPreparation(["Cette section"], "Module en préparation"));
    }, function () {
      if (!ctx.actif()) return;
      corps.textContent = "";
      corps.appendChild(el("div", { class: "adm-etat adm-etat-erreur", role: "alert" }, [el("p", { text: "Impossible de charger ce module. Vérifiez votre connexion puis réessayez." }), el("button", { type: "button", class: "adm-btn adm-btn-secondaire", text: "Réessayer", clic: route })]));
    });
  }

  // Appelés par le noyau (admin.js) : entrer = session et AAL2 vérifiés ; quitter = on vide tout (MFA perdue, refus, déconnexion).
  function entrer(ctx) {
    if (etat.entre && etat.role === ctx.role) return;                 // évaluation répétée : on ne recharge rien
    etat.role = ctx.role; etat.entre = true;
    construireNav(); route();
  }
  function quitter() {
    etat.entre = false; etat.courant = -1; etat.role = null;
    const z = $("adm-vue"); if (z) z.textContent = "";
    const n = $("adm-nav"); if (n) n.textContent = "";
    const t = $("adm-toasts"); if (t) t.textContent = "";
    const d = $("adm-dialog"); if (d && d.open) d.close();
    fermerMenu();
  }

  function init() {
    window.addEventListener("hashchange", route);
    $("adm-menu-btn").addEventListener("click", function () { if ($("adm-side").classList.contains("ouvert")) fermerMenu(); else ouvrirMenu(); });
    $("adm-voile").addEventListener("click", fermerMenu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("adm-side").classList.contains("ouvert")) { fermerMenu(); $("adm-menu-btn").focus(); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.KYR_ADMIN_UI = Object.freeze({
    entrer: entrer, quitter: quitter, enregistrer: enregistrer,
    el: el, tableau: tableau, liste: liste, listeTable: listeTable, lireTable: lireTable, listeCles: listeCles, charger: charger, chargement: chargement, vide: vide,
    blocPreparation: blocPreparation, gererErreur: gererErreur, messageErreur: messageErreur, dialogue: dialogue, confirmer: confirmer, toast: toast,
    valeurAffichee: valeurAffichee, libelleColonne: libelleColonne, STATUTS: STATUTS, STATUTS_COMMANDE: STATUTS_COMMANDE, RE_UUID: RE_UUID,
  });
})();
