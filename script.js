/* Keur Yaye Rokhaya — boutique de produits Apple à Dakar */

const WHATSAPP_NUMBER = "221784852982"; // format international sans "+"
const CART_KEY = "kyr_cart_v1";

const ICONS = {
  phone: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="6" width="24" height="52" rx="4" stroke="#E0C563" stroke-width="2"/><line x1="20" y1="14" x2="44" y2="14" stroke="#E0C563" stroke-width="2"/><line x1="20" y1="48" x2="44" y2="48" stroke="#E0C563" stroke-width="2"/><circle cx="32" cy="53" r="1.6" fill="#E0C563"/></svg>`,
  tablet: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="8" width="40" height="48" rx="4" stroke="#E0C563" stroke-width="2"/><line x1="12" y1="16" x2="52" y2="16" stroke="#E0C563" stroke-width="2"/><line x1="12" y1="48" x2="52" y2="48" stroke="#E0C563" stroke-width="2"/><circle cx="32" cy="52" r="1.6" fill="#E0C563"/></svg>`,
  laptop: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="12" width="44" height="28" rx="2" stroke="#E0C563" stroke-width="2"/><path d="M6 46h52l-4 8H10l-4-8z" stroke="#E0C563" stroke-width="2" stroke-linejoin="round"/></svg>`,
  buds: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 18c0-5 4-9 9-9s9 4 9 9" stroke="#E0C563" stroke-width="2"/><rect x="17" y="17" width="9" height="16" rx="4.5" stroke="#E0C563" stroke-width="2"/><rect x="38" y="17" width="9" height="16" rx="4.5" stroke="#E0C563" stroke-width="2"/><rect x="19" y="38" width="6" height="16" rx="3" stroke="#E0C563" stroke-width="2"/><rect x="40" y="38" width="6" height="16" rx="3" stroke="#E0C563" stroke-width="2"/></svg>`,
  watch: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="21" y="20" width="22" height="24" rx="6" stroke="#E0C563" stroke-width="2"/><path d="M25 20l1-8h12l1 8M25 44l1 8h12l1-8" stroke="#E0C563" stroke-width="2" stroke-linecap="round"/><line x1="43" y1="30" x2="47" y2="30" stroke="#E0C563" stroke-width="2" stroke-linecap="round"/></svg>`,
};

const PRODUCTS = [
  { id: "ip16pm", cat: "iPhone", name: "iPhone 16 Pro Max", desc: "256 Go · toutes couleurs · testé 1 mois garanti", price: 899000, icon: "phone" },
  { id: "ip16", cat: "iPhone", name: "iPhone 16", desc: "128 Go · double SIM/eSIM · batterie 90%+", price: 559000, icon: "phone" },
  { id: "ip15", cat: "iPhone", name: "iPhone 15", desc: "128 Go · reconditionné, état comme neuf", price: 449000, icon: "phone" },
  { id: "ipadpro", cat: "iPad", name: "iPad Pro 11″", desc: "Puce M4 · Wi-Fi · idéal pour le travail et l'école", price: 649000, icon: "tablet" },
  { id: "ipadair", cat: "iPad", name: "iPad Air", desc: "64 Go · léger, parfait pour un usage quotidien", price: 379000, icon: "tablet" },
  { id: "mba", cat: "MacBook", name: "MacBook Air M2", desc: "8 Go / 256 Go · autonomie toute la journée", price: 899000, icon: "laptop" },
  { id: "mbp", cat: "MacBook", name: "MacBook Pro 14″", desc: "Puce M3 · pour montage et gros logiciels", price: 1290000, icon: "laptop" },
  { id: "airpodspro", cat: "AirPods", name: "AirPods Pro 2", desc: "Réduction de bruit active · boîtier MagSafe", price: 149000, icon: "buds" },
  { id: "watch", cat: "Apple Watch", name: "Apple Watch Series 9", desc: "45mm · suivi santé et notifications au poignet", price: 259000, icon: "watch" },
];

function formatFCFA(n) {
  return n.toLocaleString("fr-FR").replace(/\u202f/g, " ") + " FCFA";
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

function addToCart(id, qty = 1) {
  const cart = loadCart();
  cart[id] = (cart[id] || 0) + qty;
  saveCart(cart);
  updateCartBadge();
  return cart;
}

function setQty(id, qty) {
  const cart = loadCart();
  if (qty <= 0) {
    delete cart[id];
  } else {
    cart[id] = qty;
  }
  saveCart(cart);
  updateCartBadge();
  return cart;
}

function updateCartBadge() {
  const badge = document.querySelector("[data-cart-count]");
  if (badge) badge.textContent = cartCount(loadCart());
}

function buildWhatsAppLink(cart, customerName, note) {
  const lines = [];
  lines.push(`Bonjour Keur Yaye Rokhaya, je souhaite commander :`);
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    const lineTotal = p.price * qty;
    total += lineTotal;
    lines.push(`• ${p.name} x${qty} — ${formatFCFA(lineTotal)}`);
  });
  lines.push(`Total : ${formatFCFA(total)}`);
  if (customerName) lines.push(`Nom : ${customerName}`);
  if (note) lines.push(`Note : ${note}`);
  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

/* ---------- Page: index (catalogue) ---------- */

function renderCatalog() {
  const grid = document.querySelector("[data-product-grid]");
  if (!grid) return;
  const cart = loadCart();
  grid.innerHTML = PRODUCTS.map((p) => `
    <article class="card">
      <div class="card-art">${ICONS[p.icon]}</div>
      <div class="card-body">
        <div class="card-cat">${p.cat}</div>
        <h3>${p.name}</h3>
        <p class="desc">${p.desc}</p>
        <div class="card-row">
          <div class="price">${formatFCFA(p.price)}</div>
          <button class="add-btn" data-add="${p.id}">${cart[p.id] ? "Ajouté ✓" : "Ajouter au panier"}</button>
        </div>
      </div>
    </article>
  `).join("");

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    addToCart(btn.dataset.add, 1);
    btn.textContent = "Ajouté ✓";
    btn.classList.add("added");
    setTimeout(() => {
      btn.textContent = "Ajouter au panier";
      btn.classList.remove("added");
    }, 1400);
  });
}

/* ---------- Page: panier (cart) ---------- */

function renderCartPage() {
  const listEl = document.querySelector("[data-cart-list]");
  const emptyEl = document.querySelector("[data-cart-empty]");
  const summaryEl = document.querySelector("[data-cart-summary]");
  if (!listEl) return;

  const cart = loadCart();
  const entries = Object.entries(cart).filter(([id]) => PRODUCTS.some((p) => p.id === id));

  if (entries.length === 0) {
    listEl.style.display = "none";
    if (summaryEl) summaryEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  listEl.style.display = "flex";
  if (summaryEl) summaryEl.style.display = "block";

  let total = 0;
  listEl.innerHTML = entries.map(([id, qty]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    const lineTotal = p.price * qty;
    total += lineTotal;
    return `
      <div class="cart-row" data-row="${id}">
        <div class="thumb">${ICONS[p.icon]}</div>
        <div>
          <div class="name">${p.name}</div>
          <div class="unit">${formatFCFA(p.price)} / unité</div>
          <button class="remove-btn" data-remove="${id}">Retirer</button>
        </div>
        <div class="qty">
          <button data-dec="${id}" aria-label="Diminuer la quantité">−</button>
          <span>${qty}</span>
          <button data-inc="${id}" aria-label="Augmenter la quantité">+</button>
        </div>
        <div class="line-total">${formatFCFA(lineTotal)}</div>
      </div>
    `;
  }).join("");

  const totalEl = document.querySelector("[data-cart-total]");
  if (totalEl) totalEl.textContent = formatFCFA(total);

  const waBtn = document.querySelector("[data-whatsapp-order]");
  if (waBtn) {
    const refresh = () => {
      const nameInput = document.querySelector("[data-customer-name]");
      const noteInput = document.querySelector("[data-customer-note]");
      waBtn.href = buildWhatsAppLink(loadCart(), nameInput ? nameInput.value.trim() : "", noteInput ? noteInput.value.trim() : "");
    };
    refresh();
    document.querySelectorAll("[data-customer-name], [data-customer-note]").forEach((el) => {
      el.addEventListener("input", refresh);
    });
  }

  listEl.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rem = e.target.closest("[data-remove]");
    const cart = loadCart();
    if (inc) setQty(inc.dataset.inc, (cart[inc.dataset.inc] || 0) + 1);
    if (dec) setQty(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1);
    if (rem) setQty(rem.dataset.remove, 0);
    renderCartPage();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  renderCatalog();
  renderCartPage();
});
