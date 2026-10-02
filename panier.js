/*
  Page Panier : lignes en cartes (jamais de tableau), quantités, total uniquement s'il est calculable
  avec de vrais prix, commande WhatsApp. Aucun paiement en ligne.
*/
(function () {
  "use strict";
  var S = KYR.shop, racine = document.getElementById("panier");
  var armeVider = null;

  function el(tag, cls, texte) { var n = document.createElement(tag); if (cls) n.className = cls; if (texte) n.textContent = texte; return n; }

  function ligne(l) {
    var li = el("li", "cart-line" + (l.produit ? "" : " cart-line-off"));
    var media = el("div", "cart-img");
    if (l.produit && l.produit.image) { var img = document.createElement("img"); img.src = l.produit.image; img.alt = l.produit.nom; img.loading = "lazy"; media.appendChild(img); }
    li.appendChild(media);

    var corps = el("div", "cart-body");
    if (!l.produit) {
      corps.appendChild(el("p", "cart-name", "Ce produit n’est plus dans la boutique"));
      corps.appendChild(el("p", "note", "Il est ignoré dans le total et dans la commande. Vous pouvez le retirer."));
    } else {
      var nom = el("a", "cart-name", l.produit.nom); nom.href = "produit.html?p=" + encodeURIComponent(l.id);
      corps.appendChild(nom);
      S.lignesVariante(l.v).forEach(function (t) { corps.appendChild(el("p", "cart-var", t)); });
      corps.appendChild(el("p", "cart-unit", "Prix unitaire : " + S.prixTexte(l.unitaire)));
    }
    var bas = el("div", "cart-actions");
    if (l.produit) {
      var pas = el("div", "stepper");
      var moins = el("button", "", "\u2212"); moins.type = "button"; moins.setAttribute("aria-label", "Diminuer la quantité de " + l.produit.nom); moins.disabled = l.q <= 1;
      var sortie = document.createElement("output"); sortie.textContent = l.q;
      var plus = el("button", "", "+"); plus.type = "button"; plus.setAttribute("aria-label", "Augmenter la quantité de " + l.produit.nom); plus.disabled = l.q >= S.MAX_QTE;
      moins.addEventListener("click", function () { S.changerQte(l.cle, l.q - 1); });
      plus.addEventListener("click", function () { S.changerQte(l.cle, l.q + 1); });
      pas.appendChild(moins); pas.appendChild(sortie); pas.appendChild(plus);
      bas.appendChild(pas);
      bas.appendChild(el("p", "cart-total", l.sousTotal === null ? "Sur devis" : KYR.fcfa(l.sousTotal)));
    }
    var sup = el("button", "link-btn", "Supprimer"); sup.type = "button";
    sup.setAttribute("aria-label", "Supprimer " + (l.produit ? l.produit.nom : "ce produit") + " du panier");
    sup.addEventListener("click", function () { S.supprimer(l.cle); });
    bas.appendChild(sup);
    corps.appendChild(bas);
    li.appendChild(corps);
    return li;
  }

  function rendre() {
    var liste = S.lignes(), t = S.totaux(liste);
    racine.innerHTML = "";
    if (!liste.length) {
      var vide = el("div", "empty-state");
      vide.appendChild(el("h2", "", "Votre panier est vide"));
      vide.appendChild(el("p", "", "Ajoutez des produits depuis la boutique, puis envoyez votre commande sur WhatsApp."));
      var a = el("a", "btn", "Voir la boutique"); a.href = "index.html#nos-produits"; vide.appendChild(a);
      racine.appendChild(vide);
      return;
    }
    var mise = el("div", "cart-layout");
    var ul = el("ul", "cart-lines");
    liste.forEach(function (l) { ul.appendChild(ligne(l)); });
    mise.appendChild(ul);

    var res = el("aside", "cart-summary"); res.setAttribute("aria-label", "Récapitulatif");
    res.appendChild(el("h2", "", "Récapitulatif"));
    var r1 = el("p", "sum-row"); r1.appendChild(el("span", "", "Articles")); r1.appendChild(el("b", "", String(t.quantite))); res.appendChild(r1);
    var r2 = el("p", "sum-row"); r2.appendChild(el("span", "", t.nbSurDevis ? "Sous-total des produits avec prix" : "Sous-total")); r2.appendChild(el("b", "", KYR.fcfa(t.sousTotal))); res.appendChild(r2);
    res.appendChild(el("p", "note", "Livraison : le coût et le délai vous sont donnés avant la confirmation de la commande."));
    var r3 = el("p", "sum-row sum-total"); r3.appendChild(el("span", "", "Total")); r3.appendChild(el("b", "", t.complet ? KYR.fcfa(t.sousTotal) : "À confirmer")); res.appendChild(r3);
    if (t.nbSurDevis) res.appendChild(el("p", "note warn", t.nbSurDevis + " produit" + (t.nbSurDevis > 1 ? "s sont" : " est") + " sur devis : le total ne peut pas être calculé. L’équipe confirme le prix sur WhatsApp."));
    if (t.indisponibles) res.appendChild(el("p", "note warn", t.indisponibles + " produit" + (t.indisponibles > 1 ? "s ne sont" : " n’est") + " plus dans la boutique et ne sera pas commandé."));

    var cmd = el("a", "btn btn-wa btn-block", "Commander via WhatsApp"); cmd.target = "_blank"; cmd.rel = "noopener";
    if (t.nb > 0) cmd.href = KYR.lien(S.messageCommande(liste));
    else { cmd.href = "#"; cmd.setAttribute("aria-disabled", "true"); cmd.addEventListener("click", function (e) { e.preventDefault(); }); }
    res.appendChild(cmd);
    res.appendChild(el("p", "note", "Aucun paiement n’est fait sur le site : la commande se confirme sur WhatsApp."));

    var vider = el("button", "btn btn-outline btn-block", armeVider ? "Confirmer : vider le panier" : "Vider le panier"); vider.type = "button";
    vider.addEventListener("click", function () {
      if (!armeVider) { armeVider = setTimeout(function () { armeVider = null; rendre(); }, 4000); rendre(); return; }
      clearTimeout(armeVider); armeVider = null; S.vider();
    });
    res.appendChild(vider);
    mise.appendChild(res);
    racine.appendChild(mise);
  }

  window.addEventListener("kyr:panier", function () { if (armeVider) { clearTimeout(armeVider); armeVider = null; } rendre(); });
  window.addEventListener("storage", function (e) { if (e.key === KYR.CLE_PANIER) rendre(); });
  rendre();
})();
