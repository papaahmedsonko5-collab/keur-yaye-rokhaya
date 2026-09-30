/*
  Grille d'estimation pour Échange, Vente et Rétrogradation.
  Le site calcule : prix de base du modèle, puis déductions selon l'état.
  Les modèles absents de la liste "rachat" reçoivent "Estimation confirmée par notre équipe".

  1) Ajouter un modèle : copier une ligne dans "rachat".
       "iPhone 12" : 95000,                                  (même prix pour toutes les capacités)
       "iPhone 13 Pro" : { "128 Go": 200000, "256 Go": 220000 },   (un prix par capacité)
  2) Régler les déductions : 0.05 veut dire moins 5 %.

  ATTENTION : seul l'iPhone 11 Pro (70000) vient de la boutique.
  Les pourcentages de déduction sont des valeurs de départ, à vérifier et corriger.
*/
window.TARIFS = {
  arrondi: 5000,
  rachat: {
    "iPhone 11 Pro": 70000
  },
  deductions: {
    batterie: { "Plus de 90 %": 0, "80 à 90 %": 0.05, "Moins de 80 %": 0.12, "Je ne sais pas": 0.05 },
    ecran: { "Comme neuf": 0, "Petites rayures": 0.05, "Écran fissuré": 0.25 },
    dos: { "Comme neuf": 0, "Rayures légères": 0.03, "Chocs ou dos cassé": 0.15 },
    fonction: { "Tout fonctionne": 0, "Un ou plusieurs problèmes": 0.3 },
    boite: { "Boîte d’origine et chargeur": 0, "Chargeur seulement": 0.03, "Téléphone seul": 0.05 }
  }
};
