(function () {
  "use strict";

  const form = document.getElementById("connexion-form");
  const message = document.getElementById("connexion-message");

  if (!form || !message) return;

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
      const { data, error } =
        await window.KYR_SUPABASE.auth.signInWithPassword({
          email: email,
          password: password
        });

      if (error) {
        console.error("Erreur connexion Supabase :", error);

        if (
          error.message.toLowerCase().includes("email not confirmed")
        ) {
          message.textContent =
            "Votre adresse e-mail n'est pas encore confirmée. Consultez votre boîte mail.";
        } else {
          message.textContent =
            "E-mail ou mot de passe incorrect.";
        }

        return;
      }

      console.log("Connexion réussie :", data.user?.id);

      message.className = "auth-message success";
      message.textContent = "Connexion réussie. Redirection...";

      setTimeout(function () {
        window.location.href = "index.html";
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