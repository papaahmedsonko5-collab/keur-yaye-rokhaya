(function () {
  "use strict";

  // Interface seulement : afficher / masquer le mot de passe.
  // Ne touche ni à l'envoi du formulaire ni à l'authentification (connexion.js).
  const champ = document.getElementById("password");
  const bouton = document.getElementById("mdp-oeil");
  const form = document.getElementById("connexion-form");

  if (!champ || !bouton) return;

  function regler(visible) {
    champ.type = visible ? "text" : "password";
    bouton.setAttribute("data-etat", visible ? "visible" : "masque");
    bouton.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
  }

  bouton.addEventListener("click", function () {
    regler(champ.type === "password");
  });

  // Le mot de passe n'est jamais laissé affiché à l'envoi ni au retour sur la page (cache du navigateur).
  if (form) form.addEventListener("submit", function () { regler(false); });
  window.addEventListener("pageshow", function () { regler(false); });
})();
