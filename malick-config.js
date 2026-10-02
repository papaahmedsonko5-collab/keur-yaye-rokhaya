/*
  Configuration de Malick (assistant). Aucun secret ici : ce fichier est public.
  - apiUrl vide : mode démonstration. Malick répond depuis malick-kb.json et le catalogue,
    dans le navigateur, sans rien envoyer à un serveur.
  - apiUrl rempli : adresse de la fonction sécurisée (Supabase Edge Function) qui contient
    la clé du service d'IA. Exemple : "https://xxxx.supabase.co/functions/v1/malick"
*/
window.MALICK_CONFIG = {
  apiUrl: ""
};
