(function () {
  "use strict";

  const form = document.getElementById("connexion-form");
  const message = document.getElementById("connexion-message");

  if (!form || !message) return;

  // Redirection après connexion : LISTE BLANCHE de pages internes (comparaison exacte).
  // Toute autre valeur (adresse externe, //domaine, javascript:, chemin...) est ignorée : jamais de redirection ouverte.
  const DESTINATIONS_AUTORISEES = ["espace-client.html", "index.html", "admin.html"];
  const DESTINATION_PAR_DEFAUT = "espace-client.html";

  function destination() {
    const demande = new URLSearchParams(window.location.search).get("redirect");
    return DESTINATIONS_AUTORISEES.indexOf(demande) !== -1 ? demande : DESTINATION_PAR_DEFAUT;
  }

  // Déjà connecté : inutile de ressaisir le mot de passe
  if (window.KYR_SUPABASE) {
    window.KYR_SUPABASE.auth.getSession().then(function (res) {
      if (res && res.data && res.data.session) window.location.replace(destination());
    }).catch(function () { /* on reste sur le formulaire */ });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";
    message.className = "auth-message";

    if (!window.KYR_SUPABASE) {
      message.textContent = "Service temporairement indisponible. Réessayez plus tard.";
      console.error("KYR_SUPABASE introuvable.");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Connexion...";

    try {
      const { error } =
        await window.KYR_SUPABASE.auth.signInWithPassword({
          email: email,
          password: password
        });

      if (error) {
        console.error("Erreur connexion Supabase :", error.code || error.message);

        if (
          error.code === "email_not_confirmed" ||
          (error.message || "").toLowerCase().includes("email not confirmed")
        ) {
          message.textContent =
            "Votre adresse e-mail n'est pas encore confirmée. Consultez votre boîte mail.";
        } else {
          message.textContent =
            "E-mail ou mot de passe incorrect.";
        }

        return;
      }

      message.className = "auth-message success";
      message.textContent = "Connexion réussie. Redirection...";

      setTimeout(function () {
        window.location.href = destination();
      }, 800);

    } catch (error) {
      console.error("Erreur inattendue :", error);
      message.textContent =
        "Une erreur est survenue. Réessayez plus tard.";
    } finally {
      button.disabled = false;
      button.textContent = "Se connecter";
    }
  });
})();
