/* Administration — modules Paiements, Échéanciers, Factures (LECTURE SEULE).
   Les tables financières sont en lecture directe pour les rôles authentifiés ; toute écriture passe par des fonctions sécurisées qui ne sont PAS branchées ici
   (aucun paiement, aucune facture, aucune échéance n'est créé ni simulé). */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;

  function options(liste) { return [["", "Tous les statuts"]].concat(liste.map(function (s) { return [s, ui.STATUTS[s]]; })); }

  function paiements(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "payments", titre: "Paiements",
      intro: "Paiements enregistrés (méthode, référence, montant). Les paiements Wave, Orange Money ou carte sont enregistrés manuellement : il n'existe pas d'intégration automatique.",
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

  function apercuFacture(ligne) {
    const corps = el("div", { class: "adm-apercu" }, [
      el("p", { class: "adm-note", text: "Aperçu des données de la facture. La mise en page officielle (logo, mentions légales) est en préparation ; ce document n'a pas de valeur comptable." }),
      ui.listeCles(ligne),
    ]);
    ui.dialogue({ titre: "Facture", corps: corps, actions: [{ libelle: "Imprimer", principal: true, garder: true, clic: function () { window.print(); } }, { libelle: "Fermer" }] });
  }

  function factures(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "invoices", titre: "Factures",
      intro: "Factures émises : numéro, commande, client, montants et statut.",
      filtres: [{ cle: "status", libelle: "Statut", options: options(["draft", "issued", "partially_paid", "paid"]).concat([["cancelled", "Annulée"]]), appliquer: function (q, v) { return q.eq("status", v); } }],
      actionsLigne: [{ libelle: "Aperçu / imprimer", clic: apercuFacture }],
      preparation: ["Créer la facture d'une commande"], titrePreparation: "création de factures",
    });
  }

  ui.enregistrer("finance", { paiements: paiements, echeanciers: echeanciers, factures: factures });
})();
