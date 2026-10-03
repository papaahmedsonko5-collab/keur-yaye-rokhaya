(function () {
  "use strict";

  const form = document.getElementById("inscription-form");
  const message = document.getElementById("inscription-message");

  if (!form || !message) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("password-confirm").value;
    const consent = document.getElementById("privacy-consent").checked;

    message.textContent = "";
    message.className = "auth-message";

    if (!consent) {
      message.textContent = "Vous devez accepter les conditions et la politique de confidentialité.";
      return;
    }

    if (password.length < 8) {
      message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }

    if (password !== passwordConfirm) {
      message.textContent = "Les deux mots de passe ne correspondent pas.";
      return;
    }

    if (!window.KYR_SUPABASE) {
      message.textContent = "Service temporairement indisponible. Réessayez plus tard.";
      console.error("KYR_SUPABASE introuvable.");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Création du compte...";

    try {
      const { data, error } = await window.KYR_SUPABASE.auth.signUp({
        email: email,
        password: password
      });

      if (error) {
        console.error("Erreur inscription Supabase :", error);

        if (error.message.toLowerCase().includes("already registered")) {
          message.textContent = "Cette adresse e-mail possède déjà un compte.";
        } else {
          message.textContent = "Impossible de créer le compte. Vérifiez vos informations.";
        }

        return;
      }

      console.log("Compte créé :", data);

      message.className = "auth-message success";
      message.textContent =
        "Compte créé. Consultez votre e-mail pour confirmer votre adresse avant de vous connecter.";

      form.reset();

    } catch (error) {
      console.error("Erreur inattendue :", error);
      message.textContent = "Une erreur est survenue. Réessayez plus tard.";
    } finally {
      button.disabled = false;
      button.textContent = "Créer mon compte";
    }
  });
})();