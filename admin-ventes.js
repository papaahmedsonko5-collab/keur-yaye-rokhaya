/* Administration — modules Clients et Commandes (LECTURE SEULE).
   Fonctions appelées : staff_search_customers, staff_list_orders, staff_get_order (toutes STABLE : lecture sûre).
   Les actions qui écrivent (statut, prix, fiche client complète journalisée) ne sont PAS branchées : « module en préparation ». */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;

  function clients(corps, ctx) {
    ui.liste(corps, ctx, {
      titre: "Clients", taille: 20, legende: "Clients",
      intro: "Liste des clients (téléphone masqué). La fiche complète n'est consultable qu'avec un motif et est journalisée par le serveur.",
      recherche: { libelle: "Rechercher un client", placeholder: "Nom, numéro client…" },
      colonnes: ["customer_number", "first_name", "last_name", "phone_masked", "status", "created_at"], masquer: ["id"],
      charger: async function (p) {
        const r = await window.KYR_SUPABASE.rpc("staff_search_customers", { p_query: p.recherche || null, p_limit: p.taille, p_offset: p.page * p.taille });
        if (r.error) throw r.error;
        return { lignes: r.data || [], total: null };
      },
      actionsLigne: [{ libelle: "Détails", clic: function (l) { ui.dialogue({ titre: "Client", corps: ui.listeCles(l) }); } }],
      preparation: ["Consulter la fiche complète d'un client (avec motif, consultation journalisée)", "Changer le statut d'un client"],
      titrePreparation: "actions sur les clients",
    });
  }

  function rendreCommande(zone, d) {
    zone.textContent = "";
    const ordre = ["order", "customer", "items", "history"];
    Object.keys(d || {}).filter(function (k) { return ordre.indexOf(k) === -1; }).forEach(function (k) { ordre.push(k); });
    ordre.forEach(function (k) {
      if (!(k in (d || {}))) return;
      const v = d[k];
      const titres = { order: "Commande", customer: "Client", items: "Articles", history: "Historique des statuts" };
      zone.appendChild(el("h3", { class: "adm-dialog-sous-titre", text: titres[k] || ui.libelleColonne(k) }));
      if (Array.isArray(v)) {
        if (v.length === 0) zone.appendChild(el("p", { class: "adm-note", text: "Aucune ligne." }));
        else if (typeof v[0] === "object" && v[0] !== null) zone.appendChild(ui.tableau(v, { legende: titres[k] || k }));
        else zone.appendChild(el("p", { text: v.join(", ") }));
      } else if (v !== null && typeof v === "object") zone.appendChild(ui.listeCles(v));
      else zone.appendChild(el("p", { text: ui.valeurAffichee(k, v).texte }));
    });
  }

  function detailCommande(ligne) {
    if (!ligne || !ui.RE_UUID.test(String(ligne.id))) { ui.toast("Cette commande n'a pas pu être identifiée.", "erreur"); return; }
    const zone = el("div");
    ui.dialogue({ titre: "Commande " + (ligne.order_number || ""), corps: zone, actions: [{ libelle: "Fermer" }] });
    ui.charger({ actif: function () { return document.getElementById("adm-dialog").open; } }, zone, async function () {
      const r = await window.KYR_SUPABASE.rpc("staff_get_order", { p_order_id: ligne.id });
      if (r.error) throw r.error;
      return r.data;
    }, function (d) { rendreCommande(zone, d); });
  }

  function commandes(corps, ctx) {
    ui.liste(corps, ctx, {
      titre: "Commandes", taille: 20, legende: "Commandes",
      intro: "Demandes de commande reçues. Un prix indicatif ne devient définitif qu'une fois confirmé par le propriétaire (action non branchée pour l'instant).",
      filtres: [{ cle: "status", libelle: "Statut", options: [["", "Tous les statuts"]].concat(ui.STATUTS_COMMANDE.map(function (s) { return [s, ui.STATUTS[s]]; })) }],
      colonnes: ["order_number", "status", "customer_number", "customer_name", "items_count", "total_indicative_fcfa", "total_confirmed_fcfa", "prices_to_confirm", "created_at"], masquer: ["id"],
      charger: async function (p) {
        const r = await window.KYR_SUPABASE.rpc("staff_list_orders", { p_status: p.valeurs.status || null, p_limit: p.taille, p_offset: p.page * p.taille });
        if (r.error) throw r.error;
        return { lignes: r.data || [], total: null };
      },
      actionsLigne: [{ libelle: "Détail", clic: detailCommande }],
      preparation: ["Confirmer le prix d'une ligne de commande", "Changer le statut (préparer, marquer prête, livrer, annuler)"],
      titrePreparation: "actions sur les commandes",
    });
  }

  ui.enregistrer("ventes", { clients: clients, commandes: commandes });
})();
