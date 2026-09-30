/*
  Liste des produits du site.
  Pour ajouter un produit, copiez une ligne et remplacez les valeurs :
    nom       : nom affiché sur la carte
    categorie : le groupe du filtre (par exemple "iPhone", "Samsung", "Google Pixel", "Apple Watch")
    prix      : prix en FCFA, en nombre sans espace (exemple : 650000). Laisser vide pour afficher "Prix sur WhatsApp".
    image     : nom du fichier photo, par exemple "iphone-15-pro.webp". Laisser vide si pas de photo.
    options   : (facultatif) choix proposés sur la fiche produit : couleurs, stockages, etats, sims.
*/
window.PRODUCTS = [
  {
    nom: "iPhone 18 Pro Max", categorie: "iPhone", prix: 1070000, image: "iphone-18-pro-max.webp",
    options: {
      couleurs: [
        { nom: "Rouge bordeaux", hex: "#5E2434" },
        { nom: "Bleu", hex: "#2A45A8" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" }
      ],
      stockages: ["256 Go", "512 Go", "1 To", "2 To"],
      etats: [{ nom: "Scellé", detail: "Neuf dans son emballage" }],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  { nom: "iPhone 18 Pro", categorie: "iPhone", prix: 950000, image: "iphone-18-pro.webp" },
  { nom: "iPhone 17 Pro Max", categorie: "iPhone", prix: 690000, image: "iphone-17-pro-max.webp" },
  { nom: "iPhone 17 Pro", categorie: "iPhone", prix: 635000, image: "iphone-17-pro.webp" },
  { nom: "iPhone 17 Air", categorie: "iPhone", prix: 480000, image: "iphone-17-air.webp" },
  { nom: "iPhone 16 Pro Max", categorie: "iPhone", prix: 480000, image: "iphone-16-pro-max.webp" },
  { nom: "iPhone 17", categorie: "iPhone", prix: 450000, image: "iphone-17.webp" },
  { nom: "iPhone 16 Pro", categorie: "iPhone", prix: 405000, image: "iphone-16-pro.webp" },
  { nom: "Galaxy Note 20 Ultra", categorie: "Samsung", prix: 250000, image: "galaxy-note-20-ultra.webp" },
  { nom: "Galaxy S21", categorie: "Samsung", prix: 130000, image: "galaxy-s21.webp" },
  { nom: "Google Pixel 8", categorie: "Google Pixel", prix: 190000, image: "google-pixel-8.webp" },
  { nom: "Apple Watch Series 10", categorie: "Apple Watch", prix: 220000, image: "apple-watch-serie-10.webp" }
];
