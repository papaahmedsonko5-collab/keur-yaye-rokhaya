/* Administration — modules Équipe, Audit, Paramètres (LECTURE SEULE).
   Équipe : fonction staff_list_team (lecture, réservée au propriétaire par le serveur). Aucune attribution ni révocation de rôle n'est branchée ici.
   Audit : lecture seule de audit_log ; l'interface ne propose ni modification ni suppression. */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;

  function equipe(corps, ctx) {
    ui.charger(ctx, corps, async function () {
      const r = await window.KYR_SUPABASE.rpc("staff_list_team");
      if (r.error) throw r.error;
      return r.data || [];
    }, function (lignes) {
      corps.appendChild(el("p", { class: "adm-intro", text: "Membres du personnel et leurs rôles. Un rôle n'est jamais supprimé : il est désactivé (actif = non). Personne ne peut modifier son propre rôle." }));
      if (lignes.length === 0) ui.vide(corps, "Aucun membre du personnel à afficher."); else corps.appendChild(ui.tableau(lignes, { colonnes: ["email", "role", "active", "created_at"], legende: "Équipe" }));
      corps.appendChild(ui.blocPreparation(["Attribuer un rôle à un utilisateur", "Désactiver un rôle"], "gestion des rôles"));
    });
  }

  function audit(corps, ctx) {
    ui.listeTable(corps, ctx, {
      table: "audit_log", titre: "Journal d'audit",
      intro: "Journal en lecture seule : aucune ligne ne peut être modifiée ni supprimée depuis cette interface.",
      colonnes: ["at", "actor_role", "action", "table_name", "record_id", "details"], masquer: ["id", "actor_id"],
      tri: ["at", "created_at"],
      filtres: [{ cle: "role", libelle: "Rôle", options: [["", "Tous les rôles"], ["owner", "Propriétaire"], ["admin", "Administrateur"]], appliquer: function (q, v) { return q.eq("actor_role", v); } }],
      recherche: { libelle: "Action", placeholder: "ex. payment", appliquer: function (q, t) { return q.ilike("action", "%" + t.replace(/[%_*,()]/g, "") + "%"); } },
      dates: true,
      filtresPlus: function (v) {
        const f = [];
        if (v.du) f.push(function (q) { return q.gte("at", v.du + "T00:00:00"); });
        if (v.au) f.push(function (q) { return q.lte("at", v.au + "T23:59:59"); });
        return f;
      },
    });
  }

  function parametres(corps) {
    corps.textContent = "";
    corps.appendChild(el("p", { class: "adm-intro", text: "Aucun paramètre de la boutique n'est branché à cette interface pour le moment." }));
    corps.appendChild(ui.blocPreparation(["Consulter les paramètres de la boutique", "Modifier les paramètres de la boutique"], "paramètres"));
  }

  ui.enregistrer("gestion", { equipe: equipe, audit: audit, parametres: parametres });
})();
