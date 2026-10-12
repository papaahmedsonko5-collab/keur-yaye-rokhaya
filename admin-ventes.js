/* Administration — modules Clients et Commandes.
   Commandes : le propriétaire peut confirmer les prix, changer le statut et créer la facture.
   Chaque écriture passe par une fonction serveur (staff_confirm_item_price, staff_set_order_status, create_invoice_for_order) qui contrôle
   la permission, l'AAL2 et les transitions : le navigateur ne décide d'aucun prix ni d'aucun droit (le rôle ne sert qu'à afficher les boutons).
   Chaque appel est sans danger s'il est renvoyé : même prix ou même statut = aucun effet ; une 2e facture est refusée par le serveur. */
(function () {
  "use strict";
  const ui = window.KYR_ADMIN_UI;
  if (!ui) return;
  const el = ui.el;
  const rpc = function (nom, args) { return window.KYR_SUPABASE.rpc(nom, args); };
  const fcfa = function (n) { return Number(n).toLocaleString("fr-FR") + " FCFA"; };
  const dialogueOuvert = function () { const d = document.getElementById("adm-dialog"); return !!(d && d.open); };
  const fermerDialogue = function () { const d = document.getElementById("adm-dialog"); if (d && d.open) d.close(); };

  // Statuts suivants proposés. La règle de transition reste celle du serveur : un refus s'affiche tel quel.
  const SUIVANTS = { requested: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["delivered", "cancelled"], delivered: [], cancelled: [] };
  const MESSAGES_PLUS = {
    KYR_INVALID_DISCOUNT: "La remise est invalide.",
    KYR_INVALID_INVOICE_TOTAL: "La remise doit être inférieure au total de la commande.",
    KYR_ORDER_REQUIRED: "Commande manquante.",
    KYR_PRICES_NOT_CONFIRMED: "Confirmez d'abord le prix de chaque ligne (bouton « Prix ») avant de confirmer la commande.",
  };

  // Message lisible : texte métier du serveur après « KYR_xxx: », sinon message standard de l'administration.
  function texteErreur(e) {
    const brut = String((e && e.message) || "");
    const code = /KYR_[A-Z_]+/.exec(brut);
    if (code && MESSAGES_PLUS[code[0]]) return MESSAGES_PLUS[code[0]];
    const transition = /KYR_BAD_TRANSITION:\s*([a-z]+) vers ([a-z]+) interdit/.exec(brut);
    if (transition) return "Passage de « " + (ui.STATUTS[transition[1]] || transition[1]) + " » à « " + (ui.STATUTS[transition[2]] || transition[2]) + " » impossible.";
    const m = /KYR_(?:INVALID|BAD_TRANSITION)[A-Z_]*:\s*([^\n]{3,200})/.exec(brut);
    return m ? m[1].trim() : ui.messageErreur(e);
  }
  async function signaler(zone, e) {
    let k = null;
    if (window.KYR_ADMIN && window.KYR_ADMIN.reagirErreur) { try { k = await window.KYR_ADMIN.reagirErreur(e); } catch (x) { k = null; } }
    if (k === "UNAUTHENTICATED" || k === "MFA_REQUIRED") return;       // l'écran de connexion est géré par le noyau
    zone.textContent = "";
    zone.appendChild(el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: texteErreur(e) }));
  }
  function bloquer(oui) { Array.prototype.forEach.call(document.querySelectorAll("#adm-dialog-actions button"), function (b) { b.disabled = oui; }); }
  function libelleLigne(i) {
    const opts = [i.storage_label, i.color_name, i.condition_label, i.sim_label].filter(Boolean).join(" · ");
    return (i.line_no ? i.line_no + ". " : "") + i.product_name + (opts ? " (" + opts + ")" : "") + " × " + i.quantity;
  }

  /* ---------- Clients ---------- */
  function clients(corps, ctx) {
    ui.liste(corps, ctx, {
      titre: "Clients", taille: 20, legende: "Clients",
      intro: "Liste des clients (téléphone masqué). La fiche complète n'est consultable qu'avec un motif et est journalisée par le serveur.",
      recherche: { libelle: "Rechercher un client", placeholder: "Nom, numéro client…" },
      colonnes: ["customer_number", "first_name", "last_name", "phone_masked", "status", "created_at"], masquer: ["id"],
      charger: async function (p) {
        const r = await rpc("staff_search_customers", { p_query: p.recherche || null, p_limit: p.taille, p_offset: p.page * p.taille });
        if (r.error) throw r.error;
        return { lignes: r.data || [], total: null };
      },
      actionsLigne: [{ libelle: "Détails", clic: function (l) { ui.dialogue({ titre: "Client", corps: ui.listeCles(l) }); } }],
      preparation: ["Consulter la fiche complète d'un client (avec motif, consultation journalisée)", "Changer le statut d'un client"],
      titrePreparation: "actions sur les clients",
    });
  }

  /* ---------- Détail d'une commande ---------- */
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
    ui.charger({ actif: dialogueOuvert }, zone, async function () {
      const r = await rpc("staff_get_order", { p_order_id: ligne.id });
      if (r.error) throw r.error;
      return r.data;
    }, function (d) { rendreCommande(zone, d); });
  }

  /* ---------- Confirmer les prix (staff_confirm_item_price) ---------- */
  async function dialoguePrix(ligne, rafraichir) {
    if (!ligne || !ui.RE_UUID.test(String(ligne.id))) { ui.toast("Cette commande n'a pas pu être identifiée.", "erreur"); return; }
    const titre = "Prix de la commande " + (ligne.order_number || "");
    const zone = el("div");
    ui.dialogue({ titre: titre, corps: zone, actions: [{ libelle: "Fermer" }] });
    ui.chargement(zone);
    let d;
    try {
      const r = await rpc("staff_get_order", { p_order_id: ligne.id });
      if (r.error) throw r.error;
      d = r.data;
    } catch (e) { if (dialogueOuvert()) await ui.gererErreur(zone, e, function () { dialoguePrix(ligne, rafraichir); }); return; }
    if (!dialogueOuvert()) return;
    const items = (Array.isArray(d && d.items) ? d.items : []).filter(function (i) { return i && ui.RE_UUID.test(String(i.id)); });
    const modifiable = !!(d && d.order && d.order.status === "requested");
    zone.textContent = "";
    zone.appendChild(el("p", { class: "adm-note", text: modifiable
      ? "Saisissez le prix final de chaque ligne, en FCFA. Les prix ne se modifient plus une fois la commande confirmée."
      : "Les prix ne se modifient plus une fois la commande confirmée." }));
    const champs = [];
    items.forEach(function (i, n) {
      const id = "adm-prix-" + n, decl = i.unit_price_declared_fcfa, conf = i.unit_price_confirmed_fcfa;
      const input = el("input", { type: "number", class: "adm-champ", id: id, min: "1", max: "100000000", step: "1", inputmode: "numeric" });
      input.value = conf !== null && conf !== undefined ? String(conf) : (decl !== null && decl !== undefined ? String(decl) : "");
      if (!modifiable) input.disabled = true;
      zone.appendChild(el("div", { class: "adm-bloc" }, [
        el("label", { for: id, text: libelleLigne(i) }),
        el("p", { class: "adm-note", text: decl === null || decl === undefined ? "Aucun prix indiqué par le client." : "Prix indiqué par le client : " + fcfa(decl) }),
        input,
      ]));
      champs.push({ id: i.id, input: input, confirme: conf, label: libelleLigne(i) });
    });
    const erreur = el("div", { "aria-live": "polite" });
    zone.appendChild(erreur);
    let envoi = false;
    async function enregistrer() {
      if (envoi) return;
      erreur.textContent = "";
      const aEnvoyer = [];
      let vides = 0;
      for (let k = 0; k < champs.length; k++) {
        const v = champs[k].input.value.trim();
        if (v === "") { vides++; continue; }
        const n = Number(v);
        if (!/^[0-9]{1,9}$/.test(v) || n < 1 || n > 100000000) {
          erreur.appendChild(el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: "Prix invalide pour « " + champs[k].label + " » : entier entre 1 et 100 000 000." }));
          return;
        }
        if (champs[k].confirme !== n) aEnvoyer.push({ id: champs[k].id, prix: n });
      }
      envoi = true; bloquer(true);
      let faits = 0;
      try {
        for (let k = 0; k < aEnvoyer.length; k++) {
          const r = await rpc("staff_confirm_item_price", { p_item_id: aEnvoyer[k].id, p_price_fcfa: aEnvoyer[k].prix });
          if (r.error) throw r.error;
          faits++;
        }
        fermerDialogue();
        ui.toast(faits > 0 ? (faits + (faits > 1 ? " prix enregistrés." : " prix enregistré.")) : "Aucun changement.", "succes");
        if (vides > 0) ui.toast(vides + (vides > 1 ? " lignes n'ont pas de prix : le total confirmé n'est calculé qu'une fois tous les prix saisis." : " ligne n'a pas de prix : le total confirmé n'est calculé qu'une fois tous les prix saisis."), "info");
        rafraichir();
      } catch (e) {
        await signaler(erreur, e);
        if (faits > 0) erreur.appendChild(el("p", { class: "adm-note", text: faits + (faits > 1 ? " prix déjà enregistrés avant l'erreur. " : " prix déjà enregistré avant l'erreur. ") + "Corrigez puis réenregistrez : les prix déjà enregistrés ne sont pas modifiés." }));
      } finally { envoi = false; bloquer(false); }
    }
    ui.dialogue({ titre: titre, corps: zone, actions: modifiable
      ? [{ libelle: "Enregistrer les prix", principal: true, garder: true, clic: enregistrer }, { libelle: "Fermer" }]
      : [{ libelle: "Fermer" }] });
  }

  /* ---------- Changer le statut (staff_set_order_status) ---------- */
  function dialogueStatut(ligne, rafraichir) {
    if (!ligne || !ui.RE_UUID.test(String(ligne.id))) { ui.toast("Cette commande n'a pas pu être identifiée.", "erreur"); return; }
    const titre = "Statut de la commande " + (ligne.order_number || "");
    const suivants = SUIVANTS[ligne.status] || [];
    if (suivants.length === 0) {
      ui.dialogue({ titre: titre, corps: el("p", { text: "Cette commande est « " + (ui.STATUTS[ligne.status] || ligne.status || "—") + " » : son statut ne peut plus changer." }), actions: [{ libelle: "Fermer" }] });
      return;
    }
    const zone = el("div");
    const sel = el("select", { class: "adm-champ", id: "adm-st-statut" });
    suivants.forEach(function (s) { sel.appendChild(el("option", { value: s, text: ui.STATUTS[s] || s })); });
    const note = el("textarea", { class: "adm-champ", id: "adm-st-note", maxlength: "300", rows: "3" });
    const visible = el("input", { type: "checkbox", id: "adm-st-visible", checked: true });
    zone.appendChild(el("p", { class: "adm-note", text: "Statut actuel : " + (ui.STATUTS[ligne.status] || ligne.status) + "." }));
    zone.appendChild(el("label", { for: "adm-st-statut", text: "Nouveau statut" })); zone.appendChild(sel);
    zone.appendChild(el("label", { for: "adm-st-note", text: "Note (obligatoire pour une annulation, 300 caractères maximum)" })); zone.appendChild(note);
    zone.appendChild(el("label", { class: "adm-etiquette" }, [visible, " Visible par le client dans son espace"]));
    const erreur = el("div", { "aria-live": "polite" });
    zone.appendChild(erreur);
    let envoi = false;
    async function appliquer() {
      if (envoi) return;
      erreur.textContent = "";
      const statut = sel.value, texte = note.value.trim();
      if (statut === "cancelled" && texte.length < 3) {
        erreur.appendChild(el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: "Indiquez le motif de l'annulation (3 caractères minimum)." }));
        return;
      }
      envoi = true; bloquer(true);
      try {
        const r = await rpc("staff_set_order_status", { p_order_id: ligne.id, p_status: statut, p_note: texte || null, p_visible: visible.checked });
        if (r.error) throw r.error;
        fermerDialogue();
        ui.toast(r.data === true ? "Statut mis à jour : " + (ui.STATUTS[statut] || statut) + "." : "La commande avait déjà ce statut.", r.data === true ? "succes" : "info");
        rafraichir();
      } catch (e) { await signaler(erreur, e); } finally { envoi = false; bloquer(false); }
    }
    ui.dialogue({ titre: titre, corps: zone, actions: [{ libelle: "Appliquer", principal: true, garder: true, clic: appliquer }, { libelle: "Fermer" }] });
  }

  /* ---------- Créer la facture (create_invoice_for_order) ---------- */
  function dialogueFacture(ligne, rafraichir) {
    if (!ligne || !ui.RE_UUID.test(String(ligne.id))) { ui.toast("Cette commande n'a pas pu être identifiée.", "erreur"); return; }
    if (ligne.status === "cancelled") { ui.toast("Cette commande est annulée : aucune facture possible.", "erreur"); return; }
    const total = ligne.total_confirmed_fcfa;
    if (total === null || total === undefined) { ui.toast("Confirmez d'abord le prix de chaque ligne (bouton « Prix »).", "erreur"); return; }
    const titre = "Facture de la commande " + (ligne.order_number || "");
    const zone = el("div");
    zone.appendChild(el("p", { text: "Total confirmé de la commande : " + fcfa(total) + "." }));
    const remise = el("input", { type: "number", class: "adm-champ", id: "adm-fa-remise", min: "0", step: "1", inputmode: "numeric" });
    remise.value = "0";
    const echeance = el("input", { type: "date", class: "adm-champ", id: "adm-fa-echeance" });
    const notes = el("textarea", { class: "adm-champ", id: "adm-fa-notes", maxlength: "500", rows: "3" });
    const apercu = el("p", { class: "adm-note", "aria-live": "polite" });
    function majApercu() {
      const v = remise.value.trim(), n = v === "" ? 0 : Number(v);
      apercu.textContent = /^[0-9]{1,12}$/.test(v === "" ? "0" : v) && n < Number(total) ? "Total de la facture : " + fcfa(Number(total) - n) + "." : "Remise invalide : elle doit être inférieure au total.";
    }
    remise.addEventListener("input", majApercu); majApercu();
    zone.appendChild(el("label", { for: "adm-fa-remise", text: "Remise en FCFA (0 si aucune)" })); zone.appendChild(remise);
    zone.appendChild(el("label", { for: "adm-fa-echeance", text: "Date limite de paiement (facultatif)" })); zone.appendChild(echeance);
    zone.appendChild(el("label", { for: "adm-fa-notes", text: "Note sur la facture (facultatif)" })); zone.appendChild(notes);
    zone.appendChild(apercu);
    const erreur = el("div", { "aria-live": "polite" });
    zone.appendChild(erreur);
    let envoi = false;
    async function creer() {
      if (envoi) return;
      erreur.textContent = "";
      const v = remise.value.trim() === "" ? "0" : remise.value.trim(), n = Number(v);
      const a = new Date(); const jour = a.getFullYear() + "-" + String(a.getMonth() + 1).padStart(2, "0") + "-" + String(a.getDate()).padStart(2, "0");
      let msg = null;
      if (!/^[0-9]{1,12}$/.test(v) || n >= Number(total)) msg = "La remise doit être un entier inférieur au total de la commande.";
      else if (echeance.value && echeance.value < jour) msg = "La date limite ne peut pas être avant aujourd'hui.";
      if (msg) { erreur.appendChild(el("p", { class: "adm-etat adm-etat-erreur", role: "alert", text: msg })); return; }
      envoi = true; bloquer(true);
      try {
        const r = await rpc("create_invoice_for_order", { p_order_id: ligne.id, p_due_date: echeance.value || null, p_discount_fcfa: n, p_notes: notes.value.trim() || null });
        if (r.error) throw r.error;
        const f = r.data;
        rafraichir();
        ui.dialogue({ titre: "Facture créée", corps: el("p", { text: "La facture " + ((f && f.invoice_number) || "") + " a été créée." }), actions: [
          { libelle: "Voir / imprimer", principal: true, garder: true, clic: function () { if (window.KYR_FACTURE && f) window.KYR_FACTURE.afficher(f); else ui.toast("Ouvrez-la depuis Finance > Factures.", "info"); } },
          { libelle: "Fermer" },
        ] });
      } catch (e) { await signaler(erreur, e); } finally { envoi = false; bloquer(false); }
    }
    ui.dialogue({ titre: titre, corps: zone, actions: [{ libelle: "Créer la facture", principal: true, garder: true, clic: creer }, { libelle: "Fermer" }] });
  }

  /* ---------- Liste des commandes ---------- */
  function commandes(corps, ctx) {
    const proprietaire = ctx.role === "owner";
    const rafraichir = function () { if (ctx.actif()) commandes(corps, ctx); };
    const actions = [{ libelle: "Détail", clic: detailCommande }];
    if (proprietaire) {
      actions.push({ libelle: "Prix", clic: function (l) { dialoguePrix(l, rafraichir); } });
      actions.push({ libelle: "Statut", clic: function (l) { dialogueStatut(l, rafraichir); } });
      actions.push({ libelle: "Facturer", clic: function (l) { dialogueFacture(l, rafraichir); } });
    }
    ui.liste(corps, ctx, {
      titre: "Commandes", taille: 20, legende: "Commandes",
      intro: proprietaire
        ? "Demandes de commande reçues. Étapes : confirmer les prix (« Prix »), changer le statut (« Statut »), puis créer la facture (« Facturer »)."
        : "Demandes de commande reçues (consultation). Seul le propriétaire peut confirmer les prix, changer le statut et facturer.",
      filtres: [{ cle: "status", libelle: "Statut", options: [["", "Tous les statuts"]].concat(ui.STATUTS_COMMANDE.map(function (s) { return [s, ui.STATUTS[s]]; })) }],
      colonnes: ["order_number", "status", "customer_number", "customer_name", "items_count", "total_indicative_fcfa", "total_confirmed_fcfa", "prices_to_confirm", "created_at"], masquer: ["id"],
      charger: async function (p) {
        const r = await rpc("staff_list_orders", { p_status: p.valeurs.status || null, p_limit: p.taille, p_offset: p.page * p.taille });
        if (r.error) throw r.error;
        return { lignes: r.data || [], total: null };
      },
      actionsLigne: actions,
    });
  }

  ui.enregistrer("ventes", { clients: clients, commandes: commandes });
})();
