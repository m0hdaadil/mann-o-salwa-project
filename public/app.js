const state = {
  settings: null,
  categories: [],
  items: [],
  reviews: [],
  category: "all",
  query: "",
  cart: new Map(),
  table: new URLSearchParams(location.search).get("table") || ""
};

const fallbackImages = {
  shawarma: "/assets/sh.jpg",
  starters: "/assets/stat.jpg",
  burgers: "/assets/bur.jpg",
  curry: "/assets/curries.jpg",
  broasted: "/assets/bro chi.jpg",
  desserts: "/assets/des.jpg"
};

const rupee = value => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const escHtml = str => String(str).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const el = id => document.getElementById(id);
const categoryName = id => state.categories.find(c => c.id === id)?.name || "Chef special";
const isAvailable = item => item.status === "available" || item.status === "seasonal";
const itemImage = item => item.image || fallbackImages[item.categoryId] || "/assets/logo.jpg";

// ─── Cart persistence ─────────────────────────────────────────────────────
function saveCart() {
  try {
    sessionStorage.setItem("ms_cart", JSON.stringify([...state.cart.entries()]));
  } catch {}
}

function loadCartFromStorage() {
  try {
    const raw = sessionStorage.getItem("ms_cart");
    if (!raw) return;

    state.cart.clear();

    for (const [id, item] of JSON.parse(raw)) {
      state.cart.set(id, item);
    }
  } catch {}
}

// ─── Toast ────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = "success") {
  const toast = el("customerToast");
  toast.textContent = message;
  toast.className = `customer-toast customer-toast--${type} customer-toast--visible`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "customer-toast"; }, 3800);
}

// ─── Load public data ─────────────────────────────────────────────────────
async function load() {
  try {
    const res = await fetch("/api/public");
    if (!res.ok) throw new Error("Failed to load menu");
    const data = await res.json();
    Object.assign(state, data);
    document.documentElement.style.setProperty("--gold", state.settings.themeColor || "#d8aa45");
    el("brandName").textContent = state.settings.cafeName;
    el("heroTitle").textContent = state.settings.cafeName;
    el("tableBadge").textContent = state.table || "walk-in";
    el("tableInput").value = state.table;
    el("mapLink").href = state.settings.maps || "#";
    el("instaLink").href = state.settings.instagram || "#";
    el("addressText").textContent = state.settings.address || "";
    el("hoursText").textContent = state.settings.hours || "";
    el("heroImage").src = state.settings.heroBanner || "/assets/main.jpg";
    if (state.settings.phone) el("callLink").href = `tel:${state.settings.phone}`;

    loadCartFromStorage();
    // Reconcile stored cart with current menu (availability / price may have changed)
    for (const [id, cartItem] of state.cart.entries()) {
      const fresh = state.items.find(e => e.id === id);
      if (!fresh || !isAvailable(fresh)) { state.cart.delete(id); continue; }
      state.cart.set(id, { ...fresh, qty: cartItem.qty });
    }
    renderCategories();
    renderMenu();
    renderReviews();
    renderCart();
  } catch {
    showToast("Could not load menu. Please refresh.", "error");
  }
}

// ─── Categories ───────────────────────────────────────────────────────────
function renderCategories() {
  const row = el("categoryRow");
  const categories = [{ id: "all", name: "All" }, ...state.categories.sort((a, b) => a.order - b.order)];
  row.innerHTML = categories.map(c => `
    <button class="chip ${c.id === state.category ? "active" : ""}" data-category="${escHtml(c.id)}">
      ${escHtml(c.name)}
    </button>
  `).join("");
  row.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      renderCategories();
      renderMenu();
    });
  });
}

// ─── Menu ─────────────────────────────────────────────────────────────────
function renderMenu() {
  const query = state.query.toLowerCase();
  const items = state.items
    .filter(item => item.status !== "hidden")
    .filter(item => state.category === "all" || item.categoryId === state.category)
    .filter(item => `${item.name} ${item.description} ${categoryName(item.categoryId)}`.toLowerCase().includes(query))
    .sort((a, b) => a.order - b.order);

  el("menuGrid").innerHTML = items.map(item => {
    const available = isAvailable(item);
    const safeId = escHtml(item.id);
    const safeName = escHtml(item.name);
    const safeDesc = escHtml(item.description || "Freshly prepared by the kitchen.");
    const safeCat = escHtml(categoryName(item.categoryId));
    const safeImg = escHtml(itemImage(item));
    const typeLabel = item.type === "veg" ? "Veg" : item.type === "egg" ? "Egg" : "Non-veg";
    const typeClass = item.type === "veg" ? "veg" : "nonveg";
    const cartItem = state.cart.get(item.id);
    const cartControls = cartItem
      ? `<div class="card-qty-ctrl">
           <button type="button" class="card-qty-btn" data-card-qty="${safeId}" data-delta="-1" aria-label="Decrease ${safeName}">−</button>
           <strong class="card-qty-num">${cartItem.qty}</strong>
           <button type="button" class="card-qty-btn" data-card-qty="${safeId}" data-delta="1" aria-label="Increase ${safeName}">+</button>
         </div>`
      : `<button class="button primary wide add-to-cart-btn" data-add="${safeId}" ${available ? "" : "disabled"}>
           ${available ? "Add to Cart" : "SOLD OUT TODAY"}
         </button>`;
    return `
      <article class="menu-card ${available ? "" : "sold-out"}" data-item-id="${safeId}">
        <img class="menu-image" src="${safeImg}" alt="${safeName}" loading="lazy">
        <div class="menu-card-body">
          <div class="card-top">
            <div>
              <p class="item-category">${safeCat}</p>
              <h3>${safeName}</h3>
            </div>
            <strong class="price">${rupee(item.price)}</strong>
          </div>
          <p class="item-desc">${safeDesc}</p>
          <div class="tags">
            <span class="tag ${typeClass}">${typeLabel}</span>
            ${item.spicy ? `<span class="tag">🌶 Spicy</span>` : ""}
            ${item.bestseller ? `<span class="tag">⭐ Bestseller</span>` : ""}
            ${item.recommended ? `<span class="tag">👌 Recommended</span>` : ""}
            ${!available ? `<span class="tag danger">Sold out today</span>` : ""}
          </div>
          ${cartControls}
        </div>
      </article>
    `;
  }).join("") || `<p class="empty">No menu items found.</p>`;

  el("menuGrid").querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
  el("menuGrid").querySelectorAll("[data-card-qty]").forEach(btn => {
    btn.addEventListener("click", () => changeQty(btn.dataset.cardQty, Number(btn.dataset.delta)));
  });
}

// ─── Reviews ─────────────────────────────────────────────────────────────
function renderReviews() {
  const approved = state.reviews.filter(r => r.approved !== false && r.hidden !== true);
  const average = approved.length
    ? approved.reduce((sum, r) => sum + Number(r.rating || 0), 0) / approved.length
    : 0;
  el("ratingSummary").innerHTML = `
    <strong>${average ? average.toFixed(1) : "0.0"}</strong>
    <span>${approved.length} review${approved.length === 1 ? "" : "s"}</span>
  `;
  el("reviewGrid").innerHTML = approved.slice(0, 6).map(r => {
    const stars = Math.min(5, Math.max(0, Number(r.rating || 0)));
    return `
    <article class="review-card ${r.featured ? "featured" : ""}">
      <div class="stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div>
      <p>${escHtml(r.text)}</p>
      <strong>${escHtml(r.name)}</strong>
    </article>
  `;
  }).join("") || `<p class="empty">No reviews yet.</p>`;
}

// ─── Cart drawer ──────────────────────────────────────────────────────────
function openCart() {
  document.body.classList.add("cart-open");

  const cart = document.querySelector(".cart");
  cart.classList.add("open");

  // Bring cart into focus
  cart.focus?.();

  // Desktop only
  if (window.innerWidth > 768) {
    cart.scrollTop = 0;
  }
}

function closeCart() {
  document.body.classList.remove("cart-open");
  document.querySelector(".cart").classList.remove("open");
}
// ─── Cart actions ─────────────────────────────────────────────────────────
function addToCart(id) {
  const item = state.items.find(e => e.id === id);
  if (!item || !isAvailable(item)) return;
  const current = state.cart.get(id) || { ...item, qty: 0 };
  current.qty += 1;
  state.cart.set(id, current);
  saveCart();
  renderCart();
  updateCardInPlace(id);
  // Brief bump animation on the floating bar
  const bar = el("cartBar");
  if (bar) {
    bar.classList.remove("cart-bar--bump");
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add("cart-bar--bump")));
  }
}

function changeQty(id, delta) {
  const current = state.cart.get(id);
  if (!current) return;
  current.qty += delta;
  if (current.qty <= 0) state.cart.delete(id);
  saveCart();
  renderCart();
  updateCardInPlace(id);
}

/** Swap only the action area of one card in place — no scroll jump */
function updateCardInPlace(id) {
  const safeId = escHtml(id);
  const card = el("menuGrid")?.querySelector(`[data-item-id="${safeId}"]`);
  if (!card) { renderMenu(); return; }
  const item = state.items.find(e => e.id === id);
  const safeName = escHtml(item?.name || "");
  const cartItem = state.cart.get(id);
  const available = item && isAvailable(item);

  card.querySelectorAll(".card-qty-ctrl, .add-to-cart-btn").forEach(n => n.remove());
  const body = card.querySelector(".menu-card-body");
  if (!body) return;

  if (cartItem) {
    const ctrl = document.createElement("div");
    ctrl.className = "card-qty-ctrl card-qty-ctrl--in";
    ctrl.innerHTML = `
      <button type="button" class="card-qty-btn" data-card-qty="${safeId}" data-delta="-1" aria-label="Decrease ${safeName}">−</button>
      <strong class="card-qty-num">${cartItem.qty}</strong>
      <button type="button" class="card-qty-btn" data-card-qty="${safeId}" data-delta="1" aria-label="Increase ${safeName}">+</button>
    `;
    ctrl.querySelectorAll("[data-card-qty]").forEach(btn =>
      btn.addEventListener("click", () => changeQty(btn.dataset.cardQty, Number(btn.dataset.delta)))
    );
    body.appendChild(ctrl);
  } else {
    const btn = document.createElement("button");
    btn.className = "button primary wide add-to-cart-btn";
    btn.dataset.add = id;
    btn.disabled = !available;
    btn.textContent = available ? "Add to Cart" : "SOLD OUT TODAY";
    btn.addEventListener("click", () => addToCart(id));
    body.appendChild(btn);
  }
}

// ─── Cart render ──────────────────────────────────────────────────────────
function renderCart() {
  const items = [...state.cart.values()];
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  // Floating bar
 const bar = el("cartBar");

if (bar) {

    if (count > 0) {
        bar.hidden = false;
        bar.style.display = "flex";
        bar.style.visibility = "visible";
        bar.style.opacity = "1";
        bar.style.pointerEvents = "auto";
    } else {
        bar.hidden = true;
        bar.style.display = "none";
    }

    el("cartCount").textContent = count;
    el("cartBarItems").textContent =
        `${count} Item${count === 1 ? "" : "s"}`;

    el("cartBarTotal").textContent = rupee(total);
}

  el("cartTotal").textContent = rupee(total);
  el("checkoutButton").disabled = !items.length;
  el("cartItems").innerHTML = items.map(item => {
    const safeId = escHtml(item.id);
    const safeName = escHtml(item.name);
    const safeImg = escHtml(itemImage(item));
    return `
    <div class="cart-line">
      <img src="${safeImg}" alt="${safeName}" loading="lazy">
      <div>
        <strong>${safeName}</strong>
        <p>${rupee(item.price)} each</p>
      </div>
      <div class="qty">
        <button type="button" data-qty="${safeId}" data-delta="-1" aria-label="Decrease ${safeName}">−</button>
        <strong>${Number(item.qty)}</strong>
        <button type="button" data-qty="${safeId}" data-delta="1" aria-label="Increase ${safeName}">+</button>
      </div>
      <button class="remove-line" type="button" data-remove="${safeId}">Remove</button>
    </div>
  `;
  }).join("") || `<p class="empty">Your cart is empty.</p>`;

  el("cartItems").querySelectorAll("[data-qty]").forEach(btn => {
    btn.addEventListener("click", () => changeQty(btn.dataset.qty, Number(btn.dataset.delta)));
  });
  el("cartItems").querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.cart.delete(btn.dataset.remove);
      saveCart();
      renderCart();
      updateCardInPlace(btn.dataset.remove);
    });
  });
}

// ─── Order ────────────────────────────────────────────────────────────────
async function placeOrder(event) {
  event.preventDefault();
  const items = [...state.cart.values()];
  if (!items.length) { showToast("Please add at least one item.", "error"); return; }
  const customerName = el("customerName").value.trim();
  const table = el("tableInput").value.trim();
  if (!customerName) { showToast("Please enter your name.", "error"); return; }
  if (!table) { showToast("Please enter your table number.", "error"); return; }
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const payload = {
    customerName, table, total,
    items: items.map(item => ({ id: item.id, name: item.name, price: item.price, qty: item.qty, categoryId: item.categoryId }))
  };
  const btn = el("checkoutButton");
  btn.disabled = true;
  btn.textContent = "Sending order…";
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Order failed");
    }
    const data = await res.json();
    state.cart.clear();
    sessionStorage.removeItem("ms_cart");
    saveCart();
    renderCart();
    renderMenu();
    closeCart();
    showToast(`✅ Order ${data.order.id} placed! The kitchen can see it now.`, "success");
  } catch (err) {
    showToast(err.message || "Could not place order. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
}

// ─── Review ───────────────────────────────────────────────────────────────
async function submitReview(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = (data.get("name") || "").trim();
  const text = (data.get("text") || "").trim();
  const rating = Number(data.get("rating"));
  if (!name) { showToast("Please enter your name.", "error"); return; }
  if (!text || text.length < 10) { showToast("Please write at least 10 characters.", "error"); return; }
  const btn = el("reviewSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rating, text })
    });
    if (!res.ok) throw new Error("Submission failed");
    form.reset();
    showToast("✅ Thank you for your feedback! Your review is pending approval.", "success");
    const pubRes = await fetch("/api/public");
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      state.reviews = pubData.reviews;
      renderReviews();
    }
  } catch {
    showToast("Could not submit review. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Review";
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────
el("searchInput").addEventListener("input", event => {
  state.query = event.target.value;
  renderMenu();
});
el("openCart").addEventListener("click", openCart);
el("closeCart").addEventListener("click", closeCart);
el("cartBackdrop").addEventListener("click", closeCart);
el("checkoutForm").addEventListener("submit", placeOrder);
el("reviewForm").addEventListener("submit", submitReview);
el("cartBar")?.addEventListener("animationend", () => el("cartBar")?.classList.remove("cart-bar--bump"));

load();

