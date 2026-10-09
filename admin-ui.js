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

  // Tons des badges de statut (vert = succès, ambre = attention, rouge = problème, violet = émis, neutre = autre ou inconnu).
  const TONS_STATUT = { requested: "ambre", confirmed: "vert", preparing: "ambre", ready: "vert", delivered: "vert", cancelled: "rouge", draft: "neutre", issued: "violet", partially_paid: "ambre", paid: "vert", pending: "ambre", overdue: "rouge" };
  const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

  function valeurAffichee(col, v, opts) {
    if ((v === null || v === undefined || v === "") && col === "total_confirmed_fcfa") return { texte: "Prix à confirmer" };
    if (v === null || v === undefined || v === "") return { texte: "—" };
    if (typeof v === "boolean") return { texte: v ? "Oui" : "Non" };
    if (typeof v === "number") return { texte: /_fcfa$/i.test(col) ? v.toLocaleString("fr-FR") + " FCFA" : v.toLocaleString("fr-FR"), nw: true };
    if (typeof v === "string") {
      if (RE_DATE.test(v)) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return { texte: (opts && opts.dateSeule) ? d.toLocaleDateString("fr-FR", { dateStyle: "short" }) : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }), titre: v, nw: true };
      }
      if (RE_JOUR.test(v)) {
        const j = new Date(v + "T00:00:00");
        if (!isNaN(j.getTime())) return { texte: j.toLocaleDateString("fr-FR", { dateStyle: "short" }), titre: v, nw: true };
      }
      if (RE_UUID.test(v)) return { texte: v.slice(0, 8) + "…", titre: v, nw: true };
      if (col === "status") return { texte: STATUTS[v] || v, titre: v, badge: true, ton: TONS_STATUT[v] || "neutre", nw: true };
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

  // Classification d'affichage (autonome : ne dépend pas du noyau). La décision de sécurité reste celle de Supabase et d'admin.js.
  function typeErreur(e) {
    if (window.KYR_ADMIN && window.KYR_ADMIN.classer) { try { return window.KYR_ADMIN.classer(e); } catch (x) { /* classification locale ci-dessous */ } }
    const t = String((e && e.message) || "") + " " + String((e && e.details) || ""), code = String((e && e.code) || "");
    if (/KYR_UNAUTHENTICATED/.test(t) || code === "28000" || /^PGRST30[0-9]$/.test(code) || /\bjwt\b.*(expired|invalid|malformed)/i.test(t) || (e && e.status === 401)) return "UNAUTHENTICATED";
    if (/KYR_MFA_REQUIRED/.test(t)) return "MFA_REQUIRED";                 // testé avant 42501 : KYR_MFA_REQUIRED partage ce code avec les refus de droits
    if (/KYR_FORBIDDEN/.test(t) || code === "42501" || (e && e.status === 403)) return "FORBIDDEN";
    if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(t) || (e && e.name === "AuthRetryableFetchError")) return "RESEAU";
    return "INCONNUE";
  }

  function messageErreur(e) {
    const c = codeKyr(e);
    if (c && MESSAGES[c]) return MESSAGES[c];
    const code = String((e && e.code) || "");
    if (code === "PGRST205" || code === "42P01") return "Ces données ne sont pas disponibles sur ce projet : module en préparation.";
    const k = typeErreur(e);
    if (k === "UNAUTHENTICATED") return MESSAGES.KYR_UNAUTHENTICATED;
    if (k === "MFA_REQUIRED") return MESSAGES.KYR_MFA_REQUIRED;
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
    return el("details", { class: "adm-prepa" }, [
      el("summary", { text: sujet ? "Module en préparation : " + sujet : "Module en préparation" }),
      el("p", { text: "Ces actions ne sont pas encore branchées au serveur : aucune écriture n'est simulée et aucune donnée n'est modifiée." }),
      el("ul", null, elements.map(function (t) { return el("li", { text: t }); })),
    ]);
  }

  async function gererErreur(zone, e, reessayer) {
    // Détails techniques : console uniquement, et seulement le code et le message (jamais de données).
    console.error("Administration — erreur de chargement :", String((e && (e.code || e.name)) || "?"), String((e && e.message) || "").slice(0, 140));
    let k = typeErreur(e);
    if (window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur) {
      k = await window.KYR_ADMIN.reagirErreur(e);
      if (k === "UNAUTHENTICATED" || k === "MFA_REQUIRED") return;     // l'écran est géré par le noyau (admin.js)
    }
    zone.textContent = "";
    const bloc = el("div", { class: "adm-etat adm-etat-erreur", role: "alert" }, [el("p", { text: messageErreur(e) })]);
    const b = boutonRepli(k, reessayer); if (b) bloc.appendChild(b);
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
        const v = valeurAffichee(c, l[c], { dateSeule: !!opts.dateSeule });
        const td = el("td", { "data-libelle": (opts.libelles && opts.libelles[c]) || libelleColonne(c), class: v.nw ? "adm-nw" : null });
        if (v.badge) td.appendChild(el("span", { class: "adm-badge adm-badge--" + (v.ton || "neutre"), text: v.texte })); else td.textContent = v.texte;
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

  // ---------- Tableau de bord propriétaire (LECTURE SEULE, données réelles) ----------
  // Règles de calcul (rappelées à l'écran sous chaque indicateur) :
  //  - CA confirmé      = somme de orders.total_confirmed_fcfa, hors commandes annulées et hors commandes dont le prix n'est pas confirmé.
  //  - Paiements encaissés = somme de payments.amount_fcfa pour les statuts de STATUTS_PAIEMENT_ENCAISSE (voir ci-dessous).
  //  - Stock disponible = pour chaque ligne d'inventaire, max(0, quantity - reserved_quantity) : jamais négatif.
  // Le CA et les paiements sont deux chiffres distincts : l'un n'est jamais présenté comme l'autre.
  // Ce qui ne peut pas être calculé de façon fiable s'affiche « Données indisponibles » : aucune valeur n'est inventée.
  const STATUT_COMMANDE_ANNULEE = "cancelled";
  // Valeurs de payments.status à compter comme « encaissé ». VOLONTAIREMENT VIDE : les valeurs réellement présentes en base n'ont pas encore été confirmées
  // et ne sont pas devinées. Tant que cette liste est vide, le détail par statut est affiché tel quel et le total encaissé reste « Données indisponibles ».
  const STATUTS_PAIEMENT_ENCAISSE = [];
  const STATUTS_ECHEANCE = ["pending", "overdue", "paid", "cancelled"], STATUTS_ECHEANCE_A_REGLER = ["pending", "overdue"];
  const STATUTS_FACTURE = ["draft", "issued", "partially_paid", "paid", "cancelled"], STATUTS_FACTURE_FACTUREE = ["issued", "partially_paid", "paid"], STATUTS_FACTURE_NON_SOLDEE = ["issued", "partially_paid"];
  const JOURS_ECHEANCE_PROCHE = 7, COMMANDES_PAR_PAGE = 100, COMMANDES_PAGES_MAX = 5;

  const nombre = function (n) { return Number(n).toLocaleString("fr-FR"); };
  const fcfa = function (n) { return nombre(n) + " FCFA"; };
  const pluriel = function (n, un, plusieurs) { return nombre(n) + " " + (n > 1 ? plusieurs : un); };
  const dateLocale = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function num(v) { if (v === null || v === undefined || v === "") return NaN; return typeof v === "number" ? v : Number(v); }
  function sommer(lignes, champ) { return lignes.reduce(function (t, l) { return t + num(l[champ]); }, 0); }
  function montantsFiables(lignes, champ) { return lignes.every(function (l) { return !isNaN(num(l[champ])); }); }
  function aColonnes(lignes, cols) { return lignes.length === 0 || cols.every(function (c) { return c in lignes[0]; }); }

  function parStatut(lignes, champ) {
    const m = {};
    lignes.forEach(function (l) {
      const s = l.status === null || l.status === undefined ? "(vide)" : String(l.status);
      if (!m[s]) m[s] = { statut: s, nb: 0, somme: 0, fiable: true };
      m[s].nb++;
      if (champ) { const n = num(l[champ]); if (isNaN(n)) m[s].fiable = false; else m[s].somme += n; }
    });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }

  // --- calculs purs (aucun appel réseau ; exposés pour les tests) ---
  function calculerVentes(cmd) {
    const l = cmd.lignes;
    if (!aColonnes(l, ["status", "total_confirmed_fcfa"])) return { indisponible: true };
    const actives = l.filter(function (x) { return x.status !== STATUT_COMMANDE_ANNULEE; });
    const retenues = actives.filter(function (x) { return !isNaN(num(x.total_confirmed_fcfa)); });
    return {
      total: l.length, complet: cmd.complet, nbAnnulees: l.length - actives.length, nbActives: actives.length, nbRetenues: retenues.length, nbSansPrix: actives.length - retenues.length,
      ca: retenues.reduce(function (t, x) { return t + num(x.total_confirmed_fcfa); }, 0), aTraiter: actives.filter(function (x) { return x.status === "requested"; }).length,
      prixAConfirmer: ("prices_to_confirm" in (l[0] || {})) ? actives.filter(function (x) { return num(x.prices_to_confirm) > 0; }).length : null, parStatut: parStatut(l),
    };
  }

  function calculerPaiements(rows, statutsEncaisses) {
    const retenus = statutsEncaisses || STATUTS_PAIEMENT_ENCAISSE;
    if (!aColonnes(rows, ["status", "amount_fcfa"])) return { indisponible: true };
    const groupes = parStatut(rows, "amount_fcfa");
    let encaisse = null;
    if (retenus.length > 0) {
      const ret = rows.filter(function (r) { return retenus.indexOf(r.status) !== -1; });
      encaisse = montantsFiables(ret, "amount_fcfa") ? { nb: ret.length, somme: sommer(ret, "amount_fcfa") } : null;
    }
    return { total: rows.length, parStatut: groupes, encaisse: encaisse };
  }

  function calculerStock(rows) {
    if (!aColonnes(rows, ["quantity", "reserved_quantity"])) return { indisponible: true };
    let disponible = 0, sansStock = 0, incoherentes = 0, invalides = 0, toutAZero = true;
    rows.forEach(function (r) {
      const q = num(r.quantity), res = num(r.reserved_quantity);
      if (isNaN(q) || isNaN(res)) { invalides++; return; }
      const d = q - res;
      if (d < 0) incoherentes++;
      const dispo = Math.max(0, d);
      disponible += dispo;
      if (dispo === 0) sansStock++;
      if (q !== 0 || res !== 0) toutAZero = false;
    });
    // « Non renseigné » : toutes les lignes sont à 0 et rien n'est réservé. Dès qu'une ligne a du stock, les lignes à 0 sont de vraies ruptures.
    return { lignes: rows.length, disponible: disponible, sansStock: sansStock, incoherentes: incoherentes, invalides: invalides, nonRenseigne: rows.length > 0 && invalides === 0 && toutAZero };
  }

  function calculerEcheances(rows, maintenant) {
    if (!aColonnes(rows, ["status", "due_date", "amount_fcfa"])) return { indisponible: true };
    const aujourdhui = dateLocale(maintenant), limite = dateLocale(new Date(maintenant.getTime() + JOURS_ECHEANCE_PROCHE * 864e5));
    const aRegler = rows.filter(function (r) { return STATUTS_ECHEANCE_A_REGLER.indexOf(r.status) !== -1; });
    const retard = aRegler.filter(function (r) { return r.status === "overdue" || (typeof r.due_date === "string" && r.due_date < aujourdhui); });
    const aVenir = aRegler.filter(function (r) { return retard.indexOf(r) === -1; });
    const proches = aVenir.filter(function (r) { return typeof r.due_date === "string" && r.due_date <= limite; });
    const pack = function (l) { return { nb: l.length, somme: sommer(l, "amount_fcfa"), fiable: montantsFiables(l, "amount_fcfa") }; };
    return { total: rows.length, aVenir: pack(aVenir), proches: pack(proches), retard: pack(retard), inconnus: rows.filter(function (r) { return STATUTS_ECHEANCE.indexOf(r.status) === -1; }).length };
  }

  function calculerFactures(rows) {
    if (!aColonnes(rows, ["status", "total_fcfa"])) return { indisponible: true };
    const facturees = rows.filter(function (r) { return STATUTS_FACTURE_FACTUREE.indexOf(r.status) !== -1; });
    const nonSoldees = rows.filter(function (r) { return STATUTS_FACTURE_NON_SOLDEE.indexOf(r.status) !== -1; });
    return {
      total: rows.length, nbFacturees: facturees.length, montantFacture: sommer(facturees, "total_fcfa"), fiableFacture: montantsFiables(facturees, "total_fcfa"),
      nbNonSoldees: nonSoldees.length, montantNonSolde: sommer(nonSoldees, "total_fcfa"), fiableNonSolde: montantsFiables(nonSoldees, "total_fcfa"),
      inconnus: rows.filter(function (r) { return STATUTS_FACTURE.indexOf(r.status) === -1; }).length,
    };
  }

  // Série pour le graphique : CA confirmé par jour (30 derniers jours) ou par mois (6 derniers mois), par date de création de la commande.
  function serieVentes(lignes, mode, maintenant) {
    const retenues = lignes.filter(function (l) { return l.status !== STATUT_COMMANDE_ANNULEE && !isNaN(num(l.total_confirmed_fcfa)) && l.created_at; });
    const seaux = [], index = {}, cleMois = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
    if (mode === "jours") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - i);
        index[dateLocale(d)] = seaux.length; seaux.push({ libelle: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"), ca: 0, nb: 0 });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
        index[cleMois(d)] = seaux.length; seaux.push({ libelle: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), ca: 0, nb: 0 });
      }
    }
    retenues.forEach(function (l) {
      const d = new Date(l.created_at); if (isNaN(d.getTime())) return;
      const cle = mode === "jours" ? dateLocale(d) : cleMois(d);
      if (cle in index) { seaux[index[cle]].ca += num(l.total_confirmed_fcfa); seaux[index[cle]].nb++; }
    });
    return seaux;
  }

  // Commandes REÇUES par jour sur les 30 derniers jours (hors annulées, par date de création) : comptage simple, aucun montant.
  function serieCommandes(lignes, maintenant) {
    const seaux = [], index = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - i);
      index[dateLocale(d)] = seaux.length; seaux.push({ libelle: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"), nb: 0 });
    }
    lignes.filter(function (l) { return l.status !== STATUT_COMMANDE_ANNULEE && l.created_at; }).forEach(function (l) {
      const d = new Date(l.created_at); if (isNaN(d.getTime())) return;
      const cle = dateLocale(d); if (cle in index) seaux[index[cle]].nb++;
    });
    return seaux;
  }

  // Trois ratios réels pour les anneaux. pct = null quand le ratio n'est pas calculable (jamais de pourcentage inventé).
  function calculerAnneaux(cmd, fac, ech) {
    const vide = function (cle, titre, raison) { return { cle: cle, titre: titre, pct: null, legende: raison }; };
    const sur = function (n, d, unite, unites, partiel) { return nombre(n) + " sur " + pluriel(d, unite, unites) + (partiel ? " · lecture partielle" : ""); };
    const sortie = [];
    const T1 = "Prix confirmés", T2 = "Factures soldées", T3 = "Échéances réglées";
    if (!cmd) sortie.push(vide("prix", T1, "Commandes non lisibles."));
    else {
      const v = calculerVentes(cmd);
      if (v.indisponible) sortie.push(vide("prix", T1, "Colonnes de commandes non accessibles."));
      else if (v.nbActives === 0) sortie.push(vide("prix", T1, "Aucune commande active."));
      else sortie.push({ cle: "prix", titre: T1, pct: Math.round(v.nbRetenues / v.nbActives * 100), legende: sur(v.nbRetenues, v.nbActives, "commande active", "commandes actives", !v.complet) });
    }
    if (!fac) sortie.push(vide("factures", T2, "Factures non lisibles."));
    else if (!aColonnes(fac.lignes, ["status"])) sortie.push(vide("factures", T2, "Colonnes de factures non accessibles."));
    else {
      const emises = fac.lignes.filter(function (r) { return STATUTS_FACTURE_FACTUREE.indexOf(r.status) !== -1; }), soldees = emises.filter(function (r) { return r.status === "paid"; });
      if (emises.length === 0) sortie.push(vide("factures", T2, "Aucune facture émise."));
      else sortie.push({ cle: "factures", titre: T2, pct: Math.round(soldees.length / emises.length * 100), legende: sur(soldees.length, emises.length, "facture émise", "factures émises", !fac.complet) });
    }
    if (!ech) sortie.push(vide("echeances", T3, "Échéances non lisibles."));
    else if (!aColonnes(ech.lignes, ["status"])) sortie.push(vide("echeances", T3, "Colonnes d'échéances non accessibles."));
    else {
      const reglees = ech.lignes.filter(function (r) { return r.status === "paid"; }).length, ouvertes = ech.lignes.filter(function (r) { return STATUTS_ECHEANCE_A_REGLER.indexOf(r.status) !== -1; }).length, total = reglees + ouvertes;
      if (total === 0) sortie.push(vide("echeances", T3, "Aucune échéance à suivre."));
      else sortie.push({ cle: "echeances", titre: T3, pct: Math.round(reglees / total * 100), legende: sur(reglees, total, "échéance", "échéances", !ech.complet) });
    }
    return sortie;
  }

  // --- lectures (SELECT via RLS et fonctions de lecture sûres) ---
  async function lireToutes(table, colonnes, opts) {
    opts = opts || {};
    const taille = 1000, maxPages = opts.maxPages || 5;
    let lignes = [], total = null;
    for (let p = 0; p < maxPages; p++) {
      let q = client().from(table).select(colonnes, { count: "exact" });
      if (opts.tri) q = q.order(opts.tri, { ascending: !!opts.croissant });
      const r = await q.range(p * taille, p * taille + taille - 1);
      if (r.error) throw r.error;
      const page = r.data || [];
      if (typeof r.count === "number") total = r.count;
      lignes = lignes.concat(page);
      if (page.length < taille) return { lignes: lignes, complet: true };
    }
    return { lignes: lignes, complet: total !== null && lignes.length >= total };
  }

  async function chargerCommandes() {
    let lignes = [];
    for (let p = 0; p < COMMANDES_PAGES_MAX; p++) {
      const r = await client().rpc("staff_list_orders", { p_status: null, p_limit: COMMANDES_PAR_PAGE, p_offset: p * COMMANDES_PAR_PAGE });
      if (r.error) throw r.error;
      const page = r.data || [];
      lignes = lignes.concat(page);
      if (page.length < COMMANDES_PAR_PAGE) return { lignes: lignes, complet: true };
    }
    return { lignes: lignes, complet: false };
  }

  async function chargerClients() {
    const res = await Promise.all([
      client().from("profiles").select("id", { count: "exact", head: true }),
      client().rpc("staff_search_customers", { p_query: null, p_limit: 2, p_offset: 0 }),
    ]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    const nb = res[0].count, vus = (res[1].data || []).length;
    // Contrôle de cohérence : si la recherche réserve plus de lignes que le comptage direct, l'accès direct aux profils est restreint et le comptage n'est pas fiable.
    return { nb: typeof nb === "number" && nb >= vus ? nb : null };
  }

  async function chargerPrenom() {
    const s = await client().auth.getSession();
    const uid = s && s.data && s.data.session && s.data.session.user && s.data.session.user.id;
    if (!uid || !RE_UUID.test(uid)) return null;
    const r = await client().from("profiles").select("first_name").eq("id", uid).maybeSingle();
    if (r.error || !r.data) return null;
    const p = String(r.data.first_name || "").trim();
    return p ? p.slice(0, 40) : null;                                  // jamais déduit de l'adresse e-mail
  }

  // Un jeu de données = une seule lecture, partagée entre tous les blocs du tableau de bord (en mémoire, jamais dans le navigateur).
  function creerSources() {
    const cache = {};
    function une(nom, fabrique) { if (!cache[nom]) cache[nom] = fabrique(); return cache[nom]; }
    return {
      oublier: function (nom) { delete cache[nom]; },
      commandes: function () { return une("commandes", chargerCommandes); },
      paiements: function () { return une("paiements", function () { return lireToutes("payments", "id,order_id,amount_fcfa,payment_method,status,paid_at,created_at", { tri: "created_at" }); }); },
      echeances: function () { return une("echeances", function () { return lireToutes("installments", "id,order_id,installment_number,amount_fcfa,due_date,status", { tri: "due_date", croissant: true }); }); },
      factures: function () { return une("factures", function () { return lireToutes("invoices", "id,invoice_number,status,issue_date,due_date,total_fcfa,created_at", { tri: "created_at" }); }); },
      stock: function () { return une("stock", function () { return lireToutes("inventory", "id,variant_id,quantity,reserved_quantity,updated_at"); }); },
      clients: function () { return une("clients", chargerClients); },
      audit: function () { return une("audit", function () { return lireTable("audit_log", { taille: 6 }); }); },
      prenom: function () { return une("prenom", chargerPrenom); },
    };
  }

  // --- composants d'affichage ---
  // Icônes de la pastille (tracés simples, décoratifs : aria-hidden). SVG créé par le DOM, jamais par innerHTML.
  const ICONES = {
    ca: "M4 20V10m6 10V4m6 16v-7m4 7H2", paiements: "M3 7.5h15a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5zm0 0L5.5 4H16m1 9.5h2", commandes: "M6 8h12l-1 12H7L6 8zm3 0V6.5a3 3 0 0 1 6 0V8",
    clients: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0m2-9a3 3 0 1 0 0-6m2.5 15a5 5 0 0 0-3-4.6", stock: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5 12 12l9-4.5M12 12v9",
    initial: "M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5", echeances: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4m8-4v4", factures: "M7 3h7l4 4v14H7V3zm7 0v4h4M9.5 12h5m-5 3.5h5",
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) { const e = document.createElementNS(SVG_NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function iconeSvg(nom) {
    const s = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }); s.appendChild(svgEl("path", { d: ICONES[nom] || ICONES.ca }));
    return el("span", { class: "adm-kpi-icone", "aria-hidden": "true" }, [s]);
  }

  function carteKpi(titre, opts) {
    opts = opts || {};
    const h = el("h3", { class: "adm-kpi-titre", text: titre }), valeur = el("p", { class: "adm-kpi-valeur", text: "…" }), note = el("p", { class: "adm-kpi-note" });
    const detail = el("ul", { class: "adm-kpi-detail" }), action = el("div", { class: "adm-kpi-action" });
    const blocDetail = opts.detailRepli ? el("details", { class: "adm-kpi-detail-d", hidden: true }, [el("summary", { text: opts.detailRepli }), detail]) : detail;   // détail replié (carte des paiements) : même contenu, moins de hauteur
    function majDetail() { if (opts.detailRepli) blocDetail.hidden = detail.childElementCount === 0; }
    const racine = el("article", { class: "adm-kpi adm-kpi--chargement" + (opts.classe ? " " + opts.classe : ""), "aria-busy": "true" }, [
      el("div", { class: "adm-kpi-tete" }, [opts.icone ? iconeSvg(opts.icone) : null, h]),
      valeur, note, blocDetail, action,
      opts.statut ? el("p", { class: "adm-kpi-statut", text: opts.statut }) : null,
      opts.aide ? el("details", { class: "adm-kpi-aide-d" }, [el("summary", { text: "Comment c'est calculé" }), el("p", { class: "adm-kpi-aide", text: opts.aide })]) : null,
      opts.lien ? el("a", { class: "adm-kpi-lien", href: opts.lien[0], text: opts.lien[1] }) : null,
    ]);
    function poser(texte) {                       // « 4 285 000 FCFA » : nombre en grand, unité en plus petit (texte identique pour les lecteurs d'écran)
      const m = /^(.*\d) (FCFA)$/.exec(String(texte));
      valeur.textContent = "";
      if (m) { valeur.appendChild(document.createTextNode(m[1])); valeur.appendChild(el("span", { class: "adm-kpi-unite", text: " " + m[2] })); } else valeur.textContent = texte;
    }
    function etat_(e) { racine.className = "adm-kpi adm-kpi--" + e + (opts.classe ? " " + opts.classe : ""); racine.setAttribute("aria-busy", e === "chargement" ? "true" : "false"); }
    return {
      racine: racine,
      titre: function (t) { h.textContent = t; },
      charger: function () { etat_("chargement"); poser("…"); note.textContent = ""; detail.textContent = ""; action.textContent = ""; majDetail(); },
      definir: function (d) {
        etat_(d.etat || "ok"); poser(d.valeur); note.textContent = d.note || ""; action.textContent = ""; detail.textContent = "";
        (d.detail || []).forEach(function (t) { detail.appendChild(el("li", { text: t })); }); majDetail();
      },
      echec: function (type, reessayer) {
        etat_(type === "FORBIDDEN" ? "indisponible" : "erreur"); detail.textContent = ""; action.textContent = ""; majDetail();
        poser("Données indisponibles");
        note.textContent = type === "FORBIDDEN" ? "Accès non autorisé pour votre rôle." : (type === "MFA_REQUIRED" ? "Validation de sécurité (MFA) requise." : (type === "UNAUTHENTICATED" ? "Session expirée." : (type === "RESEAU" ? "Connexion impossible pour le moment." : "Lecture impossible pour le moment.")));
        const b = boutonRepli(type, reessayer); if (b) { b.setAttribute("aria-label", b.textContent + " : " + titre); action.appendChild(b); }
      },
    };
  }

  // Si le noyau (admin.js) expose son pont, il bascule lui-même vers l'écran MFA ou la connexion (geree = true). Sinon, l'interface affiche un message clair avec le bon bouton.
  async function echecDonnee(ctx, e) {
    console.error("Administration — donnée indisponible :", String((e && (e.code || e.name)) || "?"), String((e && e.message) || "").slice(0, 120));
    let k = typeErreur(e), geree = false;
    if (window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur) { k = await window.KYR_ADMIN.reagirErreur(e); geree = (k === "UNAUTHENTICATED" || k === "MFA_REQUIRED"); }
    return { k: k, geree: geree };
  }
  function texteIndisponible(k) {
    if (k === "FORBIDDEN") return "Données indisponibles : accès non autorisé pour votre rôle.";
    if (k === "MFA_REQUIRED") return "Données indisponibles : validation de sécurité (MFA) requise. Rechargez la page.";
    if (k === "UNAUTHENTICATED") return "Données indisponibles : session expirée. Reconnectez-vous.";
    return "Données indisponibles : lecture impossible pour le moment.";
  }
  function boutonRepli(k, reessayer) {              // bouton adapté à la cause (aucun pour un refus de droits)
    if (k === "MFA_REQUIRED") return el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Recharger la page", clic: function () { window.location.reload(); } });
    if (k === "UNAUTHENTICATED") return el("a", { class: "adm-btn adm-btn-secondaire adm-btn-petit", href: "connexion.html?redirect=admin.html", text: "Se reconnecter" });
    if (k !== "FORBIDDEN" && reessayer) return el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Réessayer", clic: reessayer });
    return null;
  }

  function sectionDash(titre, idTitre) {
    const h = el("h2", { class: "adm-section-titre", id: idTitre, text: titre });
    const s = el("section", { class: "adm-dash-section", "aria-labelledby": idTitre }, [h]);
    return s;
  }
  function panneau(titre, idTitre, enfants) {
    return el("section", { class: "adm-panneau", "aria-labelledby": idTitre }, [el("h3", { class: "adm-panneau-titre", id: idTitre, text: titre })].concat(enfants || []));
  }

  function definirEntete(titre, sous, emoji) {
    const h = $("adm-titre-app"), s = $("adm-sous-titre");
    if (h) { h.textContent = titre; if (emoji) { h.appendChild(document.createTextNode(" ")); h.appendChild(el("span", { "aria-hidden": "true", text: emoji })); } }
    if (s) s.textContent = sous || "";
  }

  function dessinAnneau(pct) {
    const R = 38, C = 2 * Math.PI * R, s = svgEl("svg", { viewBox: "0 0 100 100", class: "adm-anneau-svg", "aria-hidden": "true", focusable: "false" });
    s.appendChild(svgEl("circle", { cx: "50", cy: "50", r: String(R), class: "adm-anneau-fond" }));
    if (pct !== null && pct > 0) s.appendChild(svgEl("circle", { cx: "50", cy: "50", r: String(R), class: "adm-anneau-valeur", "stroke-dasharray": (C * pct / 100).toFixed(2) + " " + C.toFixed(2), transform: "rotate(-90 50 50)" }));
    return s;
  }
  function figureAnneau(a) {
    const ok = a.pct !== null, nom = a.titre + " : " + (ok ? a.pct + " % (" + a.legende + ")" : "données indisponibles (" + a.legende + ")");
    return el("figure", { class: "adm-anneau" + (ok ? "" : " adm-anneau--indisponible") }, [
      el("div", { class: "adm-anneau-visuel", role: "img", "aria-label": nom }, [dessinAnneau(ok ? a.pct : null), el("span", { class: "adm-anneau-centre", "aria-hidden": "true", text: ok ? a.pct + "\u00a0%" : "—" })]),
      el("figcaption", null, [el("span", { class: "adm-anneau-titre", text: a.titre }), el("span", { text: ok ? a.legende : "Données indisponibles" }), ok ? null : el("span", { text: a.legende })]),
    ]);
  }
  function courbeCommandes(serie, total, complet) {
    const W = 600, H = 200, m = 6, n = serie.length, max = Math.max.apply(null, serie.map(function (s) { return s.nb; }));
    const x = function (i) { return m + i * (W - 2 * m) / (n - 1); }, y = function (v) { return H - m - v / max * (H - 2 * m); };
    const pts = serie.map(function (s, i) { return x(i).toFixed(1) + " " + y(s.nb).toFixed(1); }), pic = serie.reduce(function (p, s) { return s.nb > p.nb ? s : p; }, serie[0]);
    const resume = pluriel(total, "commande reçue", "commandes reçues") + " sur 30 jours · pic : " + pluriel(max, "commande", "commandes") + " le " + pic.libelle + (complet ? "" : " · lecture partielle (dernières commandes seulement)");
    const svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    const defs = svgEl("defs"), deg = svgEl("linearGradient", { id: "adm-grad-courbe", x1: "0", y1: "0", x2: "0", y2: "1" });
    deg.appendChild(svgEl("stop", { offset: "0", class: "adm-courbe-stop-haut" })); deg.appendChild(svgEl("stop", { offset: "1", class: "adm-courbe-stop-bas" })); defs.appendChild(deg); svg.appendChild(defs);
    [m, H / 2, H - m].forEach(function (yy) { svg.appendChild(svgEl("line", { x1: "0", x2: String(W), y1: String(yy), y2: String(yy), class: "adm-courbe-grille" })); });
    svg.appendChild(svgEl("path", { d: "M" + pts.join(" L ") + " L " + x(n - 1).toFixed(1) + " " + (H - m) + " L " + x(0).toFixed(1) + " " + (H - m) + " Z", fill: "url(#adm-grad-courbe)", stroke: "none" }));
    svg.appendChild(svgEl("path", { d: "M" + pts.join(" L "), class: "adm-courbe-ligne" }));
    const axe = el("div", { class: "adm-courbe-axe", "aria-hidden": "true" }, [0, 7, 14, 22, 29].map(function (i) { return el("span", { text: serie[i].libelle }); }));
    const lignesTab = serie.map(function (s) { return el("tr", null, [el("th", { scope: "row", text: s.libelle }), el("td", { text: String(s.nb) })]); });
    return el("div", null, [
      el("p", { class: "adm-courbe-resume", text: resume }),
      el("div", { class: "adm-courbe", role: "img", "aria-label": "Courbe des commandes reçues par jour sur 30 jours : " + resume + ". Les valeurs détaillées figurent dans le tableau qui suit." }, [svg]), axe,
      el("div", { class: "adm-sr" }, [el("table", null, [el("caption", { text: "Commandes reçues par jour (hors annulées)" }), el("thead", null, [el("tr", null, [el("th", { scope: "col", text: "Jour" }), el("th", { scope: "col", text: "Commandes" })])]), el("tbody", null, lignesTab)])]),
    ]);
  }

  function vueTableau(corps, ctx) {
    const src = creerSources();
    corps.textContent = "";
    const racine = el("div", { class: "adm-dash" }); corps.appendChild(racine);

    // Prénom du propriétaire : first_name du profil s'il est lisible, sinon « Bonjour » seul. Jamais déduit de l'adresse e-mail.
    src.prenom().then(function (p) { if (ctx.actif() && p) definirEntete("Bonjour " + p, "Voici un aperçu de l'activité de votre boutique.", "👋"); }, function () { /* « Bonjour » suffit */ });

    function kpi(carte, nomSource, afficher) {
      function lancer() {
        carte.charger();
        src[nomSource]().then(function (donnees) { if (ctx.actif()) afficher(carte, donnees); }, function (e) {
          return echecDonnee(ctx, e).then(function (r) { if (!ctx.actif() || r.geree) return; carte.echec(r.k, function () { src.oublier(nomSource); lancer(); }); });
        });
      }
      lancer();
    }
    const indispo = function (c, note) { c.definir({ etat: "indisponible", valeur: "Données indisponibles", note: note }); };

    // ---- Ventes et encaissements ----
    const sVentes = sectionDash("Ventes et encaissements", "adm-d-ventes"), gVentes = el("div", { class: "adm-kpis adm-kpis--ventes" });
    sVentes.appendChild(gVentes); racine.appendChild(sVentes);
    const cCA = carteKpi("Chiffre d'affaires confirmé", { icone: "ca", classe: "adm-kpi--ca", lien: ["#/commandes", "Voir les commandes"], aide: "Somme des totaux confirmés des commandes. Exclut les commandes annulées et celles dont le prix n'est pas encore confirmé." });
    const cPaie = carteKpi("Paiements encaissés", { icone: "paiements", detailRepli: "Détail par statut", classe: "adm-kpi--encaisse", lien: ["#/paiements", "Voir les paiements"], statut: "Paiements en ligne non activés (phase de test). Ne pas confondre avec le chiffre d'affaires.", aide: "Argent réellement reçu. L'enregistrement d'un paiement n'est pas encore branché à cette interface : seuls les paiements déjà présents en base sont comptés." });
    const cCmd = carteKpi("Commandes", { icone: "commandes", lien: ["#/commandes", "Voir les commandes"], aide: "Toutes les commandes, tous statuts confondus." });
    const cCli = carteKpi("Clients", { icone: "clients", lien: ["#/clients", "Voir les clients"], aide: "Nombre de profils enregistrés." });
    [cCA, cPaie, cCmd, cCli].forEach(function (c) { gVentes.appendChild(c.racine); });

    kpi(cCA, "commandes", function (c, cmd) {
      const v = calculerVentes(cmd);
      if (v.indisponible) return indispo(c, "Les colonnes nécessaires ne sont pas accessibles.");
      if (v.total === 0) return c.definir({ etat: "vide", valeur: fcfa(0), note: "Aucune commande enregistrée." });
      const morceaux = [pluriel(v.nbRetenues, "commande retenue", "commandes retenues")];
      if (v.nbSansPrix > 0) morceaux.push(pluriel(v.nbSansPrix, "commande", "commandes") + " au prix à confirmer (exclue" + (v.nbSansPrix > 1 ? "s" : "") + ")");
      if (!v.complet) morceaux.push("limité aux " + nombre(v.total) + " dernières commandes");
      c.definir({ etat: v.complet ? "ok" : "partiel", valeur: fcfa(v.ca), note: morceaux.join(" · ") });
    });
    kpi(cPaie, "paiements", function (c, res) {
      if (res.lignes.length === 0) return c.definir({ etat: "vide", valeur: fcfa(0), note: "Aucun paiement enregistré." });
      const v = calculerPaiements(res.lignes);
      if (v.indisponible) return indispo(c, "Les colonnes nécessaires ne sont pas accessibles.");
      const detail = v.parStatut.map(function (g) { return pluriel(g.nb, "paiement", "paiements") + " au statut « " + g.statut + " »" + (g.fiable ? " : " + fcfa(g.somme) : ""); });
      if (v.encaisse === null) return c.definir({ etat: "indisponible", valeur: "Données indisponibles", note: "Le statut « encaissé » reste à confirmer. Détail réel par statut :", detail: detail });
      c.definir({ etat: res.complet ? "ok" : "partiel", valeur: fcfa(v.encaisse.somme), note: pluriel(v.encaisse.nb, "paiement encaissé", "paiements encaissés") + (res.complet ? "" : " · lecture partielle"), detail: detail });
    });
    kpi(cCmd, "commandes", function (c, cmd) {
      const v = calculerVentes(cmd);
      if (v.indisponible) return indispo(c, "Les colonnes nécessaires ne sont pas accessibles.");
      if (v.total === 0) return c.definir({ etat: "vide", valeur: "0", note: "Aucune commande enregistrée." });
      const morceaux = [];
      if (v.aTraiter > 0) morceaux.push(nombre(v.aTraiter) + " à traiter");
      if (v.nbAnnulees > 0) morceaux.push(pluriel(v.nbAnnulees, "annulée", "annulées"));
      if (!v.complet) morceaux.push("au moins ce nombre (limité aux " + nombre(v.total) + " dernières)");
      c.definir({ etat: v.complet ? "ok" : "partiel", valeur: nombre(v.total) + (v.complet ? "" : "+"), note: morceaux.join(" · ") || "Toutes les commandes." });
    });
    kpi(cCli, "clients", function (c, cl) {
      if (cl.nb === null) return indispo(c, "Comptage fiable impossible avec les droits actuels.");
      c.definir({ etat: cl.nb === 0 ? "vide" : "ok", valeur: nombre(cl.nb), note: cl.nb === 0 ? "Aucun profil enregistré." : "profils enregistrés" });
    });

    // ---- Stock, échéances, factures ----
    const sStock = sectionDash("Stock, échéances et factures", "adm-d-stock"), gStock = el("div", { class: "adm-kpis" });
    sStock.appendChild(gStock); racine.appendChild(sStock);
    const cStock = carteKpi("Stock disponible", { icone: "stock", lien: ["#/stock", "Voir le stock"], aide: "Quantité moins quantité réservée, par variante, jamais négative." });
    const cRupt = carteKpi("Variantes sans stock", { icone: "initial", lien: ["#/stock", "Voir le stock"] });
    const cEch = carteKpi("Échéances à venir", { icone: "echeances", lien: ["#/echeanciers", "Voir les échéanciers"], aide: "Montants à recevoir, hors échéances en retard." });
    const cFac = carteKpi("Factures", { icone: "factures", lien: ["#/factures", "Voir les factures"], aide: "Le facturé exclut les brouillons et les factures annulées." });
    [cStock, cRupt, cEch, cFac].forEach(function (c) { gStock.appendChild(c.racine); });

    kpi(cStock, "stock", function (c, res) {
      const v = calculerStock(res.lignes);
      if (v.indisponible) return indispo(c, "Les colonnes de stock ne sont pas accessibles.");
      if (v.lignes === 0) return c.definir({ etat: "vide", valeur: "0 unité", note: "Aucune ligne d'inventaire." });
      const morceaux = [];
      if (v.nonRenseigne) morceaux.push("Stock non renseigné : toutes les quantités sont à 0");
      else morceaux.push("sur " + pluriel(v.lignes, "variante suivie", "variantes suivies"));
      if (v.incoherentes > 0) morceaux.push(pluriel(v.incoherentes, "ligne incohérente", "lignes incohérentes") + " (réservé supérieur à la quantité)");
      c.definir({ etat: v.nonRenseigne || v.incoherentes > 0 ? "partiel" : "ok", valeur: pluriel(v.disponible, "unité", "unités"), note: morceaux.join(" · ") });
    });
    kpi(cRupt, "stock", function (c, res) {
      const v = calculerStock(res.lignes);
      if (v.indisponible) { c.titre("Variantes sans stock"); return indispo(c, "Les colonnes de stock ne sont pas accessibles."); }
      if (v.lignes === 0) { c.titre("Variantes sans stock"); return c.definir({ etat: "vide", valeur: "0", note: "Aucune ligne d'inventaire." }); }
      if (v.nonRenseigne) { c.titre("Stock initial"); return c.definir({ etat: "partiel", valeur: pluriel(v.sansStock, "variante", "variantes"), note: "sans stock renseigné (toutes les lignes sont à 0) : pas une rupture commerciale." }); }
      c.titre("Ruptures de stock");
      c.definir({ etat: v.sansStock > 0 ? "partiel" : "ok", valeur: nombre(v.sansStock), note: v.sansStock > 0 ? "variantes sans stock disponible, sur " + nombre(v.lignes) : "Aucune variante sans stock disponible." });
    });
    kpi(cEch, "echeances", function (c, res) {
      if (res.lignes.length === 0) return c.definir({ etat: "vide", valeur: fcfa(0), note: "Aucune échéance enregistrée." });
      const v = calculerEcheances(res.lignes, new Date());
      if (v.indisponible) return indispo(c, "Les colonnes nécessaires ne sont pas accessibles.");
      if (!v.aVenir.fiable) return indispo(c, "Montants non exploitables : voir le détail dans les échéanciers.");
      const detail = [];
      detail.push("Sous " + JOURS_ECHEANCE_PROCHE + " jours : " + pluriel(v.proches.nb, "échéance", "échéances") + (v.proches.fiable ? " (" + fcfa(v.proches.somme) + ")" : ""));
      detail.push("En retard : " + pluriel(v.retard.nb, "échéance", "échéances") + (v.retard.fiable ? " (" + fcfa(v.retard.somme) + ")" : ""));
      if (v.inconnus > 0) detail.push(pluriel(v.inconnus, "échéance", "échéances") + " à statut non reconnu (non comptée" + (v.inconnus > 1 ? "s" : "") + ")");
      c.definir({ etat: res.complet ? "ok" : "partiel", valeur: fcfa(v.aVenir.somme), note: pluriel(v.aVenir.nb, "échéance à venir", "échéances à venir"), detail: detail });
    });
    kpi(cFac, "factures", function (c, res) {
      if (res.lignes.length === 0) return c.definir({ etat: "vide", valeur: "0", note: "Aucune facture enregistrée." });
      const v = calculerFactures(res.lignes);
      if (v.indisponible) return indispo(c, "Les colonnes nécessaires ne sont pas accessibles.");
      const detail = [];
      if (v.fiableFacture) detail.push("Facturé : " + fcfa(v.montantFacture) + " (" + pluriel(v.nbFacturees, "facture", "factures") + ")");
      detail.push("Non soldées : " + pluriel(v.nbNonSoldees, "facture", "factures") + (v.fiableNonSolde ? " (total " + fcfa(v.montantNonSolde) + ")" : ""));
      if (v.inconnus > 0) detail.push(pluriel(v.inconnus, "facture", "factures") + " à statut non reconnu");
      c.definir({ etat: res.complet ? "ok" : "partiel", valeur: nombre(v.total), note: v.total > 1 ? "factures enregistrées" : "facture enregistrée", detail: detail });
    });

    // ---- Répartition et tendance : trois anneaux (ratios réels) et courbe des commandes reçues ----
    const sRep = sectionDash("Répartition et tendance", "adm-d-repart"), grilleRep = el("div", { class: "adm-dash-repart" });
    sRep.appendChild(grilleRep); racine.appendChild(sRep);
    const zoneAnneaux = el("div"), zoneCourbe = el("div");
    grilleRep.appendChild(panneau("Répartition", "adm-d-anneaux", [zoneAnneaux]));
    grilleRep.appendChild(panneau("Commandes reçues sur 30 jours", "adm-d-courbe", [zoneCourbe]));
    function blocAnneaux() {
      chargement(zoneAnneaux);
      Promise.allSettled([src.commandes(), src.factures(), src.echeances()]).then(function (r) {
        if (!ctx.actif()) return;
        const val = function (i) { return r[i].status === "fulfilled" ? r[i].value : null; };
        zoneAnneaux.textContent = "";
        const grille = el("div", { class: "adm-anneaux" }); calculerAnneaux(val(0), val(1), val(2)).forEach(function (a) { grille.appendChild(figureAnneau(a)); });
        zoneAnneaux.appendChild(grille);
        zoneAnneaux.appendChild(el("p", { class: "adm-note-repart", text: "Ratios calculés sur les données réelles de la base. « Données indisponibles » s'affiche quand un ratio n'est pas calculable." }));
      });
    }
    function blocCourbe() {
      chargement(zoneCourbe);
      src.commandes().then(function (cmd) {
        if (!ctx.actif()) return;
        zoneCourbe.textContent = "";
        if (!aColonnes(cmd.lignes, ["status", "created_at"])) { zoneCourbe.appendChild(el("p", { class: "adm-etat-texte", text: "Données indisponibles : les colonnes nécessaires ne sont pas accessibles." })); return; }
        const serie = serieCommandes(cmd.lignes, new Date()), total = serie.reduce(function (t, s) { return t + s.nb; }, 0);
        if (total === 0) { zoneCourbe.appendChild(el("p", { class: "adm-etat-texte", text: cmd.lignes.length === 0 ? "Aucune commande enregistrée pour le moment." : "Aucune commande reçue (hors annulées) sur les 30 derniers jours." })); return; }
        zoneCourbe.appendChild(courbeCommandes(serie, total, cmd.complet));
      }, function (e) {
        return echecDonnee(ctx, e).then(function (r) {
          if (!ctx.actif() || r.geree) return;
          zoneCourbe.textContent = ""; zoneCourbe.appendChild(el("p", { class: "adm-etat-texte", text: texteIndisponible(r.k) }));
          const b = boutonRepli(r.k, function () { src.oublier("commandes"); blocCourbe(); }); if (b) zoneCourbe.appendChild(b);
        });
      });
    }
    blocAnneaux(); blocCourbe();

    // ---- Performance commerciale (à gauche) et alertes (à droite) sur grand écran ----
    const ligne = el("div", { class: "adm-dash-ligne" }); racine.appendChild(ligne);
    const sPerf = sectionDash("Performance commerciale", "adm-d-perf"); ligne.appendChild(sPerf);
    const zonePerf = el("div", { class: "adm-carte-dash" }); sPerf.appendChild(zonePerf);
    function blocPerformance() {
      chargement(zonePerf);
      src.commandes().then(function (cmd) {
        if (!ctx.actif()) return;
        zonePerf.textContent = "";
        const v = calculerVentes(cmd);
        if (v.indisponible) { zonePerf.appendChild(el("p", { class: "adm-etat-texte", text: "Données indisponibles : les colonnes nécessaires ne sont pas accessibles." })); return; }
        if (v.nbRetenues === 0) { zonePerf.appendChild(el("p", { class: "adm-etat-texte", text: v.total === 0 ? "Aucune commande enregistrée pour le moment." : "Aucune vente à prix confirmé pour le moment : le graphique apparaîtra dès qu'une commande aura son prix confirmé." })); return; }
        let mode = "jours";
        const histo = el("div"), boutons = [];
        const segment = el("div", { class: "adm-segment", role: "group", "aria-label": "Période du graphique" });
        [["jours", "30 jours"], ["mois", "6 mois"]].forEach(function (m) {
          const b = el("button", { type: "button", "aria-pressed": m[0] === mode ? "true" : "false", text: m[1], clic: function () { mode = m[0]; boutons.forEach(function (x) { x[1].setAttribute("aria-pressed", x[0] === mode ? "true" : "false"); }); dessiner(); } });
          boutons.push([m[0], b]); segment.appendChild(b);
        });
        zonePerf.appendChild(el("div", { class: "adm-carte-dash-tete" }, [el("h3", { text: "Chiffre d'affaires confirmé" }), segment]));
        zonePerf.appendChild(histo);
        zonePerf.appendChild(el("p", { class: "adm-note-dash", text: "Par date de création de la commande. Commandes à prix confirmé, hors annulées. " + (cmd.complet ? nombre(v.total) + " commandes analysées." : "Limité aux " + nombre(v.total) + " dernières commandes.") }));
        function dessiner() {
          const serie = serieVentes(cmd.lignes, mode, new Date()); histo.textContent = "";
          const max = serie.reduce(function (m, s) { return Math.max(m, s.ca); }, 0), totalCa = serie.reduce(function (t, s) { return t + s.ca; }, 0), nbCmd = serie.reduce(function (t, s) { return t + s.nb; }, 0);
          if (max === 0) { histo.appendChild(el("p", { class: "adm-etat-texte", text: "Aucune vente confirmée sur cette période." })); return; }
          histo.appendChild(el("p", { class: "adm-histo-resume", text: fcfa(totalCa) + " sur la période · " + pluriel(nbCmd, "commande", "commandes") + " · maximum " + fcfa(max) + " par " + (mode === "jours" ? "jour" : "mois") }));
          const colonnes = el("div", { class: "adm-histo", role: "img", "aria-label": "Histogramme du chiffre d'affaires confirmé : " + fcfa(totalCa) + " sur la période, " + pluriel(nbCmd, "commande", "commandes") + ". Les valeurs détaillées figurent dans le tableau qui suit." });
          const axe = el("div", { class: "adm-histo-axe", "aria-hidden": "true" });
          const pas = mode === "jours" ? 5 : 1;
          serie.forEach(function (s, i) {
            const barre = el("div", { class: "adm-histo-barre" + (s.ca === 0 ? " adm-histo-barre--zero" : ""), title: s.libelle + " : " + fcfa(s.ca) + " (" + pluriel(s.nb, "commande", "commandes") + ")" });
            barre.style.height = (s.ca === 0 ? 1 : Math.max(2, Math.round(s.ca / max * 100))) + "%";
            colonnes.appendChild(el("div", { class: "adm-histo-col" }, [barre]));
            axe.appendChild(el("span", { text: (serie.length - 1 - i) % pas === 0 ? s.libelle : "" }));
          });
          histo.appendChild(colonnes); histo.appendChild(axe);
          const lignes = serie.map(function (s) { return el("tr", null, [el("th", { scope: "row", text: s.libelle }), el("td", { text: fcfa(s.ca) }), el("td", { text: String(s.nb) })]); });
          // la table est enveloppée dans un div masqué : une <table> ignore width/overflow et débordait de la page (défilement horizontal sur mobile)
          histo.appendChild(el("div", { class: "adm-sr" }, [el("table", null, [el("caption", { text: "Chiffre d'affaires confirmé par " + (mode === "jours" ? "jour" : "mois") }), el("thead", null, [el("tr", null, [el("th", { scope: "col", text: "Période" }), el("th", { scope: "col", text: "Chiffre d'affaires confirmé" }), el("th", { scope: "col", text: "Commandes" })])]), el("tbody", null, lignes)])]));
        }
        dessiner();
      }, function (e) {
        return echecDonnee(ctx, e).then(function (r) {
          if (!ctx.actif() || r.geree) return;
          zonePerf.textContent = "";
          zonePerf.appendChild(el("p", { class: "adm-etat-texte", text: texteIndisponible(r.k) }));
          const b = boutonRepli(r.k, function () { src.oublier("commandes"); blocPerformance(); }); if (b) zonePerf.appendChild(b);
        });
      });
    }
    blocPerformance();

    // ---- Alertes et actions rapides ----
    const sAl = sectionDash("Alertes et raccourcis", "adm-d-alsec"); ligne.appendChild(sAl);
    const duo = el("div", { class: "adm-dash-duo" }); sAl.appendChild(duo);
    const zoneAlertes = el("div"); duo.appendChild(panneau("Alertes", "adm-d-alertes", [zoneAlertes]));
    duo.appendChild(panneau("Actions rapides", "adm-d-actions", [el("nav", { class: "adm-actions-rapides", "aria-label": "Actions rapides" }, [
      ["#/stock", "Voir le stock"], ["#/commandes", "Voir les commandes"], ["#/clients", "Voir les clients"], ["#/paiements", "Voir les paiements"],
    ].map(function (a) { return el("a", { href: a[0], text: a[1] }); }))]));
    chargement(zoneAlertes);
    Promise.allSettled([src.commandes(), src.echeances(), src.stock()]).then(function (r) {
      if (!ctx.actif()) return;
      const alertes = [], manques = [];
      if (r[0].status === "fulfilled") {
        const v = calculerVentes(r[0].value);
        if (!v.indisponible) {
          if (v.aTraiter > 0) alertes.push(["ambre", pluriel(v.aTraiter, "demande de commande à traiter", "demandes de commande à traiter"), "#/commandes", "Voir les commandes"]);
          if (v.prixAConfirmer > 0) alertes.push(["ambre", pluriel(v.prixAConfirmer, "commande avec des prix à confirmer", "commandes avec des prix à confirmer"), "#/commandes", "Voir les commandes"]);
        } else manques.push("commandes");
      } else manques.push("commandes");
      if (r[1].status === "fulfilled" && r[1].value.lignes.length > 0) {
        const v = calculerEcheances(r[1].value.lignes, new Date());
        if (!v.indisponible) {
          if (v.retard.nb > 0) alertes.push(["rouge", pluriel(v.retard.nb, "échéance en retard", "échéances en retard") + (v.retard.fiable ? " : " + fcfa(v.retard.somme) : ""), "#/echeanciers", "Voir les échéanciers"]);
          if (v.proches.nb > 0) alertes.push(["ambre", pluriel(v.proches.nb, "échéance à régler", "échéances à régler") + " sous " + JOURS_ECHEANCE_PROCHE + " jours" + (v.proches.fiable ? " : " + fcfa(v.proches.somme) : ""), "#/echeanciers", "Voir les échéanciers"]);
        } else manques.push("échéances");
      } else if (r[1].status === "rejected") manques.push("échéances");
      if (r[2].status === "fulfilled" && r[2].value.lignes.length > 0) {
        const v = calculerStock(r[2].value.lignes);
        if (!v.indisponible) {
          if (v.nonRenseigne) alertes.push(["info", pluriel(v.sansStock, "variante sans stock renseigné", "variantes sans stock renseigné") + " : la saisie initiale du stock reste à faire (ce n'est pas une rupture commerciale).", "#/stock", "Voir le stock"]);
          else if (v.sansStock > 0) alertes.push(["rouge", pluriel(v.sansStock, "variante sans stock disponible", "variantes sans stock disponible"), "#/stock", "Voir le stock"]);
          if (v.incoherentes > 0) alertes.push(["ambre", pluriel(v.incoherentes, "ligne de stock incohérente", "lignes de stock incohérentes") + " (réservé supérieur à la quantité)", "#/stock", "Voir le stock"]);
        } else manques.push("stock");
      } else if (r[2].status === "rejected") manques.push("stock");
      zoneAlertes.textContent = "";
      const ul = el("ul", { class: "adm-alertes" });
      const mots = { rouge: "Urgent : ", ambre: "Attention : ", info: "Information : " };
      alertes.forEach(function (a) {
        ul.appendChild(el("li", { class: "adm-alerte adm-alerte--" + a[0] }, [el("p", { class: "adm-alerte-texte" }, [el("span", { class: "adm-sr", text: mots[a[0]] }), a[1]]), el("a", { class: "adm-alerte-lien", href: a[2], text: a[3] })]));
      });
      if (alertes.length === 0 && manques.length === 0) ul.appendChild(el("li", { class: "adm-alerte adm-alerte--ok" }, [el("p", { class: "adm-alerte-texte", text: "Aucune alerte pour le moment." })]));
      zoneAlertes.appendChild(ul);
      if (manques.length > 0) zoneAlertes.appendChild(el("p", { class: "adm-note-dash", text: "Alertes indisponibles faute de données : " + manques.join(", ") + "." }));
      zoneAlertes.appendChild(el("p", { class: "adm-note-dash", text: "Aucun seuil de « stock faible » n'est défini : seuls les stocks à 0 et les stocks non renseignés sont signalés." }));
    });

    // ---- Activité récente (chaque panneau est indépendant) ----
    const sAct = sectionDash("Activité récente", "adm-d-activite"), grilleAct = el("div", { class: "adm-activite" });
    sAct.appendChild(grilleAct); racine.appendChild(sAct);
    function activite(titre, idTitre, nomSource, extraire, colonnes, libelles, videTexte, lien) {
      const zone = el("div"); grilleAct.appendChild(panneau(titre, idTitre, [zone]));
      function lancer() {
        chargement(zone);
        src[nomSource]().then(function (donnees) {
          if (!ctx.actif()) return;
          const lignes = extraire(donnees); zone.textContent = "";
          if (lignes.length === 0) { zone.appendChild(el("p", { class: "adm-etat-texte", text: videTexte })); return; }
          zone.appendChild(tableau(lignes, { colonnes: colonnes, libelles: libelles, legende: titre, dateSeule: true }));
          if (lien) zone.appendChild(el("a", { class: "adm-panneau-lien", href: lien[0], text: lien[1] }));
        }, function (e) {
          return echecDonnee(ctx, e).then(function (r) {
            if (!ctx.actif() || r.geree) return;
            zone.textContent = "";
            zone.appendChild(el("p", { class: "adm-etat-texte", text: texteIndisponible(r.k) }));
            const b = boutonRepli(r.k, function () { src.oublier(nomSource); lancer(); }); if (b) zone.appendChild(b);
          });
        });
      }
      lancer();
    }
    const recents = function (lignes, champ) { return lignes.slice().sort(function (a, b) { return String(b[champ] || "").localeCompare(String(a[champ] || "")); }).slice(0, 6); };
    activite("Commandes récentes", "adm-a-cmd", "commandes", function (d) { return recents(d.lignes, "created_at"); }, ["order_number", "status", "total_confirmed_fcfa", "created_at"], { order_number: "Commande", status: "Statut", total_confirmed_fcfa: "Montant confirmé", created_at: "Date" }, "Aucune commande pour le moment.", ["#/commandes", "Toutes les commandes"]);
    activite("Paiements récents", "adm-a-pai", "paiements", function (d) { return d.lignes.slice(0, 6); }, ["paid_at", "amount_fcfa", "payment_method", "status"], { paid_at: "Date", amount_fcfa: "Montant", payment_method: "Méthode", status: "Statut" }, "Aucun paiement enregistré.", ["#/paiements", "Tous les paiements"]);
    activite("Factures récentes", "adm-a-fac", "factures", function (d) { return d.lignes.slice(0, 6); }, ["invoice_number", "status", "total_fcfa", "issue_date"], { invoice_number: "Facture", status: "Statut", total_fcfa: "Total", issue_date: "Émise le" }, "Aucune facture enregistrée.", ["#/factures", "Toutes les factures"]);
    activite("Journal d'audit", "adm-a-aud", "audit", function (d) { return d.lignes; }, ["at", "actor_role", "action"], { at: "Date", actor_role: "Rôle", action: "Action" }, "Aucun événement enregistré.", ["#/audit", "Tout le journal"]);
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
    const visibles = VUES.filter(function (v) { return v.roles.indexOf(etat.role) !== -1; }), tailles = {};
    visibles.forEach(function (v) { if (v.groupe) tailles[v.groupe] = (tailles[v.groupe] || 0) + 1; });
    let groupe;
    visibles.forEach(function (v) {
      const racine = !v.groupe || tailles[v.groupe] === 1;               // lien isolé : pas de titre de groupe qui répéterait son nom
      if (!racine && v.groupe !== groupe) ul.appendChild(el("li", { class: "adm-nav-groupe", text: v.groupe }));
      groupe = racine ? undefined : v.groupe;
      ul.appendChild(el("li", { class: racine ? "adm-nav-racine" : null }, [el("a", { class: "adm-nav-lien", href: "#/" + v.id, "data-vue": v.id, text: v.titre })]));
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
    if (window.location.hash && !/^#\//.test(window.location.hash)) return;   // ancre (ex. lien d'évitement « #adm-contenu ») : ce n'est pas une navigation d'écran
    const id = (window.location.hash.replace(/^#\/?/, "") || "tableau").split("?")[0];
    const vue = VUES.filter(function (v) { return v.id === id; })[0] || VUES[0];
    const mon = ++etat.compteur; etat.courant = mon;
    const ctx = { actif: function () { return etat.entre && etat.courant === mon; }, role: etat.role };
    marquerNav(vue.id); fermerMenu();
    const zone = $("adm-vue"); zone.textContent = "";
    if (vue.id === "tableau") definirEntete("Bonjour", "Voici un aperçu de l'activité de votre boutique.", "👋"); else definirEntete(vue.titre, "");
    const titre = $("adm-titre-app"); if (titre) titre.focus({ preventScroll: true });
    const corps = el("div", { class: "adm-vue-corps" }); zone.appendChild(corps);
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
    definirEntete("Administration", "");
    fermerMenu();
  }

  function init() {
    window.addEventListener("hashchange", route);
    const bouton = $("adm-menu-btn"), voile = $("adm-voile"), app = $("adm-app");
    if (bouton) bouton.addEventListener("click", function () { if ($("adm-side").classList.contains("ouvert")) fermerMenu(); else ouvrirMenu(); });
    if (voile) voile.addEventListener("click", fermerMenu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("adm-side") && $("adm-side").classList.contains("ouvert")) { fermerMenu(); if (bouton) bouton.focus(); } });
    // Hygiène des données : dès que la zone applicative est masquée (double authentification perdue, refus, déconnexion), tout ce qui était affiché est effacé de la page.
    if (app && typeof MutationObserver === "function") new MutationObserver(function () { if (app.hidden) quitter(); }).observe(app, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.KYR_ADMIN_UI = Object.freeze({
    entrer: entrer, quitter: quitter, enregistrer: enregistrer,
    el: el, tableau: tableau, liste: liste, listeTable: listeTable, lireTable: lireTable, listeCles: listeCles, charger: charger, chargement: chargement, vide: vide,
    blocPreparation: blocPreparation, gererErreur: gererErreur, messageErreur: messageErreur, dialogue: dialogue, confirmer: confirmer, toast: toast,
    valeurAffichee: valeurAffichee, libelleColonne: libelleColonne, STATUTS: STATUTS, STATUTS_COMMANDE: STATUTS_COMMANDE, RE_UUID: RE_UUID,
    calculs: Object.freeze({ calculerVentes: calculerVentes, calculerPaiements: calculerPaiements, calculerStock: calculerStock, calculerEcheances: calculerEcheances, calculerFactures: calculerFactures, serieVentes: serieVentes, serieCommandes: serieCommandes, calculerAnneaux: calculerAnneaux, fcfa: fcfa }),
  });
})();
