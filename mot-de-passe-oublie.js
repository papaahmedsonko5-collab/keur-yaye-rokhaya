(function () {
  "use strict";

  const form = document.getElementById("oubli-form");
  const message = document.getElementById("oubli-message");

  if (!form || !message) return;

  // Adresse de la page « nouveau mot de passe » : celle du site réellement servi (production, GitHub Pages...).
  // Ouvert directement depuis le disque (file://), on utilise l'adresse de production. Aucune adresse locale en dur.
  function adresseNouveauMotDePasse() {
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      return new URL("nouveau-mot-de-passe.html", window.location.href).href;
    }
    return "https://keuryayerokhaya.com/nouveau-mot-de-passe.html";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();

    message.textContent = "";
    message.className = "auth-message";

    if (!window.KYR_SUPABASE) {
      message.textContent = "Service temporairement indisponible. Réessayez plus tard.";
      console.error("KYR_SUPABASE introuvable.");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Envoi...";

    try {
      const { error } = await window.KYR_SUPABASE.auth.resetPasswordForEmail(email, {
        redirectTo: adresseNouveauMotDePasse()
      });

      if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
        message.textContent = "Trop de demandes. Réessayez dans quelques minutes.";
        return;
      }

      if (error) {
        console.error("Erreur mot de passe oublié :", error.code || error.message);
      }

      // Même message dans tous les autres cas : on ne révèle jamais si une adresse possède un compte.
      message.className = "auth-message success";
      message.textContent =
        "Si cette adresse correspond à un compte, un e-mail vient de vous être envoyé. Consultez votre boîte de réception.";
    } catch (error) {
      console.error("Erreur inattendue :", error);
      message.textContent = "Une erreur est survenue. Réessayez plus tard.";
    } finally {
      button.disabled = false;
      button.textContent = "Envoyer le lien";
    }
  });
})();
