/* Administration — modules Paiements, Échéanciers, Factures.
   Factures : consultation, aperçu et impression / enregistrement en PDF (par le navigateur). La création d'une facture se fait depuis Commandes > Facturer.
   Paiements et échéanciers : lecture seule (aucun paiement n'est créé ni simulé ; Wave, Orange Money et carte ne sont pas encore intégrés). */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;
  const fcfa = function (n) { return Number(n).toLocaleString("fr-FR") + " FCFA"; };

  // Coordonnées officielles de la boutique. Aucune mention légale (NINEA, RCCM) n'est inventée : à ajouter quand le propriétaire les fournit.
  const BOUTIQUE = {
    nom: "KEUR YAYE ROKHAYA",
    adresse: "Keur Mbaye Fall, en face de l’école Fogny, Dakar",
    contact: "WhatsApp : +221 77 261 53 54 · Appels : +221 77 579 79 48",
    web: "contact@keuryayerokhaya.com · keuryayerokhaya.com",
  };

  function options(liste) { return [["", "Tous les statuts"]].concat(liste.map(function (s) { return [s, ui.STATUTS[s]]; })); }
  function jour(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return "—";
    const d = new Date(v.slice(0, 10) + "T00:00:00");
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }
  function nombreOuNull(v) { return v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v); }

  /* ---------- Facture : mise en page (classes uniquement : la page n'autorise aucun style en ligne) ---------- */
  function construireFacture(f, d) {
    const commande = (d && d.order) || {}, client = (d && d.customer) || {}, lignes = Array.isArray(d && d.items) ? d.items : [];
    const nomClient = [client.first_name, client.last_name].filter(Boolean).join(" ") || "—";
    const racine = el("div", { class: "adm-facture" });
    racine.appendChild(el("div", { class: "adm-facture-entete" }, [
      el("div", null, [
        el("p", { class: "adm-facture-boutique", text: BOUTIQUE.nom }),
        el("p", { text: BOUTIQUE.adresse }), el("p", { text: BOUTIQUE.contact }), el("p", { text: BOUTIQUE.web }),
      ]),
      el("div", { class: "adm-facture-ref" }, [
        el("p", { class: "adm-facture-titre", text: "FACTURE" }),
        el("p", { text: "N° " + (f.invoice_number || "—") }),
        el("p", { text: "Date : " + jour(f.issue_date) }),
        f.due_date ? el("p", { text: "À régler avant le : " + jour(f.due_date) }) : null,
        el("p", { text: "Statut : " + (ui.STATUTS[f.status] || f.status || "—") }),
      ]),
    ]));
    racine.appendChild(el("div", { class: "adm-facture-bloc" }, [
      el("p", { class: "adm-facture-sous", text: "Facturé à" }),
      el("p", { text: nomClient }),
      client.customer_number ? el("p", { text: "N° client : " + client.customer_number }) : null,
      commande.order_number ? el("p", { text: "Commande : " + commande.order_number }) : null,
    ]));
    const table = el("table", { class: "adm-facture-table" });
    table.appendChild(el("caption", { class: "adm-sr", text: "Détail de la facture" }));
    table.appendChild(el("thead", null, [el("tr", null, [
      el("th", { scope: "col", text: "Désignation" }), el("th", { scope: "col", text: "Qté" }),
      el("th", { scope: "col", text: "Prix unitaire" }), el("th", { scope: "col", text: "Total" }),
    ])]));
    const corps = el("tbody");
    lignes.forEach(function (i) {
      const opts = [i.storage_label, i.color_name, i.condition_label, i.sim_label].filter(Boolean).join(" · ");
      const pu = nombreOuNull(i.unit_price_confirmed_fcfa), q = Number(i.quantity) || 0;
      corps.appendChild(el("tr", null, [
        el("td", { text: (i.product_name || "—") + (opts ? " (" + opts + ")" : "") }),
        el("td", { class: "adm-facture-num", text: String(q) }),
        el("td", { class: "adm-facture-num", text: pu === null ? "—" : fcfa(pu) }),
        el("td", { class: "adm-facture-num", text: pu === null ? "—" : fcfa(pu * q) }),
      ]));
    });
    table.appendChild(corps);
    racine.appendChild(table);
    const sous = nombreOuNull(f.subtotal_fcfa), remise = nombreOuNull(f.discount_fcfa), total = nombreOuNull(f.total_fcfa);
    const totaux = el("div", { class: "adm-facture-totaux" });
    if (sous !== null) totaux.appendChild(el("p", null, [el("span", { text: "Sous-total" }), el("span", { text: fcfa(sous) })]));
    if (remise !== null && remise > 0) totaux.appendChild(el("p", null, [el("span", { text: "Remise" }), el("span", { text: "− " + fcfa(remise) })]));
    totaux.appendChild(el("p", { class: "adm-facture-total" }, [el("span", { text: "Total" }), el("span", { text: total === null ? "—" : fcfa(total) })]));
    racine.appendChild(totaux);
    if (f.notes) racine.appendChild(el("p", { class: "adm-facture-notes", text: f.notes }));
    racine.appendChild(el("p", { class: "adm-facture-pied", text: "Merci de votre confiance." }));
    return racine;
  }

  // Ouvre l'aperçu d'une facture (ligne de la table invoices, ou facture tout juste créée) ; « Imprimer / PDF » utilise l'impression du navigateur.
  async function afficherFacture(f) {
    if (!f || !ui.RE_UUID.test(String(f.order_id))) { ui.toast("Cette facture n'a pas pu être identifiée.", "erreur"); return; }
    const zone = el("div");
    const ouvert = function () { const d = document.getElementById("adm-dialog"); return !!(d && d.open); };
    ui.dialogue({ titre: "Facture " + (f.invoice_number || ""), corps: zone, actions: [{ libelle: "Fermer" }] });
    ui.chargement(zone);
    let d;
    try {
      const r = await window.KYR_SUPABASE.rpc("staff_get_order", { p_order_id: f.order_id });
      if (r.error) throw r.error;
      d = r.data;
    } catch (e) { if (ouvert()) await ui.gererErreur(zone, e, function () { afficherFacture(f); }); return; }
    if (!ouvert()) return;
    zone.textContent = "";
    zone.appendChild(construireFacture(f, d));
    ui.dialogue({ titre: "Facture " + (f.invoice_number || ""), corps: zone, actions: [
      { libelle: "Imprimer / PDF", principal: true, garder: true, clic: function () { window.print(); } },
      { libelle: "Fermer" },
    ] });
  }
  window.KYR_FACTURE = Object.freeze({ afficher: afficherFacture, construire: construireFacture });

  /* ---------- Listes ---------- */
  function paiements(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "payments", titre: "Paiements",
      intro: "Paiements enregistrés (méthode, référence, montant). Les paiements Wave, Orange Money ou carte ne sont pas encore intégrés : cette section est en consultation.",
      preparation: ["Enregistrer un paiement (espèces, Wave, Orange Money, carte, virement, autre)", "Affecter un paiement à une échéance"], titrePreparation: "enregistrement des paiements",
    });
  }

  function echeanciers(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "installments", titre: "Échéanciers",
      intro: "Échéances de paiement par facture : montant, date, statut, reste à payer.",
      filtres: [{ cle: "status", libelle: "Statut", options: options(["pending", "paid", "overdue"]).concat([["cancelled", "Annulée"]]), appliquer: function (q, v) { return q.eq("status", v); } }],
      preparation: ["Créer une échéance", "Affecter un paiement à une échéance"], titrePreparation: "gestion des échéances",
    });
  }

  function factures(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "invoices", titre: "Factures",
      intro: "Factures émises : numéro, commande, client, montants et statut. Pour créer une facture, ouvrez Commandes puis « Facturer ».",
      filtres: [{ cle: "status", libelle: "Statut", options: options(["draft", "issued", "partially_paid", "paid"]).concat([["cancelled", "Annulée"]]), appliquer: function (q, v) { return q.eq("status", v); } }],
      colonnes: ["invoice_number", "status", "issue_date", "due_date", "subtotal_fcfa", "discount_fcfa", "total_fcfa", "created_at", "order_id", "customer_id"],
      masquer: ["order_id", "customer_id"],
      libelles: { invoice_number: "N° facture", issue_date: "Date", due_date: "Échéance", subtotal_fcfa: "Sous-total", discount_fcfa: "Remise", total_fcfa: "Total" },
      actionsLigne: [{ libelle: "Voir / imprimer", clic: afficherFacture }],
    });
  }

  ui.enregistrer("finance", { paiements: paiements, echeanciers: echeanciers, factures: factures });
})();
