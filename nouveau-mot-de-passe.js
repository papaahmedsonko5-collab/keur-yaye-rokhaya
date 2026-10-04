(function () {
  "use strict";

  const verification = document.getElementById("mdp-verification");
  const form = document.getElementById("mdp-form");
  const invalide = document.getElementById("mdp-invalide");
  const message = document.getElementById("mdp-message");

  if (!verification || !form || !invalide || !message) return;

  // Lu tout de suite : Supabase retire ensuite les paramètres de l'adresse.
  const adresse = (window.location.hash || "") + "&" + (window.location.search || "");
  const lienEnErreur = /(^|[#?&])(error|error_code|error_description)=/.test(adresse);
  const lienDeRecuperation = /(^|[#?&])type=recovery(&|$)/.test(adresse) || /(^|[#?&])code=/.test(adresse);

  let formulaireAffiche = false;
  let termine = false;

  function montrerFormulaire() {
    if (formulaireAffiche || termine) return;
    formulaireAffiche = true;
    verification.hidden = true;
    invalide.hidden = true;
    form.hidden = false;
  }

  function montrerLienInvalide() {
    if (formulaireAffiche || termine) return;
    verification.hidden = true;
    form.hidden = true;
    invalide.hidden = false;
  }

  if (!window.KYR_SUPABASE) {
    verification.hidden = true;
    message.textContent = "Service temporairement indisponible. Réessayez plus tard.";
    console.error("KYR_SUPABASE introuvable.");
    return;
  }

  if (lienEnErreur) {
    montrerLienInvalide();
    return;
  }

  // Le formulaire n'apparaît QUE pour une session de récupération créée par le lien reçu par e-mail.
  window.KYR_SUPABASE.auth.onAuthStateChange(function (evenement, session) {
    if (evenement === "PASSWORD_RECOVERY") {
      montrerFormulaire();
    } else if (session && lienDeRecuperation && (evenement === "SIGNED_IN" || evenement === "INITIAL_SESSION")) {
      montrerFormulaire();
    }
  });

  // Aucun signal de récupération : ouverture directe de la page, ou lien déjà utilisé.
  window.setTimeout(montrerLienInvalide, 4000);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const mdp = document.getElementById("password").value;
    const confirmation = document.getElementById("password-confirm").value;

    message.textContent = "";
    message.className = "auth-message";

    if (mdp.length < 8) {
      message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }

    if (mdp !== confirmation) {
      message.textContent = "Les deux mots de passe ne correspondent pas.";
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Enregistrement...";

    try {
      const { error } = await window.KYR_SUPABASE.auth.updateUser({ password: mdp });

      if (error) {
        console.error("Erreur nouveau mot de passe :", error.code || error.message);

        if (error.code === "same_password") {
          message.textContent = "Choisissez un mot de passe différent de l'ancien.";
        } else if (error.code === "weak_password") {
          message.textContent = "Ce mot de passe est trop faible. Choisissez-en un plus long ou plus varié.";
        } else {
          message.textContent = "Impossible d'enregistrer le mot de passe. Demandez un nouveau lien et réessayez.";
        }
        return;
      }

      termine = true;
      form.reset();
      form.hidden = true;
      message.className = "auth-message success";
      message.textContent = "Mot de passe enregistré. Redirection vers votre espace client...";

      window.setTimeout(function () {
        window.location.href = "espace-client.html";
      }, 1500);
    } catch (error) {
      console.error("Erreur inattendue :", error);
      message.textContent = "Une erreur est survenue. Réessayez plus tard.";
    } finally {
      button.disabled = false;
      button.textContent = "Enregistrer le mot de passe";
    }
  });
})();
