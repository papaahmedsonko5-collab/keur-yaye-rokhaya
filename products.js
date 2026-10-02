/*
  Liste des produits du site. C'est la seule source des produits et des prix.
  Pour ajouter un produit, copiez un bloc et remplacez les valeurs :
    nom         : nom affiché sur la carte
    categorie   : le groupe du filtre ("iPhone", "Samsung", "Google Pixel", "Apple Watch"...)
    prix        : prix en FCFA, en nombre sans espace (exemple : 650000). Vide : "Prix sur WhatsApp".
    image       : nom du fichier photo. Vide : la carte affiche le nom.
    description : texte affiché sur la fiche produit.
    options     : (facultatif) choix de la fiche produit : couleurs, stockages, etats, sims.
      - stockages : "128 Go" (même prix) ou { nom: "256 Go", prix: 419000 } (prix propre à la capacité).
      - Les couleurs et capacités viennent des gammes officielles : supprimez celles que la boutique n'a pas.
      - etats : à renseigner produit par produit (par exemple Scellé). Sans "etats", le groupe n'apparaît pas.
      - Une couleur avec image: affiche la pastille de couleur sur la photo.
    marque      : (facultatif) "Apple", "Samsung"... Renseignée seulement quand elle est certaine.
    disponibilite : (facultatif) texte du stock, par exemple "En stock". Le filtre Disponibilité n'apparaît
                    que si TOUS les produits ont cette information.
    ajoute      : (facultatif) date d'ajout "2026-10-02". Le tri Nouveautés n'apparaît que si elle existe.
  Les filtres et la recherche du site se construisent uniquement à partir de ces données.
*/
window.PRODUCTS = [
  {
    nom: "iPhone 18 Pro Max", marque: "Apple", categorie: "iPhone", prix: 1070000, image: "iphone-18-pro-max.webp",
    description: "Le plus grand iPhone Pro de la gamme, avec écran 6,9 pouces et triple caméra.",
    options: {
      couleurs: [
        { nom: "Noir", hex: "#1B1B1D", image: "iphone-18-pro-max.webp" },
        { nom: "Rouge bordeaux", hex: "#5E2434" },
        { nom: "Bleu", hex: "#2A45A8" },
        { nom: "Blanc", hex: "#F1F1F1" }
      ],
      stockages: ["256 Go", "512 Go", "1 To", "2 To"],
      etats: [{ nom: "Scellé", detail: "Neuf dans son emballage" }],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 18 Pro", marque: "Apple", categorie: "iPhone", prix: 950000, image: "iphone-18-pro.webp",
    description: "iPhone Pro avec triple caméra, dans un format plus compact que le Pro Max.",
    options: {
      couleurs: [
        { nom: "Rouge bordeaux", hex: "#5E2434" },
        { nom: "Bleu", hex: "#2A45A8" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" }
      ],
      stockages: ["256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 17 Pro Max", marque: "Apple", categorie: "iPhone", prix: 690000, image: "iphone-17-pro-max.webp",
    description: "Grand iPhone Pro avec écran 6,9 pouces, puce A19 Pro et triple caméra 48 Mpx.",
    options: {
      couleurs: [
        { nom: "Argent", hex: "#DADCDD" },
        { nom: "Orange cosmique", hex: "#D9622B" },
        { nom: "Bleu intense", hex: "#1F2A44" }
      ],
      stockages: ["256 Go", "512 Go", "1 To", "2 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 17 Pro", marque: "Apple", categorie: "iPhone", prix: 635000, image: "iphone-17-pro.webp",
    description: "iPhone Pro avec écran 6,3 pouces, puce A19 Pro et triple caméra 48 Mpx.",
    options: {
      couleurs: [
        { nom: "Argent", hex: "#DADCDD" },
        { nom: "Orange cosmique", hex: "#D9622B" },
        { nom: "Bleu intense", hex: "#1F2A44" }
      ],
      stockages: ["256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 17 Air", marque: "Apple", categorie: "iPhone", prix: 480000, image: "iphone-17-air.webp",
    description: "iPhone ultrafin avec écran 6,5 pouces, puce A19 Pro et caméra 48 Mpx. eSIM uniquement.",
    options: {
      couleurs: [
        { nom: "Noir sidéral", hex: "#1C1C1E" },
        { nom: "Blanc nuage", hex: "#F2F2F0" },
        { nom: "Or clair", hex: "#E6D7B8" },
        { nom: "Bleu ciel", hex: "#BFD3E6" }
      ],
      stockages: ["256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }]
    }
  },
  {
    nom: "iPhone 17", marque: "Apple", categorie: "iPhone", prix: 450000, image: "iphone-17.webp",
    description: "iPhone avec écran 6,3 pouces ProMotion, puce A19 et double caméra 48 Mpx.",
    options: {
      couleurs: [
        { nom: "Vert sauge", hex: "#A9B79A", image: "iphone-17.webp" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" },
        { nom: "Bleu brume", hex: "#9DB7D0" },
        { nom: "Lavande", hex: "#C9BFE0" }
      ],
      stockages: ["256 Go", "512 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 16 Plus", marque: "Apple", categorie: "iPhone", prix: 390000, image: "iphone-16-plus.webp",
    description: "Grand iPhone avec écran 6,7 pouces, puce A18, Camera Control et autonomie prolongée.",
    options: {
      couleurs: [
        { nom: "Bleu outremer", hex: "#5B6FD6", image: "iphone-16-plus.webp" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" },
        { nom: "Rose", hex: "#F2C6D0" },
        { nom: "Bleu sarcelle", hex: "#7FB2B5" }
      ],
      stockages: [{ nom: "128 Go", prix: 390000 }, { nom: "256 Go", prix: 419000 }, { nom: "512 Go", prix: 435000 }],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 16 Pro Max", marque: "Apple", categorie: "iPhone", prix: 480000, image: "iphone-16-pro-max.webp",
    description: "iPhone Pro Max en titane avec écran 6,9 pouces, puce A18 Pro et zoom optique 5x.",
    options: {
      couleurs: [
        { nom: "Titane désert", hex: "#C8A98A", image: "iphone-16-pro-max.webp" },
        { nom: "Titane noir", hex: "#2B2B2D" },
        { nom: "Titane blanc", hex: "#ECECEA" },
        { nom: "Titane naturel", hex: "#BDB3A8" }
      ],
      stockages: ["256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 16 Pro", marque: "Apple", categorie: "iPhone", prix: 405000, image: "iphone-16-pro.webp",
    description: "iPhone Pro en titane avec écran 6,3 pouces, puce A18 Pro et zoom optique 5x.",
    options: {
      couleurs: [
        { nom: "Titane désert", hex: "#C8A98A", image: "iphone-16-pro.webp" },
        { nom: "Titane noir", hex: "#2B2B2D" },
        { nom: "Titane blanc", hex: "#ECECEA" },
        { nom: "Titane naturel", hex: "#BDB3A8" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 16e", marque: "Apple", categorie: "iPhone", prix: 300000, image: "iphone-16e.webp",
    description: "iPhone accessible avec puce A16 Bionic, écran OLED 6,1 pouces et port USB-C.",
    options: {
      couleurs: [
        { nom: "Blanc", hex: "#F1F1F1", image: "iphone-16e.webp" },
        { nom: "Noir", hex: "#1B1B1D" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 15 Pro Max", marque: "Apple", categorie: "iPhone", prix: 380000, image: "iphone-15-pro-max.webp",
    description: "iPhone Pro Max en titane avec zoom optique 5x, puce A17 Pro et écran 6,7 pouces.",
    options: {
      couleurs: [
        { nom: "Titane naturel", hex: "#BDB3A8" },
        { nom: "Titane bleu", hex: "#3B4658" },
        { nom: "Titane blanc", hex: "#ECECEA" },
        { nom: "Titane noir", hex: "#2B2B2D" }
      ],
      stockages: ["256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 15", marque: "Apple", categorie: "iPhone", prix: 265000, image: "iphone-15.webp",
    description: "iPhone avec Dynamic Island, puce A16 Bionic, caméra 48 Mpx et port USB-C.",
    options: {
      couleurs: [
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Bleu", hex: "#2A45A8" },
        { nom: "Vert", hex: "#B7D3B0" },
        { nom: "Jaune", hex: "#F4E27A" },
        { nom: "Rose", hex: "#F2C6D0" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 14 Pro Max", marque: "Apple", categorie: "iPhone", prix: 295000, image: "iphone-14-pro-max.webp",
    description: "Le meilleur iPhone 14 avec écran always-on 6,7 pouces, caméra 48 Mpx et Dynamic Island.",
    options: {
      couleurs: [
        { nom: "Argent", hex: "#DADCDD", image: "iphone-14-pro-max.webp" },
        { nom: "Noir sidéral", hex: "#1C1C1E" },
        { nom: "Or", hex: "#E9D5B6" },
        { nom: "Violet intense", hex: "#58476B" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 13 Pro Max", marque: "Apple", categorie: "iPhone", prix: 255000, image: "iphone-13-pro-max.webp",
    description: "Grand iPhone Pro avec écran ProMotion 6,7 pouces, triple caméra pro et excellente autonomie.",
    options: {
      couleurs: [
        { nom: "Bleu Sierra", hex: "#A7C1D9", image: "iphone-13-pro-max.webp" },
        { nom: "Graphite", hex: "#4A4B4D" },
        { nom: "Or", hex: "#E9D5B6" },
        { nom: "Argent", hex: "#DADCDD" },
        { nom: "Vert alpin", hex: "#586B58" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go", "1 To"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 12 Pro Max", marque: "Apple", categorie: "iPhone", prix: 195000, image: "iphone-12-pro-max.webp",
    description: "Le plus grand des iPhone 12, avec caméra 12 Mpx améliorée, écran 6,7 pouces et 5G.",
    options: {
      couleurs: [
        { nom: "Argent", hex: "#DADCDD", image: "iphone-12-pro-max.webp" },
        { nom: "Graphite", hex: "#4A4B4D" },
        { nom: "Or", hex: "#E9D5B6" },
        { nom: "Bleu Pacifique", hex: "#2F5672" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 12", marque: "Apple", categorie: "iPhone", prix: 129000, image: "iphone-12.webp",
    description: "iPhone avec puce A14 Bionic, écran Super Retina XDR 6,1 pouces et compatibilité 5G.",
    options: {
      couleurs: [
        { nom: "Bleu", hex: "#2A45A8", image: "iphone-12.webp" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" },
        { nom: "Rouge", hex: "#C4122F" },
        { nom: "Vert", hex: "#B7D3B0" },
        { nom: "Mauve", hex: "#CDBFDD" }
      ],
      stockages: ["64 Go", "128 Go", "256 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 11 Pro Max", marque: "Apple", categorie: "iPhone", prix: 155000, image: "iphone-11-pro-max.webp",
    description: "Grand iPhone Pro avec écran Super Retina XDR 6,5 pouces, triple caméra et longue autonomie.",
    options: {
      couleurs: [
        { nom: "Or", hex: "#E9D5B6", image: "iphone-11-pro-max.webp" },
        { nom: "Vert nuit", hex: "#4E5851" },
        { nom: "Gris sidéral", hex: "#535150" },
        { nom: "Argent", hex: "#DADCDD" }
      ],
      stockages: ["64 Go", "256 Go", "512 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "iPhone 11", marque: "Apple", categorie: "iPhone", prix: 105000, image: "iphone-11.webp",
    description: "iPhone avec double caméra 12 Mpx, puce A13 Bionic et écran Liquid Retina 6,1 pouces.",
    options: {
      couleurs: [
        { nom: "Rouge", hex: "#C4122F", image: "iphone-11.webp" },
        { nom: "Noir", hex: "#1B1B1D" },
        { nom: "Blanc", hex: "#F1F1F1" },
        { nom: "Vert", hex: "#B7D3B0" },
        { nom: "Jaune", hex: "#F4E27A" },
        { nom: "Mauve", hex: "#CDBFDD" }
      ],
      stockages: ["64 Go", "128 Go", "256 Go"],
      sims: [{ nom: "eSIM", detail: "SIM intégrée" }, { nom: "SIM physique", detail: "Carte SIM" }]
    }
  },
  {
    nom: "Galaxy Note 20 Ultra", marque: "Samsung", categorie: "Samsung", prix: 250000, image: "galaxy-note-20-ultra.webp",
    description: "Grand Samsung avec écran 6,9 pouces, stylet S Pen et triple caméra.",
    options: {
      couleurs: [
        { nom: "Bronze mystique", hex: "#B98A63" },
        { nom: "Noir mystique", hex: "#222224" },
        { nom: "Blanc mystique", hex: "#F0F0F0" }
      ],
      stockages: ["128 Go", "256 Go", "512 Go"]
    }
  },
  {
    nom: "Galaxy S21", marque: "Samsung", categorie: "Samsung", prix: 130000, image: "galaxy-s21.webp",
    description: "Samsung avec écran 6,2 pouces 120 Hz et triple caméra.",
    options: {
      couleurs: [
        { nom: "Gris fantôme", hex: "#6B6E76" },
        { nom: "Blanc fantôme", hex: "#F2F2F2" },
        { nom: "Violet fantôme", hex: "#8B7AA8" },
        { nom: "Rose fantôme", hex: "#E8B4C4" }
      ],
      stockages: ["128 Go", "256 Go"]
    }
  },
  {
    nom: "Google Pixel 8", marque: "Google", categorie: "Google Pixel", prix: 190000, image: "google-pixel-8.webp",
    description: "Google Pixel avec écran 6,2 pouces 120 Hz, puce Tensor G3 et caméra principale 50 Mpx.",
    options: {
      couleurs: [
        { nom: "Hazel", hex: "#8D9A8B", image: "google-pixel-8.webp" },
        { nom: "Obsidian", hex: "#1F1F22" },
        { nom: "Rose", hex: "#F2C6D0" }
      ],
      stockages: ["128 Go", "256 Go"]
    }
  },
  {
    nom: "Apple Watch Series 10", marque: "Apple", categorie: "Apple Watch", prix: 220000, image: "apple-watch-serie-10.webp",
    description: "Apple Watch avec grand écran, boîtier fin et suivi santé et sport."
  },
  {
    nom: "Coque / Pochette", categorie: "Accessoires", prix: 2000, image: "coque-pochette.webp",
    description: "Coque ou pochette pour protéger votre téléphone. Modèles et couleurs confirmés sur WhatsApp."
  },
  {
    nom: "Verre blindé", categorie: "Accessoires", prix: 1000, image: "verre-blinde.webp",
    description: "Verre trempé pour protéger l’écran. Modèle compatible confirmé sur WhatsApp."
  },
  {
    nom: "Clavier iPad", categorie: "Accessoires", prix: 49000, image: "clavier-ipad.webp",
    description: "Clavier pour iPad. Modèle compatible confirmé sur WhatsApp."
  },
  {
    nom: "Tête de chargeur (adaptateur secteur)", categorie: "Accessoires", prix: 5000, image: "tete-chargeur.webp",
    description: "Adaptateur secteur avec port USB-C."
  },
  {
    nom: "Clavier iPhone", categorie: "Accessoires", prix: 70000, image: "clavier-iphone.webp",
    description: "Clavier physique pour iPhone. Modèle compatible confirmé sur WhatsApp."
  },
  {
    nom: "Chargeur iPhone 35W", categorie: "Accessoires", prix: 10000, image: "chargeur-iphone-35w.webp",
    description: "Chargeur secteur 35 W pour iPhone."
  },
  {
    nom: "Chargeur MacBook", categorie: "Accessoires", prix: 30000, image: "chargeur-macbook.webp",
    description: "Chargeur secteur pour MacBook."
  },
  {
    nom: "Câble iPhone", categorie: "Accessoires", prix: 2500, image: "cable-iphone.webp",
    description: "Câble de charge pour iPhone."
  },
  {
    nom: "Apple Pencil", categorie: "Accessoires", prix: 50000, image: "apple-pencil.webp",
    description: "Stylet pour iPad. Modèle compatible confirmé sur WhatsApp."
  }
];
