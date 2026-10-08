(function () {
  "use strict";

  // Tout le texte affiché passe par textContent : aucune donnée n'est jamais interprétée comme du HTML.
  const chargement = document.getElementById("espace-chargement");
  const erreur = document.getElementById("espace-erreur");
  const contenu = document.getElementById("espace-contenu");
  const champEmail = document.getElementById("compte-email");
  const champStatut = document.getElementById("compte-statut");
  const champConfirme = document.getElementById("compte-confirme");
  const etatCommandes = document.getElementById("commandes-etat");
  const listeCommandes = document.getElementById("commandes-liste");
  const boutonDeconnexion = document.getElementById("deconnexion");

  if (!chargement || !erreur || !contenu || !boutonDeconnexion) return;

  const client = window.KYR_SUPABASE;

  const STATUTS_COMPTE = { active: "Actif", suspended: "Suspendu", closed: "Fermé" };
  const STATUTS_COMMANDE = {
    requested: "Demande envoyée",
    confirmed: "Confirmée",
    preparing: "En préparation",
    ready: "Prête",
    delivered: "Livrée",
    cancelled: "Annulée"
  };

  function versConnexion() {
    window.location.replace("connexion.html?redirect=espace-client.html");
  }

  function montrerErreur(texte) {
    chargement.hidden = true;
    contenu.hidden = true;
    erreur.textContent = texte;
    erreur.hidden = false;
  }

  function formaterDate(valeur) {
    const d = new Date(valeur);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  function formaterMontant(valeur) {
    return (typeof valeur === "number" && isFinite(valeur) && valeur > 0)
      ? valeur.toLocaleString("fr-FR") + " FCFA"
      : "Prix à confirmer";
  }

  function ligne(classe, tag, texte) {
    const e = document.createElement(tag);
    e.className = classe;
    e.textContent = texte;
    return e;
  }

  function afficherCommandes(commandes) {
    listeCommandes.textContent = "";

    if (!commandes.length) {
      listeCommandes.hidden = true;
      etatCommandes.hidden = false;
      etatCommandes.textContent = "Aucune commande enregistrée pour le moment.";
      return;
    }

    commandes.forEach(function (c) {
      const li = document.createElement("li");
      li.className = "order-item";
      li.appendChild(ligne("", "strong", String(c.order_number || "Commande")));
      const date = formaterDate(c.created_at);
      if (date) li.appendChild(ligne("order-meta", "span", "Passée le " + date));
      li.appendChild(ligne("order-status", "span", STATUTS_COMMANDE[c.status] || "En cours"));
      li.appendChild(ligne("order-meta", "span", "Total : " + formaterMontant(c.total_confirmed_fcfa)));
      listeCommandes.appendChild(li);
    });

    etatCommandes.hidden = true;
    listeCommandes.hidden = false;
  }

  // Les commandes viennent de Supabase : la règle RLS « orders_select_own » ne renvoie QUE celles du client connecté.
  // On ajoute en plus le filtre user_id côté serveur (PostgREST) : jamais de tri des commandes des autres dans le navigateur.
  // Colonnes demandées explicitement (jamais « * »).
  async function chargerCommandes(utilisateur) {
    try {
      const r = await client
        .from("orders")
        .select("id, order_number, status, total_confirmed_fcfa, created_at")
        .eq("user_id", utilisateur.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (r.error) {
        console.error("Commandes indisponibles :", r.error.code || r.error.message);
        etatCommandes.hidden = false;
        etatCommandes.textContent = "Le suivi de vos commandes sera disponible lorsqu'une commande sera enregistrée.";
        return;
      }
      afficherCommandes(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error("Erreur commandes :", e);
      etatCommandes.hidden = false;
      etatCommandes.textContent = "Impossible de charger vos commandes pour le moment. Réessayez plus tard.";
    }
  }

  async function chargerStatut(utilisateur) {
    const confirme = !!utilisateur.email_confirmed_at;
    champConfirme.textContent = confirme ? "Oui" : "Non, consultez votre boîte mail";
    try {
      const r = await client.from("profiles").select("status").eq("id", utilisateur.id).maybeSingle();
      if (!r.error && r.data && STATUTS_COMPTE[r.data.status]) {
        champStatut.textContent = STATUTS_COMPTE[r.data.status];
        return;
      }
    } catch (e) { /* on retombe sur l'état de l'e-mail */ }
    champStatut.textContent = confirme ? "Actif" : "En attente de confirmation de l'e-mail";
  }

  async function deconnecter() {
    boutonDeconnexion.disabled = true;
    try { await client.auth.signOut(); } catch (e) { console.error("Erreur déconnexion :", e); }
    window.location.replace("index.html");
  }

  async function demarrer() {
    if (!client) {
      console.error("KYR_SUPABASE introuvable.");
      montrerErreur("Service temporairement indisponible. Réessayez plus tard.");
      return;
    }

    let utilisateur = null;
    let reseauCoupe = false;
    let sessionRefusee = false;
    try {
      // getUser() fait vérifier la session par le serveur Supabase (et non seulement par le navigateur).
      const r = await client.auth.getUser();
      utilisateur = r && r.data ? r.data.user : null;
      if (!utilisateur && r && r.error) {
        reseauCoupe = r.error.name === "AuthRetryableFetchError";
        sessionRefusee = !reseauCoupe;
      }
    } catch (e) {
      console.error("Erreur session :", e);
    }

    if (!utilisateur) {
      // Réseau coupé : on le dit, sans renvoyer vers la connexion (sinon boucle de redirections tant que le réseau est coupé).
      if (reseauCoupe) { montrerErreur("Connexion impossible pour le moment. Vérifiez votre réseau puis réessayez."); return; }
      // Session refusée par le serveur mais encore présente dans le navigateur : on la retire (cet appareil seulement),
      // sinon connexion.html, qui croit la session locale, renverrait ici en boucle.
      if (sessionRefusee) { try { await client.auth.signOut({ scope: "local" }); } catch (e) { console.error("Erreur nettoyage session :", e); } }
      versConnexion();
      return;
    }

    champEmail.textContent = utilisateur.email || "";
    chargement.hidden = true;
    contenu.hidden = false;

    chargerStatut(utilisateur);
    chargerCommandes(utilisateur);

    client.auth.onAuthStateChange(function (evenement) {
      if (evenement === "SIGNED_OUT") versConnexion();
    });
  }

  boutonDeconnexion.addEventListener("click", deconnecter);
  demarrer();
})();
