/* Administration — modules Équipe, Audit, Paramètres.
   Équipe : lecture (staff_list_team) et GESTION DES RÔLES : attribution (grant_staff_role) et désactivation (revoke_staff_role).

   PRINCIPES
   - La sécurité réelle est celle de Supabase : chaque fonction vérifie roles.manage et l'AAL2 côté serveur. Les contrôles de cette page
     (identifiant valide, rôle de la liste, refus de modifier son propre compte) ne sont que des aides : ils n'en remplacent aucun.
   - Aucune écriture sans confirmation explicite : un dialogue récapitule l'action, rien n'est envoyé avant le clic sur le bouton de confirmation.
   - Une seule opération à la fois (pas de double soumission) ; formulaire et boutons désactivés pendant l'envoi.
   - Une opération n'est jamais supposée réussie : après chaque modification, la liste est relue sur le serveur et le résultat est vérifié.
   - Seules les données renvoyées par Supabase sont affichées ; l'identifiant et le rôle d'une désactivation viennent de la ligne de la liste, jamais d'une saisie.
   - Audit : lecture seule de audit_log ; l'interface ne propose ni modification ni suppression. */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;

  // ---------- Gestion des rôles ----------
  const ROLES = [["owner", "owner (propriétaire)"], ["admin", "admin (administrateur)"], ["manager", "manager (gestionnaire)"], ["support", "support (support)"]];
  const MESSAGE_GENERIQUE = ui.messageErreur({});

  function roleReconnu(r) { return ROLES.some(function (x) { return x[0] === r; }); }
  function libelleRole(r) { for (let i = 0; i < ROLES.length; i++) if (ROLES[i][0] === r) return ROLES[i][1]; return String(r); }
  function mail(l) { return l && l.email ? String(l.email) : "(adresse non renvoyée)"; }

  // Identifiant de la session en cours (lecture locale du SDK) : sert UNIQUEMENT à empêcher dans l'interface de modifier son propre compte.
  async function identifiantSession() {
    try {
      const r = await window.KYR_SUPABASE.auth.getSession();
      const id = r && r.data && r.data.session && r.data.session.user && r.data.session.user.id;
      return ui.RE_UUID.test(String(id)) ? String(id).toLowerCase() : null;
    } catch (e) { return null; }
  }

  function journaliser(e) {
    console.error("Administration — gestion des rôles :", String((e && (e.code || e.name)) || "?"), String((e && e.message) || "").slice(0, 120));
  }

  // Message en français pour une erreur d'écriture. Jamais d'erreur SQL brute ; un code KYR inconnu est cité tel quel pour le diagnostic.
  function messageRole(e) {
    const brut = String((e && e.message) || "");
    const c = /KYR_[A-Z_]+/.exec(brut + " " + String((e && e.details) || ""));
    const code = c ? c[0] : null;
    if (code === "KYR_SELF_ROLE_CHANGE") return { texte: "Vous ne pouvez pas modifier votre propre rôle.", reseau: false };
    if (code === "KYR_LAST_OWNER") return { texte: "Le dernier propriétaire actif ne peut pas être désactivé.", reseau: false };
    if (code === "KYR_NOT_FOUND") return { texte: "Élément introuvable : vérifiez l'identifiant de l'utilisateur.", reseau: false };
    if (code === "KYR_INVALID") return { texte: "Valeur invalide : vérifiez l'identifiant et le rôle.", reseau: false };
    if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(brut) || (e && e.name === "AuthRetryableFetchError")) {
      return { texte: "Connexion impossible : l'opération a peut-être été enregistrée. Vérifiez la liste ci-dessous avant de recommencer.", reseau: true };
    }
    const t = ui.messageErreur(e);
    if (code === "KYR_MFA_REQUIRED") return { texte: t + " Rechargez la page pour renouveler la validation.", reseau: false };
    if (t === MESSAGE_GENERIQUE && code) return { texte: "Le serveur a refusé l'opération (code " + code + ").", reseau: false };
    return { texte: t, reseau: false };
  }

  // Dialogue de confirmation avec récapitulatif. Résout true seulement sur le bouton de confirmation ; Annuler, Échap et fermeture donnent false.
  function confirmerRole(opts) {
    return new Promise(function (resolve) {
      const d = document.getElementById("adm-dialog");
      let fini = false;
      function terminer(v) { if (fini) return; fini = true; d.removeEventListener("close", surFermeture); resolve(v); }
      function surFermeture() { terminer(false); }
      d.addEventListener("close", surFermeture);
      const dl = el("dl", { class: "adm-cles" });
      opts.details.forEach(function (x) { dl.appendChild(el("dt", { text: x[0] })); dl.appendChild(el("dd", { text: x[1] })); });
      const corps = el("div", null, [el("p", { text: opts.question }), dl].concat(opts.notes.map(function (n) { return el("p", { class: "adm-note", text: n }); })));
      ui.dialogue({
        titre: opts.titre, corps: corps,
        actions: [
          { libelle: "Annuler", clic: function () { terminer(false); } },
          { libelle: opts.libelle, danger: !!opts.danger, principal: !opts.danger, clic: function () { terminer(true); } },
        ],
      });
    });
  }

  function equipe(corps, ctx) {
    let occupe = false;                 // une seule opération à la fois
    let moi = null;                     // identifiant de la session (garde d'interface uniquement)
    let lignes = [];
    const zoneStatut = el("p", { class: "adm-message succes", role: "status", tabindex: "-1", hidden: true });
    const zoneAlerte = el("div", { class: "adm-message adm-message-erreur", role: "alert", tabindex: "-1", hidden: true });
    const zoneTable = el("div", { class: "adm-equipe" });
    const form = el("form", { class: "adm-form-roles", novalidate: true, "aria-labelledby": "adm-roles-form-titre" });
    let champId, selRole, erreurId, erreurRole;

    function afficher(zone, texte) { zone.textContent = texte || ""; zone.hidden = !texte; }
    function effacerMessages() {
      afficher(zoneStatut, ""); afficher(zoneAlerte, "");
      if (erreurId) { afficher(erreurId, ""); afficher(erreurRole, ""); champId.removeAttribute("aria-invalid"); selRole.removeAttribute("aria-invalid"); }
    }
    function basculerOccupe(etat) {
      corps.setAttribute("aria-busy", etat ? "true" : "false");
      Array.prototype.forEach.call(corps.querySelectorAll("button, select, input"), function (n) { n.disabled = etat; });
    }
    function membre(id) { return lignes.filter(function (l) { return String(l.user_id).toLowerCase() === id; }); }

    async function rechargerEquipe() {
      try {
        const r = await window.KYR_SUPABASE.rpc("staff_list_team");
        if (r.error) throw r.error;
        lignes = r.data || [];
        if (ctx.actif()) rendreTable();
        return true;
      } catch (e) {
        journaliser(e);
        if (ctx.actif()) {
          lignes = [];
          zoneTable.textContent = "";
          zoneTable.appendChild(el("p", { class: "adm-message adm-message-erreur", role: "status", text: "Liste masquée : la relecture a échoué et son état précédent pourrait être périmé." }));
        }
        return false;
      }
    }

    // Retour d'une opération : message, focus (les lignes ont été reconstruites), notification.
    function retourSucces(texte) {
      afficher(zoneAlerte, ""); afficher(zoneStatut, texte); ui.toast(texte, "info"); zoneStatut.focus();
    }
    function retourNonConfirme(texte) {
      afficher(zoneStatut, ""); afficher(zoneAlerte, texte); ui.toast("Résultat à vérifier", "erreur"); zoneAlerte.focus();
    }
    function retourErreur(texte) { afficher(zoneStatut, ""); afficher(zoneAlerte, texte); ui.toast(texte, "erreur"); zoneAlerte.focus(); }

    function retourEtatInconnu(texte) {
      afficher(zoneStatut, "");
      zoneAlerte.textContent = texte + " ";
      zoneAlerte.hidden = false;
      const bouton = el("button", {
        type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Recharger l’équipe",
        clic: async function () {
          if (occupe) return;
          occupe = true;
          basculerOccupe(true);
          try {
            const rechargee = await rechargerEquipe();
            if (!ctx.actif()) return;
            if (rechargee) {
              const message = "La liste a été actualisée. Le résultat de l’opération initiale reste inconnu; vérifiez l’état courant affiché.";
              afficher(zoneStatut, ""); afficher(zoneAlerte, message); ui.toast("Liste actualisée; résultat initial inconnu", "info"); zoneAlerte.focus();
            } else {
              retourEtatInconnu("Résultat toujours inconnu : la relecture a échoué et la liste précédente a été masquée.");
            }
          } finally {
            occupe = false;
            if (ctx.actif()) basculerOccupe(false);
          }
        },
      });
      zoneAlerte.appendChild(bouton);
      zoneAlerte.focus();
    }

    async function surEchec(e) {
      journaliser(e);
      const m = messageRole(e);
      if (!ctx.actif()) return;
      retourErreur(m.texte);
      if (m.reseau) {
        const rechargee = await rechargerEquipe();
        if (ctx.actif() && !rechargee) retourEtatInconnu("Résultat de l’opération inconnu : la relecture de l’équipe a échoué. La liste affichée peut être périmée; ne l’utilisez pas pour confirmer le résultat.");
      }
    }

    // ---------- attribution ----------
    async function attribuer() {
      if (occupe) return;
      effacerMessages();
      const id = champId.value.trim().toLowerCase(), role = selRole.value;
      let premier = null;
      function refuser(champ, zone, texte) { afficher(zone, texte); champ.setAttribute("aria-invalid", "true"); if (!premier) premier = champ; }
      if (!ui.RE_UUID.test(id)) refuser(champId, erreurId, "Identifiant invalide : il doit comporter 36 caractères au format 8-4-4-4-12 (chiffres et lettres de a à f).");
      else if (id === moi) refuser(champId, erreurId, "Vous ne pouvez pas modifier votre propre rôle depuis cette interface (le serveur applique aussi cette règle).");
      if (!ROLES.some(function (r) { return r[0] === role; })) refuser(selRole, erreurRole, "Choisissez un rôle dans la liste.");
      if (!premier && membre(id).some(function (l) { return l.role === role && l.active === true; })) refuser(selRole, erreurRole, "Ce rôle est déjà actif pour cet utilisateur.");
      if (premier) { premier.focus(); return; }

      occupe = true;                    // bloque toute nouvelle opération dès maintenant ; les champs ne sont désactivés qu'après la confirmation (le focus revient ainsi sur un bouton actif si on annule)
      try {
        const connus = membre(id), notes = [];
        notes.push(role === "owner" ? "Le rôle owner donne tous les droits de gestion, y compris la gestion des rôles." : "Les droits accordés sont ceux que le serveur associe à ce rôle.");
        notes.push("Vous pourrez désactiver ce rôle ensuite depuis cette page.");
        const confirme = await confirmerRole({
          titre: "Attribuer ce rôle ?", question: "Vérifiez attentivement avant de confirmer.", libelle: "Attribuer le rôle", danger: false, notes: notes,
          details: [
            ["Identifiant", id], ["Rôle", libelleRole(role)],
            ["Utilisateur connu", connus.length ? mail(connus[0]) + " (rôles : " + connus.map(function (l) { return l.role + (l.active ? " actif" : " désactivé"); }).join(", ") + ")" : "Absent de la liste actuelle : l'adresse e-mail ne peut pas être vérifiée ici."],
          ],
        });
        if (!confirme || !ctx.actif()) return;
        basculerOccupe(true);
        const r = await window.KYR_SUPABASE.rpc("grant_staff_role", { p_user_id: id, p_role: role });
        if (r.error) throw r.error;
        form.reset();
        const rechargee = await rechargerEquipe();
        if (!ctx.actif()) return;
        if (!rechargee) retourEtatInconnu("Attribution non vérifiable : le serveur a accepté la demande, mais la relecture a échoué. Le résultat reste inconnu.");
        else if (!(function (c) { return c.length >= 1 && c.every(function (l) { return l.active === true; }); })(membre(id).filter(function (l) { return l.role === role; }))) retourNonConfirme("Attribution non confirmée : la liste ne montre pas ce rôle actif. Actualisez la page avant de recommencer.");
        else retourSucces("Rôle « " + role + " » attribué.");
      } catch (e) { await surEchec(e); }
      finally { occupe = false; if (ctx.actif()) basculerOccupe(false); }
    }

    // ---------- désactivation (l'utilisateur et le rôle viennent de la ligne, jamais d'une saisie) ----------
    async function desactiver(ligne) {
      if (occupe) return;
      effacerMessages();
      const id = String(ligne.user_id).toLowerCase(), role = String(ligne.role);
      if (!ui.RE_UUID.test(id) || !roleReconnu(role)) { retourErreur("Cette ligne ne contient pas d'identifiant ou de rôle reconnu (owner, admin, manager, support) : désactivation impossible."); return; }
      if (id === moi) { retourErreur("Vous ne pouvez pas modifier votre propre rôle depuis cette interface (le serveur applique aussi cette règle)."); return; }
      // Précaution d'interface (ne remplace PAS la protection du serveur) : on ne propose pas de retirer le dernier propriétaire actif de la liste.
      if (role === "owner" && !lignes.some(function (l) { return l.role === "owner" && l.active === true && String(l.user_id).toLowerCase() !== id; })) {
        retourErreur("Désactivation refusée par précaution : ce serait le dernier propriétaire actif de la liste. Au moins un propriétaire doit rester actif.");
        return;
      }
      occupe = true;                    // voir attribuer() : champs désactivés seulement après la confirmation
      try {
        const notes = ["Le rôle sera désactivé : l'utilisateur perd les droits liés à ce rôle. La ligne n'est pas supprimée."];
        if (role === "owner") notes.push("Attention : vous désactivez un rôle owner. Le serveur peut refuser l'opération selon ses règles de protection.");
        const confirme = await confirmerRole({
          titre: "Désactiver ce rôle ?", question: "Vérifiez attentivement avant de confirmer.", libelle: "Désactiver le rôle", danger: true, notes: notes,
          details: [["Utilisateur", mail(ligne)], ["Identifiant", id], ["Rôle", libelleRole(role)]],
        });
        if (!confirme || !ctx.actif()) return;
        basculerOccupe(true);
        const r = await window.KYR_SUPABASE.rpc("revoke_staff_role", { p_user_id: id, p_role: role });
        if (r.error) throw r.error;
        const rechargee = await rechargerEquipe();
        if (!ctx.actif()) return;
        const correspondants = membre(id).filter(function (l) { return l.role === role; });
        if (!rechargee) retourEtatInconnu("Désactivation non vérifiable : le serveur a accepté la demande, mais la relecture a échoué. Le résultat reste inconnu.");
        else if (correspondants.length === 0) retourNonConfirme("Désactivation non vérifiable : le rôle est absent de la liste rechargée. Actualisez la page avant de recommencer.");
        else if (correspondants.some(function (l) { return l.active === true; })) retourNonConfirme("Désactivation non confirmée : le rôle apparaît encore actif. Actualisez la page avant de recommencer.");
        else if (correspondants.every(function (l) { return l.active === false; })) retourSucces("Rôle « " + role + " » désactivé.");
        else retourNonConfirme("Désactivation non vérifiable : le serveur n'a pas renvoyé un statut exploitable. Actualisez la page avant de recommencer.");
      } catch (e) { await surEchec(e); }
      finally { occupe = false; if (ctx.actif()) basculerOccupe(false); }
    }

    // ---------- affichage ----------
    function rendreTable() {
      zoneTable.textContent = "";
      if (lignes.length === 0) { ui.vide(zoneTable, "Aucun membre du personnel à afficher."); return; }
      const identifiantsOk = lignes.every(function (l) { return ui.RE_UUID.test(String(l.user_id)); });
      const trh = el("tr", null, ["Utilisateur", "Identifiant", "Rôle", "Statut", "Attribué le", "Actions"].map(function (t) { return el("th", { scope: "col", text: t }); }));
      const tbody = el("tbody");
      lignes.forEach(function (l) {
        const id = String(l.user_id).toLowerCase(), v = ui.valeurAffichee("user_id", l.user_id), d = ui.valeurAffichee("created_at", l.created_at);
        const actif = l.active === true;
        const actions = el("td", { class: "adm-td-actions", "data-libelle": "Actions" });
        if (id === moi) actions.appendChild(el("span", { class: "adm-note", text: "Votre compte : non modifiable ici" }));
        else if (actif && identifiantsOk && moi && !roleReconnu(l.role)) actions.appendChild(el("span", { class: "adm-note", text: "Rôle non reconnu : non modifiable ici" }));
        else if (actif && identifiantsOk && moi) actions.appendChild(el("button", { type: "button", class: "adm-btn adm-btn-secondaire adm-btn-petit", text: "Désactiver ce rôle", "aria-label": "Désactiver le rôle " + l.role + " de " + mail(l), clic: function () { desactiver(l); } }));
        tbody.appendChild(el("tr", null, [
          el("td", { text: mail(l), "data-libelle": "Utilisateur" }),
          el("td", { text: v.texte, title: v.titre, "data-libelle": "Identifiant" }),
          el("td", { text: libelleRole(l.role), "data-libelle": "Rôle" }),
          el("td", { "data-libelle": "Statut" }, [el("span", { class: "adm-badge adm-badge--" + (actif ? "vert" : "neutre"), text: actif ? "Actif" : "Désactivé" })]),
          el("td", { text: d.texte, title: d.titre, "data-libelle": "Attribué le" }),
          actions,
        ]));
      });
      zoneTable.appendChild(el("div", { class: "adm-table-wrap", role: "region", "aria-label": "Équipe", tabindex: "0" }, [
        el("table", { class: "adm-table" }, [el("caption", { class: "adm-sr", text: "Équipe : membres, rôles et statuts" }), el("thead", null, [trh]), tbody]),
      ]));
      if (!identifiantsOk) zoneTable.appendChild(el("p", { class: "adm-note", text: "La liste ne renvoie pas d'identifiant utilisateur exploitable : la désactivation n'est pas proposée." }));
      if (occupe) basculerOccupe(true);                // les lignes reconstruites pendant un envoi restent désactivées jusqu'à la fin
    }

    function construire() {
      corps.appendChild(el("p", { class: "adm-intro", text: "Membres du personnel et leurs rôles. Un rôle n'est jamais supprimé : il est désactivé. Personne ne peut modifier son propre rôle." }));
      corps.appendChild(zoneStatut); corps.appendChild(zoneAlerte);
      if (!moi) {
        afficher(zoneAlerte, "Impossible de vérifier l'identité de votre session : la gestion des rôles est désactivée par précaution. Rechargez la page.");
      } else {
        champId = el("input", { id: "adm-role-uuid", name: "p_user_id", class: "adm-champ", type: "text", maxlength: "40", autocomplete: "off", autocapitalize: "off", spellcheck: "false", required: true, "aria-describedby": "adm-role-uuid-aide adm-role-uuid-err" });
        selRole = el("select", { id: "adm-role-choix", name: "p_role", class: "adm-champ", required: true, "aria-describedby": "adm-role-choix-err" }, [el("option", { value: "", text: "Choisir un rôle…" })].concat(ROLES.map(function (r) { return el("option", { value: r[0], text: r[1] }); })));
        erreurId = el("p", { id: "adm-role-uuid-err", class: "adm-message adm-message-erreur", role: "alert", hidden: true });
        erreurRole = el("p", { id: "adm-role-choix-err", class: "adm-message adm-message-erreur", role: "alert", hidden: true });
        [
          el("h3", { id: "adm-roles-form-titre", text: "Attribuer un rôle" }),
          el("p", { class: "adm-note", text: "Saisissez l'identifiant (UUID) du compte, visible dans Supabase, section Authentication > Users. Une confirmation vous sera demandée avant toute modification." }),
          el("div", { class: "adm-form-champs" }, [
          el("div", { class: "adm-groupe" }, [el("label", { for: "adm-role-uuid", text: "Identifiant de l'utilisateur (UUID)" }), champId, el("p", { id: "adm-role-uuid-aide", class: "adm-note", text: "Format : 8-4-4-4-12 caractères, par exemple 00000000-0000-0000-0000-000000000000." }), erreurId]),
          el("div", { class: "adm-groupe" }, [el("label", { for: "adm-role-choix", text: "Rôle à attribuer" }), selRole, erreurRole]),
          el("div", { class: "adm-actions" }, [el("button", { type: "submit", class: "adm-btn adm-btn-primaire", text: "Attribuer le rôle" })]),
          ]),
        ].forEach(function (n) { form.appendChild(n); });
        form.addEventListener("submit", function (ev) { ev.preventDefault(); attribuer(); });
        corps.appendChild(form);
      }
      corps.appendChild(el("h3", { class: "adm-equipe-titre", text: "Équipe actuelle" }));
      corps.appendChild(zoneTable);
      rendreTable();
    }

    ui.charger(ctx, corps, async function () {
      const r = await window.KYR_SUPABASE.rpc("staff_list_team");
      if (r.error) throw r.error;
      moi = await identifiantSession();
      return r.data || [];
    }, function (donnees) { lignes = donnees; construire(); });
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
