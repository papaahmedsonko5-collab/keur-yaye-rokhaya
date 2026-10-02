# Malick : service d'IA sécurisé (facultatif)

Le site fonctionne déjà sans ce service : Malick répond depuis `malick-kb.json` et le catalogue.
Ce service sert seulement aux questions que la base du site ne couvre pas.

**Principe : la clé du service d'IA n'est jamais dans le site ni sur GitHub.**

    Site (GitHub Pages)  ->  Fonction Supabase "malick" (détient la clé)  ->  Service d'IA

Les prix, les produits, les services et le contact restent toujours répondus par le site, jamais par l'IA.

## Mise en route (quand tu seras prêt)

1. Créer un projet sur supabase.com et installer le CLI Supabase.
2. Enregistrer la clé comme secret (jamais dans un fichier du dépôt) :

       supabase secrets set ANTHROPIC_API_KEY=ta_cle_ici

3. Déployer. L'option est nécessaire car le site n'envoie pas de jeton Supabase :

       supabase functions deploy malick --no-verify-jwt

4. Dans le site, ouvrir `malick-config.js` et renseigner l'adresse de la fonction :

       apiUrl: "https://TON-PROJET.supabase.co/functions/v1/malick"

5. Mettre à jour la page Confidentialité : les messages sont alors envoyés à ce service puis au fournisseur d'IA.

## Réglages (variables d'environnement Supabase)

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | clé du service d'IA (secret) | aucune |
| `ALLOWED_ORIGINS` | sites autorisés à appeler la fonction | keuryayerokhaya.com et github.io |
| `MALICK_KB_URL` | base de connaissances publique | https://keuryayerokhaya.com/malick-kb.json |
| `MALICK_MODEL` | modèle utilisé | claude-haiku-4-5-20251001 |

## Protections prévues

- Origine contrôlée, 10 messages maximum, 500 caractères maximum par message.
- 20 demandes par adresse IP toutes les 10 minutes (compteur en mémoire : à renforcer avant un fort trafic).
- Aucun détail technique renvoyé au navigateur en cas d'erreur.
- Règles de Malick dans le prompt : ne jamais inventer, ne jamais donner de prix, ne pas prendre de commande.
- À faire côté fournisseur : fixer une limite de dépense mensuelle.

## Avertissement

Ce code a été testé avec de fausses réponses (voir les tests décrits dans le rapport) mais **jamais avec une vraie clé ni sur un vrai projet Supabase**.
Fais un essai de bout en bout avant de brancher `apiUrl` sur le site.
