/*
 * Administration — Keur Yaye Rokhaya
 * Fondation sécurisée — étape 1
 *
 * PRINCIPES
 * - Session vérifiée par Supabase avec getUser().
 * - Rôles calculés par Supabase avec my_roles().
 * - AAL2 obligatoire pour accéder à l'administration.
 * - MFA TOTP via l'API officielle Supabase Auth.
 * - Aucun rôle ou niveau de sécurité dans localStorage/sessionStorage.
 * - Aucun module métier en écriture dans cette étape.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // PROTECTION DE LA PAGE
  // ---------------------------------------------------------------------------

  if (window.self !== window.top) {
    document.documentElement.textContent = "";
    return;
  }

  const client = window.KYR_SUPABASE;

  const ROLES_INTERFACE = ["owner", "admin"];

  const LIBELLES_ROLE = {
    owner: "Propriétaire",
    admin: "Administrateur technique",
  };

  const PAGE_CONNEXION = "connexion.html?redirect=" + encodeURIComponent("admin.html");

  const NOM_FACTEUR = "Keur Yaye Rokhaya Admin";

  const MSG = {
    indisponible:
      "Service temporairement indisponible. Réessayez plus tard.",

    reseau:
      "Connexion impossible pour le moment. Vérifiez votre réseau puis réessayez.",

    generique:
      "Une erreur est survenue. Réessayez.",

    droits:
      "Impossible de vérifier vos droits d'accès pour le moment. Réessayez.",

    format:
      "Saisissez le code à 6 chiffres affiché par votre application.",

    codeFaux:
      "Code incorrect ou expiré. Vérifiez l'heure de votre téléphone puis réessayez.",

    tropEssais:
      "Trop de tentatives. Patientez quelques minutes avant de réessayer.",

    valide:
      "Authentification validée.",

    mfaExpiree:
      "Votre validation de sécurité n'est plus active. Saisissez à nouveau un code.",

    qrInvalide:
      "La configuration MFA n'a pas pu être préparée. Réessayez.",
  };

  const $ = function (id) {
    return document.getElementById(id);
  };

  const VUES = [
    "chargement",
    "erreur",
    "refus",
    "mfa",
  ];

  // ---------------------------------------------------------------------------
  // ÉTAT LOCAL D'AFFICHAGE
  // ---------------------------------------------------------------------------

  const etat = {
    vue: null,
    evaluation: false,
    relancer: false,
    deconnexionVolontaire: false,
    occupe: false,
    facteurEnrolement: null,
    facteurVerifie: null,
    etaitAAL2: false,
    derniereEvaluation: 0,
  };

  // ---------------------------------------------------------------------------
  // AFFICHAGE
  // ---------------------------------------------------------------------------

  function montrer(nom) {
    VUES.forEach(function (vue) {
      const element = $("adm-v-" + vue);

      if (element) {
        element.hidden = vue !== nom;
      }
    });

    const ecran = $("adm-ecran");
    const app = $("adm-app");

    if (ecran) {
      ecran.hidden = nom === "app";
    }

    if (app) {
      app.hidden = nom !== "app";
    }

    const titre =
      nom === "app"
        ? $("adm-titre-app")
        : $("adm-t-" + nom);

    if (titre && etat.vue !== nom) {
      titre.focus();
    }

    etat.vue = nom;
  }

  function ecrire(id, texte, type) {
    const element = $(id);

    if (!element) {
      return;
    }

    element.textContent = texte || "";

    element.classList.remove("erreur", "succes");

    if (type) {
      element.classList.add(type);
    }
  }

  function montrerErreur(texte) {
    ecrire("adm-erreur-texte", texte);
    montrer("erreur");
  }

  function viderApp() {
    [
      "adm-email",
      "adm-user-email",
      "adm-mfa-email",
      "adm-role",
      "adm-user-role",
      "adm-mfa-role",
      "adm-securite",
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.textContent = "";
      }
    });
  }

  function remplirIdentite(email, role, niveau) {
    const aal2 = niveau === "aal2";
    const adresse = email || "";
    const libelle = LIBELLES_ROLE[role] || "";

    [
      "adm-email",
      "adm-user-email",
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.textContent = aal2 ? adresse : "";
      }
    });

    [
      "adm-role",
      "adm-user-role",
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.textContent = aal2 ? libelle : "";
      }
    });

    const mfaEmail = $("adm-mfa-email");
    const mfaRole = $("adm-mfa-role");

    if (mfaEmail) {
      mfaEmail.textContent = aal2 ? "" : adresse;
    }

    if (mfaRole) {
      mfaRole.textContent = aal2 ? "" : libelle;
    }

    const securite = $("adm-securite");

    if (securite) {
      securite.textContent = aal2
        ? "AAL2 · MFA activé"
        : "MFA requis";

      securite.classList.toggle("alerte", !aal2);
    }
  }

  function versConnexion() {
    window.location.replace(PAGE_CONNEXION);
  }

  async function effacerSessionLocale() {
    etat.deconnexionVolontaire = true;

    try {
      await client.auth.signOut({
        scope: "local",
      });
    } catch (e) {
      console.error(
        "Administration — nettoyage de la session :",
        e
      );
    }
  }

  // ---------------------------------------------------------------------------
  // ERREURS
  // ---------------------------------------------------------------------------

  function estReseau(e) {
    return (
      !!e &&
      (
        e.name === "AuthRetryableFetchError" ||
        /failed to fetch|networkerror|network request failed|load failed/i.test(
          String(e.message || "")
        )
      )
    );
  }

  function classer(e) {
    const texte =
      String((e && e.message) || "") +
      " " +
      String((e && e.details) || "") +
      " " +
      String((e && e.hint) || "");

    const code = String((e && e.code) || "");
    const statut = e && e.status;

    if (
      /KYR_UNAUTHENTICATED/.test(texte) ||
      code === "28000" ||
      code === "PGRST301" ||
      (e && e.name === "AuthSessionMissingError") ||
      statut === 401
    ) {
      return "UNAUTHENTICATED";
    }

    if (/KYR_MFA_REQUIRED/.test(texte)) {
      return "MFA_REQUIRED";
    }

    if (
      /KYR_FORBIDDEN/.test(texte) ||
      code === "42501" ||
      statut === 403
    ) {
      return "FORBIDDEN";
    }

    if (estReseau(e)) {
      return "RESEAU";
    }

    return "INCONNUE";
  }

  async function traiter(e, contexte) {
    console.error(
      "Administration — " + contexte + " :",
      e
    );

    switch (classer(e)) {
      case "UNAUTHENTICATED":
        await effacerSessionLocale();
        versConnexion();
        return;

      case "MFA_REQUIRED":
        await exigerMfa();
        return;

      case "FORBIDDEN":
        viderApp();
        montrer("refus");
        return;

      case "RESEAU":
        montrerErreur(MSG.reseau);
        return;

      default:
        montrerErreur(MSG.generique);
    }
  }

  // ---------------------------------------------------------------------------
  // SESSION → RÔLE → AAL
  // ---------------------------------------------------------------------------

  async function evaluer() {
    if (etat.evaluation) {
      etat.relancer = true;
      return;
    }

    etat.evaluation = true;

    try {
      do {
        etat.relancer = false;
        await evaluerUneFois();
      } while (etat.relancer);
    } finally {
      etat.evaluation = false;
      etat.derniereEvaluation = Date.now();
    }
  }

  async function evaluerUneFois() {
    // -------------------------------------------------------------------------
    // 1. SESSION
    // -------------------------------------------------------------------------

    let reponse;

    try {
      reponse = await client.auth.getUser();
    } catch (e) {
      return traiter(e, "session");
    }

    if (
      reponse.error ||
      !reponse.data ||
      !reponse.data.user
    ) {
      if (
        reponse.error &&
        estReseau(reponse.error)
      ) {
        return traiter(reponse.error, "session");
      }

      await effacerSessionLocale();
      return versConnexion();
    }

    const utilisateur = reponse.data.user;

    // -------------------------------------------------------------------------
    // 2. RÔLE
    // -------------------------------------------------------------------------

    let roles;

    try {
      const r = await client.rpc("my_roles");

      if (r.error) {
        return traiter(r.error, "my_roles");
      }

      roles = Array.isArray(r.data)
        ? r.data.filter(function (role) {
            return typeof role === "string";
          })
        : [];
    } catch (e) {
      return traiter(e, "my_roles");
    }

    const autorises = roles.filter(function (role) {
      return ROLES_INTERFACE.indexOf(role) !== -1;
    });

    if (autorises.length === 0) {
      viderApp();
      etat.etaitAAL2 = false;
      montrer("refus");
      return;
    }

    const role =
      autorises.indexOf("owner") !== -1
        ? "owner"
        : "admin";

    // -------------------------------------------------------------------------
    // 3. NIVEAU D'ASSURANCE
    // -------------------------------------------------------------------------

    let aal;

    try {
      aal =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
    } catch (e) {
      return traiter(e, "niveau d'assurance");
    }

    if (aal.error) {
      return traiter(
        aal.error,
        "niveau d'assurance"
      );
    }

    const niveau =
      aal.data &&
      aal.data.currentLevel;

    remplirIdentite(
      utilisateur.email,
      role,
      niveau
    );

    // -------------------------------------------------------------------------
    // 4. AAL2 → ACCÈS ADMIN
    // -------------------------------------------------------------------------

    if (niveau === "aal2") {
      etat.etaitAAL2 = true;

      montrer("app");

      if (
        window.KYR_ADMIN_UI &&
        typeof window.KYR_ADMIN_UI.entrer === "function"
      ) {
        window.KYR_ADMIN_UI.entrer({
          role: role,
        });
      }

      return;
    }

    // -------------------------------------------------------------------------
    // 5. AAL1 → MFA
    // -------------------------------------------------------------------------

    const etaitAAL2 = etat.etaitAAL2;

    etat.etaitAAL2 = false;

    if (!(await preparerMfa())) {
      return;
    }

    if (etaitAAL2) {
      ecrire(
        "adm-mfa-message",
        MSG.mfaExpiree,
        "erreur"
      );
    }

    montrer("mfa");
  }

  async function exigerMfa() {
    viderApp();
    etat.etaitAAL2 = false;

    if (!(await preparerMfa())) {
      return;
    }
    montrer("mfa");
  }

  // ---------------------------------------------------------------------------
  // MFA
  // ---------------------------------------------------------------------------

  function afficherModeMfa(mode) {
    const config = $("adm-mfa-config");
    const enrol = $("adm-mfa-enrol");
    const form = $("adm-mfa-form");
    const annuler = $("adm-mfa-annuler");

    if (config) {
      config.hidden = mode !== "configurer";
    }

    if (enrol) {
      enrol.hidden = mode !== "enrolement";
    }

    if (form) {
      form.hidden = mode === "configurer";
    }

    if (annuler) {
      annuler.hidden = mode !== "enrolement";
    }
  }

  async function facteursTotp() {
    const r =
      await client.auth.mfa.listFactors();

    if (r.error) {
      throw r.error;
    }

    const tous =
      (r.data && r.data.all) || [];

    const totpVerifies =
      (r.data && r.data.totp) || [];

    return {
      verifies: totpVerifies.filter(function (facteur) {
        return (
          facteur &&
          typeof facteur.id === "string" &&
          facteur.status === "verified"
        );
      }),

      abandonnes: tous.filter(function (facteur) {
        return (
          facteur &&
          facteur.factor_type === "totp" &&
          facteur.status !== "verified" &&
          typeof facteur.id === "string"
        );
      }),
    };
  }

  async function preparerMfa() {
    if (etat.facteurEnrolement) {
      afficherModeMfa("enrolement");
      return true;
    }

    try {
      const facteurs = await facteursTotp();

      if (facteurs.verifies.length > 0) {
        etat.facteurVerifie =
          facteurs.verifies[0].id;

        afficherModeMfa("valider");
      } else {
        etat.facteurVerifie = null;

        afficherModeMfa("configurer");
      }
      return true;
    } catch (e) {
      console.error(
        "Administration — liste des facteurs :",
        e
      );

      etat.facteurVerifie = null;
      montrerErreur(MSG.indisponible);
      return false;
    }
  }

  function changerOccupation(actif) {
    etat.occupe = actif;

    [
      "adm-mfa-demarrer",
      "adm-mfa-valider",
      "adm-mfa-annuler",
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.disabled = actif;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // ENRÔLEMENT TOTP
  // ---------------------------------------------------------------------------

  async function demarrerEnrolement() {
    if (etat.occupe) {
      return;
    }

    changerOccupation(true);

    ecrire(
      "adm-mfa-message",
      ""
    );

    try {
      // Nettoyage des facteurs TOTP non vérifiés.
      const facteurs = await facteursTotp();

      for (const abandonne of fatoresAbandonnes(facteurs)) {
        const resultat =
          await client.auth.mfa.unenroll({
            factorId: abandonne.id,
          });

        if (resultat.error) {
          throw resultat.error;
        }
      }

      // Création du facteur TOTP officiel Supabase.
      const r =
        await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: NOM_FACTEUR,
          issuer: "Keur Yaye Rokhaya",
        });

      if (r.error) {
        throw r.error;
      }

      const totp =
        r.data &&
        r.data.totp;

      /*
       * Supabase peut renvoyer :
       *
       * data:image/svg+xml;utf-8,<?xml ... ?><svg ...
       *
       * ou directement :
       *
       * data:image/svg+xml,<svg ...
       *
       * On accepte uniquement une Data URL SVG.
       */
      const FORME_QR =
        /^data:image\/svg\+xml(?:;[^,]*)?,(?:<\?xml[\s\S]*?<svg[\s>]|<svg[\s>])/i;

      if (
        !r.data ||
        typeof r.data.id !== "string" ||
        !totp ||
        typeof totp.qr_code !== "string" ||
        !FORME_QR.test(totp.qr_code) ||
        typeof totp.secret !== "string"
      ) {
        throw new Error(
          "Réponse d'enrôlement inattendue"
        );
      }

      etat.facteurEnrolement =
        r.data.id;

      const qr = $("adm-mfa-qr");

      if (qr) {
        qr.src = totp.qr_code;
        qr.hidden = false;
      }

      const secret = $("adm-mfa-secret");

      if (secret) {
        secret.textContent =
          totp.secret
            .replace(/(.{4})/g, "$1 ")
            .trim();
      }

      afficherModeMfa("enrolement");

      const champ = $("adm-mfa-code");

      if (champ) {
        champ.value = "";
        champ.focus();
      }
    } catch (e) {
      console.error(
        "Administration — enrôlement :",
        e
      );

      ecrire(
        "adm-mfa-message",
        classer(e) === "RESEAU"
          ? MSG.reseau
          : MSG.qrInvalide,
        "erreur"
      );
    } finally {
      changerOccupation(false);
    }
  }

  function fatoresAbandonnes(facteurs) {
    return Array.isArray(facteurs.abandonnes)
      ? facteurs.abandonnes
      : [];
  }

  function effacerEnrolement() {
    etat.facteurEnrolement = null;

    const qr = $("adm-mfa-qr");

    if (qr) {
      qr.removeAttribute("src");
      qr.hidden = true;
    }

    const secret = $("adm-mfa-secret");

    if (secret) {
      secret.textContent = "";
    }

    const code = $("adm-mfa-code");

    if (code) {
      code.value = "";
    }
  }

  async function annulerEnrolement() {
    if (
      etat.occupe ||
      !etat.facteurEnrolement
    ) {
      return;
    }

    changerOccupation(true);

    try {
      const resultat =
        await client.auth.mfa.unenroll({
          factorId:
            etat.facteurEnrolement,
        });

      if (resultat.error) {
        console.error(
          "Administration — annulation de l'enrôlement :",
          resultat.error
        );
      }
    } catch (e) {
      console.error(
        "Administration — annulation de l'enrôlement :",
        e
      );
    }

    effacerEnrolement();

    ecrire(
      "adm-mfa-message",
      ""
    );

    changerOccupation(false);

    await preparerMfa();
  }

  // ---------------------------------------------------------------------------
  // VALIDATION TOTP
  // ---------------------------------------------------------------------------

  async function validerCode(evenement) {
    evenement.preventDefault();

    if (etat.occupe) {
      return;
    }

    const champ = $("adm-mfa-code");

    if (!champ) {
      return;
    }

    const code =
      champ.value.replace(/\s+/g, "");

    if (!/^[0-9]{6}$/.test(code)) {
      ecrire(
        "adm-mfa-message",
        MSG.format,
        "erreur"
      );

      champ.focus();
      return;
    }

    const factorId =
      etat.facteurEnrolement ||
      etat.facteurVerifie;

    if (!factorId) {
      ecrire(
        "adm-mfa-message",
        MSG.generique,
        "erreur"
      );
      return;
    }

    changerOccupation(true);

    ecrire(
      "adm-mfa-message",
      ""
    );

    try {
      const defi =
        await client.auth.mfa.challenge({
          factorId: factorId,
        });

      if (defi.error) {
        throw defi.error;
      }

      if (
        !defi.data ||
        typeof defi.data.id !== "string"
      ) {
        throw new Error(
          "Challenge MFA invalide"
        );
      }

      const verification =
        await client.auth.mfa.verify({
          factorId: factorId,
          challengeId: defi.data.id,
          code: code,
        });

      if (verification.error) {
        throw verification.error;
      }

      effacerEnrolement();

      etat.facteurVerifie =
        factorId;

      ecrire(
        "adm-mfa-message",
        MSG.valide,
        "succes"
      );

      changerOccupation(false);

      // Revalidation complète après passage en AAL2.
      await evaluer();

      return;
    } catch (e) {
      console.error(
        "Administration — validation du code :",
        e
      );

      const statut =
        e && e.status;

      ecrire(
        "adm-mfa-message",
        statut === 429 ||
        /rate limit/i.test(
          String((e && e.message) || "")
        )
          ? MSG.tropEssais
          : estReseau(e)
          ? MSG.reseau
          : MSG.codeFaux,
        "erreur"
      );

      champ.value = "";
      champ.focus();
    }

    changerOccupation(false);
  }

  // ---------------------------------------------------------------------------
  // DÉCONNEXION
  // ---------------------------------------------------------------------------

  async function deconnecter() {
    etat.deconnexionVolontaire = true;

    Array.prototype.forEach.call(
      document.querySelectorAll(
        "[data-action='deconnexion']"
      ),
      function (button) {
        button.disabled = true;
      }
    );

    try {
      await client.auth.signOut();
    } catch (e) {
      console.error(
        "Administration — déconnexion :",
        e
      );
    }

    window.location.replace("index.html");
  }

  // ---------------------------------------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------------------------------------

  function demarrer() {
    if (
      !client ||
      !client.auth ||
      typeof client.rpc !== "function"
    ) {
      console.error(
        "KYR_SUPABASE introuvable."
      );

      montrerErreur(MSG.indisponible);

      const retry = $("adm-reessayer");

      if (retry) {
        retry.hidden = true;
      }

      return;
    }

    // Déconnexion.
    Array.prototype.forEach.call(
      document.querySelectorAll(
        "[data-action='deconnexion']"
      ),
      function (button) {
        button.addEventListener(
          "click",
          deconnecter
        );
      }
    );

    // Bouton réessayer.
    const retry = $("adm-reessayer");

    if (retry) {
      retry.addEventListener(
        "click",
        function () {
          montrer("chargement");
          evaluer();
        }
      );
    }

    // Bouton démarrer MFA.
    const demarrerMfa =
      $("adm-mfa-demarrer");

    if (demarrerMfa) {
      demarrerMfa.addEventListener(
        "click",
        demarrerEnrolement
      );
    }

    // Bouton annuler MFA.
    const annulerMfa =
      $("adm-mfa-annuler");

    if (annulerMfa) {
      annulerMfa.addEventListener(
        "click",
        annulerEnrolement
      );
    }

    // Formulaire MFA.
    const formulaireMfa =
      $("adm-mfa-form");

    if (formulaireMfa) {
      formulaireMfa.addEventListener(
        "submit",
        validerCode
      );
    }

    // -------------------------------------------------------------------------
    // ÉVÉNEMENTS SUPABASE
    // -------------------------------------------------------------------------

    client.auth.onAuthStateChange(
      function (evenement) {
        if (evenement === "SIGNED_OUT") {
          if (!etat.deconnexionVolontaire) {
            versConnexion();
          }

          return;
        }

        if (
          evenement === "SIGNED_IN" ||
          evenement === "TOKEN_REFRESHED" ||
          evenement === "USER_UPDATED" ||
          evenement === "MFA_CHALLENGE_VERIFIED"
        ) {
          window.setTimeout(
            evaluer,
            0
          );
        }
      }
    );

    // -------------------------------------------------------------------------
    // REVALIDATION AU RETOUR SUR LA PAGE
    // -------------------------------------------------------------------------

    document.addEventListener(
      "visibilitychange",
      function () {
        if (
          document.visibilityState === "visible" &&
          etat.vue &&
          etat.vue !== "chargement" &&
          Date.now() - etat.derniereEvaluation > 10000
        ) {
          evaluer();
        }
      }
    );

    // Première évaluation.
    evaluer();
  }

  // ---------------------------------------------------------------------------
  // LANCEMENT
  // ---------------------------------------------------------------------------

  demarrer();
})();
