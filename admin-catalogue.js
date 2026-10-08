/* Administration — Catalogue et Stock
   LECTURE SEULE
   Source de vérité : Supabase + RLS
*/

(function () {
  "use strict";

  const ui = window.KYR_ADMIN_UI;

  if (!ui) {
    console.error("KYR_ADMIN_UI introuvable.");
    return;
  }

  function vue(table, titre, intro, options) {
    options = options || {};

    return function (corps, ctx) {
      ui.listeTable(corps, ctx, {
        table: table,
        titre: titre,
        intro: intro,
        taille: options.taille || 25,
        tri: options.tri,
        colonnes: options.colonnes,
        masquer: options.masquer || [],
        libelles: options.libelles || {},
        legende: options.legende || titre
      });
    };
  }

  ui.enregistrer("catalogue", {

    /* =========================
       PRODUITS
       ========================= */

    produits: vue(
      "products",
      "Produits",
      "Catalogue réel des produits enregistrés dans Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "name",
          "slug",
          "brand_id",
          "category_id",
          "active",
          "created_at"
        ],
        libelles: {
          id: "ID",
          name: "Produit",
          slug: "Slug",
          brand_id: "Marque",
          category_id: "Catégorie",
          active: "Actif",
          created_at: "Créé le"
        },
        legende: "Produits du catalogue"
      }
    ),

    /* =========================
       VARIANTES
       ========================= */

    variantes: vue(
      "product_variants",
      "Variantes et capacités",
      "Variantes réellement enregistrées dans Supabase avec leurs capacités et leurs prix.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "product_id",
          "capacity",
          "color",
          "condition",
          "sim",
          "price_fcfa",
          "created_at"
        ],
        libelles: {
          id: "ID",
          product_id: "Produit",
          capacity: "Capacité",
          color: "Couleur",
          condition: "État",
          sim: "SIM",
          price_fcfa: "Prix",
          created_at: "Créé le"
        },
        legende: "Variantes et capacités"
      }
    ),

    /* =========================
       MARQUES
       ========================= */

    marques: vue(
      "brands",
      "Marques",
      "Marques enregistrées dans le catalogue Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "name",
          "slug",
          "created_at"
        ],
        libelles: {
          id: "ID",
          name: "Marque",
          slug: "Slug",
          created_at: "Créé le"
        },
        legende: "Marques"
      }
    ),

    /* =========================
       CATÉGORIES
       ========================= */

    categories: vue(
      "categories",
      "Catégories",
      "Catégories enregistrées dans le catalogue Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "name",
          "slug",
          "created_at"
        ],
        libelles: {
          id: "ID",
          name: "Catégorie",
          slug: "Slug",
          created_at: "Créé le"
        },
        legende: "Catégories"
      }
    ),

    /* =========================
       STOCK
       ========================= */

    stock: vue(
      "inventory",
      "Stock global",
      "Quantités de stock réellement enregistrées dans Supabase.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "product_variant_id",
          "quantity",
          "created_at",
          "updated_at"
        ],
        libelles: {
          id: "ID",
          product_variant_id: "Variante",
          quantity: "Quantité",
          created_at: "Créé le",
          updated_at: "Mis à jour le"
        },
        legende: "Stock global"
      }
    ),

    /* =========================
       INVENTAIRE / IMEI
       ========================= */

    imei: vue(
      "inventory_units",
      "Inventaire et IMEI",
      "Unités individuelles enregistrées dans Supabase lorsque le suivi par appareil est utilisé.",
      {
        taille: 25,
        tri: ["created_at"],
        colonnes: [
          "id",
          "inventory_id",
          "imei",
          "serial_number",
          "status",
          "created_at"
        ],
        libelles: {
          id: "ID",
          inventory_id: "Inventaire",
          imei: "IMEI",
          serial_number: "Numéro de série",
          status: "Statut",
          created_at: "Créé le"
        },
        legende: "Inventaire et IMEI"
      }
    )

  });

})();