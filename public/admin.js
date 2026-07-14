const store = {
  token: localStorage.getItem("ms_token"),
  data: null,
  tab: "overview",
  range: "today",
  seenOrders: new Set(),
  refreshTimer: null
};

const el = id => document.getElementById(id);
const rupee = value => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const nextStatus = status => ({ Pending: "Accepted", Accepted: "Preparing", Preparing: "Ready", Ready: "Completed" })[status];
const fieldAttrs = (item, name) => `data-field="${name}" data-id="${item.id}"`;
const fmtDate = iso => iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${store.token}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
  return res.json();
}

async function login(event) {
  event.preventDefault();
  const btn = event.currentTarget.querySelector("[type=submit]");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: el("email").value, password: el("password").value })
    });
    if (!res.ok) {
      showToast("Invalid email or password.", "error");
      return;
    }
    const data = await res.json();
    store.token = data.token;
    localStorage.setItem("ms_token", store.token);
    await loadDashboard();
  } catch {
    showToast("Login failed. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

async function loadDashboard(silent = false) {
  try {
    const previousIds = store.data ? new Set(store.data.orders.map(o => o.id)) : store.seenOrders;
    store.data = await api(`/api/admin/dashboard?range=${store.range}`);
    const newOrders = store.data.orders.filter(o => !previousIds.has(o.id));
    if (silent && newOrders.length) showToast(`🔔 ${newOrders.length} new order${newOrders.length === 1 ? "" : "s"} received!`);
    store.seenOrders = new Set(store.data.orders.map(o => o.id));
    el("loginPanel").hidden = true;
    el("dashboardPanel").hidden = false;
    if (silent) {
      // Background poll: only refresh live-data sections — never blow away forms being edited
      renderOverview();
      renderOrders();
      if (store.tab === "analytics") renderAnalytics();
    } else {
      renderAll();
    }
    startRefresh();
  } catch {
    localStorage.removeItem("ms_token");
    store.token = null;
    el("loginPanel").hidden = false;
    el("dashboardPanel").hidden = true;
  }
}

function startRefresh() {
  if (store.refreshTimer) return;
  store.refreshTimer = setInterval(() => loadDashboard(true), 10000);
}

let toastTimer = null;
function showToast(message, type = "success") {
  const toast = el("toast");
  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function renderAll() {
  renderOverview();
  renderOrders();
  renderMenuAdmin();
  renderReviewsAdmin();
  renderQr();
  renderAnalytics();
  renderSettings();
}

function renderOverview() {
  const { stats } = store.data;
  el("overview").innerHTML = `
    <div class="admin-grid">
      <article class="admin-card"><p>Today's Revenue</p><h3>${rupee(stats.todayRevenue)}</h3></article>
      <article class="admin-card"><p>Today's Orders</p><h3>${stats.todayOrders}</h3></article>
      <article class="admin-card"><p>Pending</p><h3>${stats.pending}</h3></article>
      <article class="admin-card"><p>Preparing</p><h3>${stats.preparing}</h3></article>
      <article class="admin-card"><p>Ready</p><h3>${stats.ready}</h3></article>
      <article class="admin-card"><p>Completed</p><h3>${stats.completed}</h3></article>
    </div>
    <div class="admin-card panel-spacer">
      <h3>Best Sellers</h3>
      <p>${stats.topItems.length ? stats.topItems.map(([name, qty]) => `${escHtml(name)} (${Number(qty)})`).join(", ") : "No orders yet."}</p>
    </div>
  `;
}

function renderOrders() {
  const rows = store.data.orders.map(order => {
    const next = nextStatus(order.status);
    return `
      <article class="order-card">
        <div>
          <p class="eyebrow">${escHtml(order.id)}</p>
          <h3>${escHtml(order.customerName)} · Table ${escHtml(String(order.table))}</h3>
          <p>${new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div class="order-items">${order.items.map(item => `<span>${Number(item.qty)} × ${escHtml(item.name)}</span>`).join("")}</div>
        <div class="order-footer">
          <strong>${rupee(order.total)}</strong>
          <span class="status-pill">${order.status}</span>
          ${next ? `<button class="button primary small" data-next="${order.id}" data-status="${next}">${next}</button>` : ""}
          <select data-order="${order.id}">
            ${store.data.statuses.map(s => `<option ${order.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </article>
    `;
  }).join("");
  el("orders").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">Live orders</p><h2>Order Management</h2></div>
      <button class="button ghost small" id="refreshOrders">Refresh</button>
    </div>
    <div class="orders-list">${rows || `<p class="empty">No orders yet.</p>`}</div>
  `;
  el("refreshOrders").addEventListener("click", () => loadDashboard());
  el("orders").querySelectorAll("[data-order]").forEach(select => {
    select.addEventListener("change", () => updateOrder(select.dataset.order, select.value));
  });
  el("orders").querySelectorAll("[data-next]").forEach(btn => {
    btn.addEventListener("click", () => updateOrder(btn.dataset.next, btn.dataset.status));
  });
}

async function updateOrder(id, status) {
  try {
    await api(`/api/admin/orders/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    showToast(`Order updated to ${status}.`);
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to update order.", "error");
  }
}

function renderMenuAdmin() {
  const options = store.data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  const cards = store.data.items.map(item => `
    <article class="menu-editor-card">
      <div class="image-uploader">
        <img src="${item.image || "/assets/logo.jpg"}" alt="${item.name}" data-preview="${item.id}">
        <label class="upload-control">
          <input type="file" accept="image/*" data-upload="${item.id}">
          Change image
        </label>
      </div>
      <div class="editor-fields">
        <input value="${escHtml(item.name)}" ${fieldAttrs(item, "name")} placeholder="Item name">
        <textarea ${fieldAttrs(item, "description")} placeholder="Description">${escHtml(item.description || "")}</textarea>
        <div class="split-fields">
          <input type="number" value="${item.price}" ${fieldAttrs(item, "price")} placeholder="Price" min="0">
          <select ${fieldAttrs(item, "categoryId")}>${store.data.categories.map(c => `<option value="${c.id}" ${item.categoryId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select>
        </div>
        <div class="split-fields">
          <select ${fieldAttrs(item, "status")}>${["available","unavailable","seasonal","hidden"].map(s => `<option ${item.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <select ${fieldAttrs(item, "type")}><option value="nonveg" ${item.type === "nonveg" ? "selected" : ""}>Non-veg</option><option value="veg" ${item.type === "veg" ? "selected" : ""}>Veg</option><option value="egg" ${item.type === "egg" ? "selected" : ""}>Egg</option></select>
        </div>
        <input type="hidden" value="${escHtml(item.image || "")}" ${fieldAttrs(item, "image")}>
        <div class="editor-flags">
          <label><input type="checkbox" ${fieldAttrs(item, "spicy")} ${item.spicy ? "checked" : ""}> Spicy</label>
          <label><input type="checkbox" ${fieldAttrs(item, "bestseller")} ${item.bestseller ? "checked" : ""}> Bestseller</label>
          <label><input type="checkbox" ${fieldAttrs(item, "recommended")} ${item.recommended ? "checked" : ""}> Recommended</label>
        </div>
        <div class="editor-actions">
          <button class="button primary small" data-save="${item.id}">Save changes</button>
          <button class="button ghost small danger-btn" data-delete="${item.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
  // ── Category manager ──
  const catRows = store.data.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(c => {
      const hasItems = store.data.items.some(item => item.categoryId === c.id);
      return `<div class="cat-row">
        <span class="cat-row-name">${escHtml(c.name)}</span>
        ${hasItems
          ? `<span class="cat-has-items">Has items</span>`
          : `<button class="button ghost small danger-btn" data-delete-cat="${escHtml(c.id)}">Delete</button>`}
      </div>`;
    }).join("");

  el("menuAdmin").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">Menu management</p><h2>Categories</h2></div>
    </div>
    <div class="admin-card category-manager">
      <form class="cat-add-form" id="addCatForm">
        <input name="name" required placeholder="New category name (e.g. Biryani)" autocomplete="off">
        <button class="button primary small" type="submit">Add Category</button>
      </form>
      <div class="cat-list">${catRows}</div>
    </div>
    <div class="section-head panel-spacer">
      <div><p class="eyebrow">Menu management</p><h2>Items</h2></div>
    </div>
    <form class="item-form admin-card" id="itemForm" autocomplete="off">
      <h3>Add New Item</h3>
      <div class="item-form-layout">
        <div class="image-uploader new-item-preview">
          <img src="/assets/logo.jpg" alt="New item preview" id="newItemPreview">
          <label class="upload-control">
            <input name="imageFile" type="file" accept="image/*" id="newItemImage">
            Upload food image
          </label>
          <input name="image" type="hidden" id="newItemImageValue">
        </div>
        <div class="editor-fields">
          <input name="name" required placeholder="Item name" autocomplete="off">
          <textarea name="description" placeholder="Description"></textarea>
          <div class="split-fields">
            <input name="price" type="number" required placeholder="Price" min="0" autocomplete="off">
            <select name="categoryId">${options}</select>
          </div>
          <div class="split-fields">
            <select name="type"><option value="nonveg">Non-veg</option><option value="veg">Veg</option><option value="egg">Egg</option></select>
            <select name="status"><option value="available">Available</option><option value="unavailable">Unavailable Today</option><option value="seasonal">Seasonal</option><option value="hidden">Hidden</option></select>
          </div>
          <div class="editor-flags">
            <label><input name="spicy" type="checkbox"> Spicy</label>
            <label><input name="bestseller" type="checkbox"> Bestseller</label>
            <label><input name="recommended" type="checkbox"> Recommended</label>
          </div>
          <button class="button primary" type="submit" id="addItemBtn">Add item</button>
        </div>
      </div>
    </form>
    <div class="menu-editor-grid panel-spacer">${cards}</div>
  `;

  // New item image upload — only touch the preview/hidden input, never re-render
  el("newItemImage").addEventListener("change", async event => {
    const image = await readImageInput(event.currentTarget);
    if (!image) return;
    el("newItemPreview").src = image;
    el("newItemImageValue").value = image;
    showToast("Image selected. Add the item to save.");
  });

  el("itemForm").addEventListener("submit", addItem);
  el("addCatForm").addEventListener("submit", addCategory);
  el("menuAdmin").querySelectorAll("[data-delete-cat]").forEach(btn =>
    btn.addEventListener("click", () => deleteCategory(btn.dataset.deleteCat))
  );

  // Existing item image uploads
  el("menuAdmin").querySelectorAll("[data-upload]").forEach(input => {
    input.addEventListener("change", async event => {
      const image = await readImageInput(event.currentTarget);
      if (!image) return;
      const id = event.currentTarget.dataset.upload;
      el("menuAdmin").querySelector(`[data-preview="${id}"]`).src = image;
      el("menuAdmin").querySelector(`[data-id="${id}"][data-field="image"]`).value = image;
      showToast("Image preview ready. Click Save to keep it.");
    });
  });

  el("menuAdmin").querySelectorAll("[data-save]").forEach(btn => btn.addEventListener("click", () => saveItem(btn.dataset.save)));
  el("menuAdmin").querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteItem(btn.dataset.delete)));
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function addCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = (form.querySelector("[name=name]")?.value || "").trim();
  if (!name) return;
  const btn = form.querySelector("[type=submit]");
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    await api("/api/admin/categories", { method: "POST", body: JSON.stringify({ name }) });
    showToast(`✅ Category "${escHtml(name)}" added.`);
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to add category.", "error");
    btn.disabled = false;
    btn.textContent = "Add Category";
  }
}

async function deleteCategory(id) {
  const cat = store.data.categories.find(c => c.id === id);
  const hasItems = store.data.items.some(item => item.categoryId === id);
  if (hasItems) {
    showToast("Cannot delete category because it still contains menu items.", "error");
    return;
  }
  if (!confirm(`Delete category "${cat?.name}"? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("🗑 Category deleted.");
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to delete category.", "error");
  }
}

async function addItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = el("addItemBtn");
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const data = new FormData(form);
    await api("/api/admin/items", {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        categoryId: data.get("categoryId"),
        price: Number(data.get("price")),
        image: data.get("image") || "",
        description: data.get("description"),
        type: data.get("type"),
        status: data.get("status"),
        spicy: data.has("spicy"),
        bestseller: data.has("bestseller"),
        recommended: data.has("recommended")
      })
    });
    showToast("✅ Item added successfully.");
    form.reset();
    el("newItemPreview").src = "/assets/logo.jpg";
    el("newItemImageValue").value = "";
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to add item.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Add item";
  }
}

async function saveItem(id) {
  const fields = [...el("menuAdmin").querySelectorAll(`[data-id="${id}"]`)];
  const item = store.data.items.find(e => e.id === id);
  if (!item) return;
  const body = { ...item };
  for (const input of fields) {
    if (input.type === "checkbox") body[input.dataset.field] = input.checked;
    else body[input.dataset.field] = input.dataset.field === "price" ? Number(input.value) : input.value;
  }
  const btn = el("menuAdmin").querySelector(`[data-save="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    await api(`/api/admin/items/${id}`, { method: "PUT", body: JSON.stringify(body) });
    showToast("✅ Item saved.");
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to save item.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Save changes"; }
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this item? This cannot be undone.")) return;
  try {
    await api(`/api/admin/items/${id}`, { method: "DELETE" });
    showToast("🗑 Item deleted.");
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to delete item.", "error");
  }
}

function renderReviewsAdmin() {
  const cards = store.data.reviews.map(r => `
    <article class="review-card review-admin-card">
      <div class="review-meta">
        <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
        <span class="review-status-badge ${r.approved ? "approved" : "pending"}">${r.approved ? "Approved" : "Pending"}</span>
        ${r.hidden ? `<span class="review-status-badge hidden-badge">Hidden</span>` : ""}
        ${r.featured ? `<span class="review-status-badge featured-badge">Featured</span>` : ""}
      </div>
      <p>${escHtml(r.text)}</p>
      <div class="review-author-row">
        <strong>${escHtml(r.name)}</strong>
        <span class="review-date">${fmtDate(r.createdAt)}</span>
      </div>
      <div class="review-actions">
        <button class="button ghost small" data-review="${r.id}" data-field="approved" data-value="${!r.approved}">${r.approved ? "Unapprove" : "Approve"}</button>
        <button class="button ghost small" data-review="${r.id}" data-field="hidden" data-value="${!r.hidden}">${r.hidden ? "Show" : "Hide"}</button>
        <button class="button ghost small" data-review="${r.id}" data-field="featured" data-value="${!r.featured}">${r.featured ? "Unfeature" : "Feature"}</button>
        <button class="button ghost small danger-btn" data-delete-review="${r.id}">Delete</button>
      </div>
    </article>
  `).join("");
  el("reviewsAdmin").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">Review moderation</p><h2>Reviews (${store.data.reviews.length})</h2></div>
    </div>
    <div class="review-admin-grid">${cards || `<p class="empty">No reviews yet.</p>`}</div>
  `;
  el("reviewsAdmin").querySelectorAll("[data-review]").forEach(btn => {
    btn.addEventListener("click", () => updateReview(btn.dataset.review, btn.dataset.field, btn.dataset.value === "true"));
  });
  el("reviewsAdmin").querySelectorAll("[data-delete-review]").forEach(btn => {
    btn.addEventListener("click", () => deleteReview(btn.dataset.deleteReview));
  });
}

async function updateReview(id, field, value) {
  try {
    await api(`/api/admin/reviews/${id}`, { method: "PUT", body: JSON.stringify({ [field]: value }) });
    showToast("Review updated.");
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to update review.", "error");
  }
}

async function deleteReview(id) {
  if (!confirm("Permanently delete this review?")) return;
  try {
    await api(`/api/admin/reviews/${id}`, { method: "DELETE" });
    showToast("🗑 Review deleted.");
    await loadDashboard();
  } catch (err) {
    showToast(err.message || "Failed to delete review.", "error");
  }
}

async function readImageInput(input) {
  const file = input.files?.[0];
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    showToast("Please choose an image file.", "error");
    return "";
  }
  if (file.size > 3_500_000) {
    showToast("Please choose an image below 3.5 MB.", "error");
    input.value = "";
    return "";
  }
  return fileToDataUrl(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderQr() {
  const origin = location.origin;
  const tableCount = Number(store.data.settings.tableCount || 5);
  const cards = Array.from({ length: tableCount }, (_, i) => {
    const table = i + 1;
    const url = `${origin}/menu?table=${table}`;
    const qr = `/api/qr?table=${table}`;
    return `
      <article class="qr-card">
        <h3>Table ${table}</h3>
        <img src="${qr}" alt="QR code for table ${table}">
        <p>${url}</p>
        <a class="button primary wide" href="${qr}" download="mann-o-salwa-table-${table}.svg">Download QR</a>
      </article>
    `;
  }).join("");
  el("qr").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">QR management</p><h2>Table QR Codes</h2></div>
    </div>
    <div class="qr-grid">${cards}</div>
  `;
}

function renderAnalytics() {
  const s = store.data.stats;
  el("analytics").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">Analytics</p><h2>Performance</h2></div>
      <select id="rangeFilter">
        <option value="today" ${store.range === "today" ? "selected" : ""}>Today</option>
        <option value="yesterday" ${store.range === "yesterday" ? "selected" : ""}>Yesterday</option>
        <option value="week" ${store.range === "week" ? "selected" : ""}>This Week</option>
        <option value="month" ${store.range === "month" ? "selected" : ""}>This Month</option>
        <option value="all" ${store.range === "all" ? "selected" : ""}>All Time</option>
      </select>
    </div>
    <div class="admin-grid">
      <article class="admin-card"><p>Revenue</p><h3>${rupee(s.selectedRevenue)}</h3></article>
      <article class="admin-card"><p>Orders</p><h3>${s.selectedOrders}</h3></article>
      <article class="admin-card"><p>Avg Order Value</p><h3>${rupee(s.averageOrderValue)}</h3></article>
      <article class="admin-card"><p>Best Selling Item</p><h3>${escHtml(s.bestSellingItem)}</h3></article>
      <article class="admin-card"><p>Best Category</p><h3>${escHtml(s.bestCategory)}</h3></article>
    </div>
    <div class="chart-grid panel-spacer">
      ${barChart("Revenue by Day", s.revenueByDay, rupee)}
      ${barChart("Orders by Day", s.ordersByDay, v => v)}
    </div>
  `;
  el("rangeFilter").addEventListener("change", async event => {
    store.range = event.target.value;
    await loadDashboard();
  });
}

function barChart(title, data, formatter) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return `
    <article class="admin-card">
      <h3>${title}</h3>
      <div class="bars">
        ${entries.length ? entries.map(([label, value]) => `
          <div class="bar-row">
            <span>${label.slice(5)}</span>
            <div><i style="width:${Math.max(6, (value / max) * 100)}%"></i></div>
            <strong>${formatter(value)}</strong>
          </div>
        `).join("") : `<p class="empty">No data yet.</p>`}
      </div>
    </article>
  `;
}

function renderSettings() {
  const s = store.data.settings;
  el("settings").innerHTML = `
    <form class="settings-form admin-card" id="settingsForm" autocomplete="off">
      <h3>Cafe Settings</h3>
      <label class="settings-label">Cafe Name<input name="cafeName" value="${escHtml(s.cafeName || "")}" placeholder="Cafe name"></label>
      <label class="settings-label">Logo path<input name="logo" value="${escHtml(s.logo || "")}" placeholder="/assets/logo.jpg"></label>
      <label class="settings-label">Hero banner path<input name="heroBanner" value="${escHtml(s.heroBanner || "")}" placeholder="/assets/banner.jpg"></label>
      <label class="settings-label">Phone<input name="phone" value="${escHtml(s.phone || "")}" placeholder="Phone number"></label>
      <label class="settings-label">Display hours<input name="hours" value="${escHtml(s.hours || "")}" placeholder="10 AM to 11 PM"></label>
      <label class="settings-label">Opening time<input name="openingHours" value="${escHtml(s.openingHours || "")}" placeholder="10:00"></label>
      <label class="settings-label">Closing time<input name="closingHours" value="${escHtml(s.closingHours || "")}" placeholder="23:00"></label>
      <label class="settings-label">Theme color<input name="themeColor" type="color" value="${s.themeColor || "#d8aa45"}"></label>
      <label class="settings-label">Table count<input name="tableCount" type="number" min="1" value="${Number(s.tableCount || 5)}"></label>
      <label class="settings-label">Address<textarea name="address">${escHtml(s.address || "")}</textarea></label>
      <label class="settings-label">Instagram URL<input name="instagram" value="${escHtml(s.instagram || "")}"></label>
      <label class="settings-label">Google Maps URL<input name="maps" value="${escHtml(s.maps || "")}"></label>
      <button class="button primary" type="submit" id="saveSettingsBtn">Save settings</button>
    </form>
  `;
  el("settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const btn = el("saveSettingsBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const form = new FormData(event.currentTarget);
      const body = Object.fromEntries(form.entries());
      await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) });
      showToast("✅ Settings saved.");
      await loadDashboard();
    } catch (err) {
      showToast(err.message || "Failed to save settings.", "error");
      btn.disabled = false;
      btn.textContent = "Save settings";
    }
  });
}

el("loginForm").addEventListener("submit", login);
el("logout").addEventListener("click", () => {
  clearInterval(store.refreshTimer);
  store.refreshTimer = null;
  localStorage.removeItem("ms_token");
  location.reload();
});
el("printQr").addEventListener("click", () => {
  switchTab("qr");
  setTimeout(() => print(), 150);
});
el("tabs").addEventListener("click", event => {
  const btn = event.target.closest("[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  store.tab = tab;
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".admin-section").forEach(section => section.classList.toggle("active", section.id === tab));
}

if (store.token) loadDashboard();
