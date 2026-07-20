import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config();
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");
const PORT = Number(process.env.PORT || 4174);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-before-production";
if (!process.env.JWT_SECRET) {
  console.warn("[WARN] JWT_SECRET env var is not set — using insecure default. Set it in production.");
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];
// MongoDB Connection
const mongoClient = new MongoClient(process.env.MONGODB_URI);

let mongoDb;

async function connectMongo() {
  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db("mann_o_salwa");
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed");
    console.error(err);
  }
}




// 👇 ISKE NICHE PASTE KARO

async function migrateDbToMongo() {
  

  await mongoDb.collection("settings").deleteMany({});
  await mongoDb.collection("admin").deleteMany({});
  await mongoDb.collection("categories").deleteMany({});
  await mongoDb.collection("items").deleteMany({});
  await mongoDb.collection("reviews").deleteMany({});

  await mongoDb.collection("settings").insertOne(db.settings);
  await mongoDb.collection("admin").insertOne(db.admin);

  if (db.categories.length)
    await mongoDb.collection("categories").insertMany(db.categories);

  if (db.items.length)
    await mongoDb.collection("items").insertMany(db.items);

  if (db.reviews.length)
    await mongoDb.collection("reviews").insertMany(db.reviews);

  console.log("✅ Migration Completed");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const seed = {
  settings: {
    cafeName: "Mann O Salwa",
    phone: "6300770073",
    address: "Bodhan Road, Habeeb Nagar, NRI Colony, Arsapally, Nizamabad, Telangana 503001",
    hours: "10 AM to 11 PM",
    instagram: "https://www.instagram.com/mann_salwa.nzb?igshid=NTc4MTIwNjQ2YQ%3D%3D",
    maps: "https://www.google.com/maps/place/Mannosalwa/@18.6761303,78.0832572,17z/data=!3m1!4b1!4m6!3m5!1s0x3bcddb284736ccf5:0x8e1a76caa04ca669!8m2!3d18.6761303!4d78.0832572!16s%2Fg%2F11tcz8j66t?entry=ttu&g_ep=EgoyMDI2MDYyNC4wIKXMDSoASAFQAw%3D%3D",
    currency: "INR",
    themeColor: "#b7422a",
    tableCount: 5
  },
  admin: {
    email: "funcky.adil@gmail.com",
    password: "mannosalwa2026"
  },
  categories: [
    { id: "shawarma", name: "Shawarma", order: 1 },
    { id: "starters", name: "Starters", order: 2 },
    { id: "burgers", name: "Burgers", order: 3 },
    { id: "fried-rice", name: "Fried Rice", order: 4 },
    { id: "noodles", name: "Noodles", order: 5 },
    { id: "curry", name: "Curries", order: 6 },
    { id: "rotis", name: "Rotis", order: 7 },
    { id: "broasted", name: "Broasted", order: 8 },
    { id: "wraps", name: "Wraps", order: 9 },
    { id: "sandwich", name: "Sandwich", order: 10 },
    { id: "platters", name: "Platters", order: 11 },
    { id: "desserts", name: "Desserts", order: 12 },
    { id: "others", name: "Others", order: 13 }
  ],
  items: [
    { id: "chicken-shawarma", categoryId: "shawarma", name: "Chicken Shawarma", price: 100, description: "Classic Mann O Salwa street-style shawarma.", type: "nonveg", spicy: false, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "chicken-classic-shawarma", categoryId: "shawarma", name: "Chicken Classic Shawarma", price: 120, description: "Creamy chicken filling with fresh wrap and sauces.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 },
    { id: "peri-peri-shawarma", categoryId: "shawarma", name: "Chicken Peri Peri Shawarma", price: 140, description: "Hot peri peri shawarma with a bright spice kick.", type: "nonveg", spicy: true, bestseller: true, recommended: true, status: "available", order: 3 },
    { id: "crispy-fried-shawarma", categoryId: "shawarma", name: "Crispy Fried Shawarma", price: 140, description: "Crunchy fried shawarma for a richer bite.", type: "nonveg", spicy: true, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "chicken-gyro-shawarma", categoryId: "shawarma", name: "Chicken Gyro Shawarma", price: 150, description: "Loaded wrap inspired by gyro flavours.", type: "nonveg", spicy: false, bestseller: false, recommended: true, status: "available", order: 5 },
    { id: "bbq-chicken-shawarma", categoryId: "shawarma", name: "BBQ Chicken Shawarma", price: 150, description: "Smoky BBQ sauce with juicy chicken.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 6 },
    { id: "veg-falafel-shawarma", categoryId: "shawarma", name: "Veg Falafel Shawarma", price: 90, description: "Falafel wrap with cafe sauces.", type: "veg", spicy: false, bestseller: false, recommended: true, status: "available", order: 7 },
    { id: "chicken-manchuria", categoryId: "starters", name: "Chicken Manchuria", price: 150, description: "Indo-Chinese chicken tossed in glossy sauce.", type: "nonveg", spicy: true, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "chilli-chicken", categoryId: "starters", name: "Chilli Chicken", price: 150, description: "Spicy chilli chicken with peppers and onions.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 2 },
    { id: "chicken-65", categoryId: "starters", name: "Chicken 65", price: 170, description: "South-style fried chicken bites.", type: "nonveg", spicy: true, bestseller: true, recommended: false, status: "available", order: 3 },
    { id: "drum-stick", categoryId: "starters", name: "Drum Stick", price: 100, description: "Crisp chicken drumsticks.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "veg-manchuria", categoryId: "starters", name: "Veg Manchuria", price: 70, description: "Crisp veg dumplings in Manchurian sauce.", type: "veg", spicy: true, bestseller: false, recommended: false, status: "available", order: 5 },
    { id: "chicken-regular-burger", categoryId: "burgers", name: "Chicken Regular Burger", price: 70, description: "Simple chicken burger with soft bun.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 1 },
    { id: "chicken-zinger-burger", categoryId: "burgers", name: "Chicken Zinger Burger", price: 100, description: "Crispy zinger patty with cafe sauce.", type: "nonveg", spicy: true, bestseller: true, recommended: true, status: "available", order: 2 },
    { id: "malai-tikka-burger", categoryId: "burgers", name: "Malai Tikka Burger", price: 150, description: "Creamy malai tikka chicken burger.", type: "nonveg", spicy: false, bestseller: false, recommended: true, status: "available", order: 3 },
    { id: "veg-burger", categoryId: "burgers", name: "Veg Burger", price: 70, description: "Vegetarian burger with fresh crunch.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "paneer-tikka-burger", categoryId: "burgers", name: "Paneer Tikka Burger", price: 150, description: "Paneer tikka patty with rich sauce.", type: "veg", spicy: true, bestseller: false, recommended: true, status: "available", order: 5 },
    { id: "chicken-fried-rice", categoryId: "fried-rice", name: "Chicken Fried Rice", price: 100, description: "Basmati fried rice with chicken.", type: "nonveg", spicy: false, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "chicken-manchurian-rice", categoryId: "fried-rice", name: "Chicken Manchurian Rice", price: 150, description: "Fried rice mixed with Manchurian flavour.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 2 },
    { id: "chicken-schezwan-rice", categoryId: "fried-rice", name: "Chicken Schezwan Rice", price: 120, description: "Schezwan fried rice with chicken.", type: "nonveg", spicy: true, bestseller: false, recommended: false, status: "available", order: 3 },
    { id: "paneer-fried-rice", categoryId: "fried-rice", name: "Paneer Fried Rice", price: 120, description: "Paneer fried rice with house seasoning.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "veg-fried-rice", categoryId: "fried-rice", name: "Veg Fried Rice", price: 80, description: "Vegetable fried rice.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 5 },
    { id: "chicken-noodles", categoryId: "noodles", name: "Chicken Noodles", price: 100, description: "Classic chicken noodles.", type: "nonveg", spicy: false, bestseller: true, recommended: false, status: "available", order: 1 },
    { id: "chicken-manchurian-noodles", categoryId: "noodles", name: "Chicken Manchurian Noodles", price: 150, description: "Noodles tossed with Manchurian sauce.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 2 },
    { id: "veg-noodles", categoryId: "noodles", name: "Veg Noodles", price: 70, description: "Vegetable noodles.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 3 },
    { id: "egg-noodles", categoryId: "noodles", name: "Egg Noodles", price: 80, description: "Noodles tossed with egg.", type: "egg", spicy: false, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "hyderabadi-chicken", categoryId: "curry", name: "Hyderabadi Chicken Curry", price: 230, description: "Half portion Hyderabadi chicken curry.", type: "nonveg", spicy: true, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "mutton-fry", categoryId: "curry", name: "Mutton Fry", price: 280, description: "Full portion mutton fry.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 2 },
    { id: "mutton-mughlai", categoryId: "curry", name: "Mutton Mughlai", price: 300, description: "Rich Mughlai mutton curry.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 3 },
    { id: "methhi-mutton", categoryId: "curry", name: "Methi Mutton", price: 320, description: "Mutton with methi aroma.", type: "nonveg", spicy: true, bestseller: false, recommended: false, status: "available", order: 4 },
    { id: "tandoori-roti", categoryId: "rotis", name: "Tandoori Roti", price: 10, description: "Fresh tandoori roti.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 1 },
    { id: "rumali-roti", categoryId: "rotis", name: "Rumali Roti", price: 15, description: "Soft thin rumali roti.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 },
    { id: "butter-naan", categoryId: "rotis", name: "Butter Naan", price: 40, description: "Butter naan from the tandoor.", type: "veg", spicy: false, bestseller: true, recommended: false, status: "available", order: 3 },
    { id: "chicken-broasted", categoryId: "broasted", name: "Chicken Broasted 3 Pc", price: 180, description: "Al Baik style broasted chicken.", type: "nonveg", spicy: false, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "chicken-boneless-strips", categoryId: "broasted", name: "Chicken Boneless Strips", price: 80, description: "Four pieces boneless strips.", type: "nonveg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 },
    { id: "chicken-wings", categoryId: "broasted", name: "Chicken Wings 4 Pc", price: 90, description: "Crispy chicken wings.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 3 },
    { id: "chicken-shawarma-wrap", categoryId: "wraps", name: "Chicken Shawarma Wrap", price: 120, description: "Grilled wrap with shawarma filling.", type: "nonveg", spicy: false, bestseller: false, recommended: true, status: "available", order: 1 },
    { id: "veg-paneer-shawarma-wrap", categoryId: "wraps", name: "Veg Paneer Shawarma Wrap", price: 150, description: "Paneer shawarma wrap.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 },
    { id: "chicken-cheese-sandwich", categoryId: "sandwich", name: "Chicken Cheese Sandwich", price: 100, description: "Toasted chicken cheese sandwich.", type: "nonveg", spicy: false, bestseller: true, recommended: false, status: "available", order: 1 },
    { id: "club-veg-sandwich", categoryId: "sandwich", name: "Club Veg Sandwich", price: 70, description: "Layered veg club sandwich.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 },
    { id: "chicken-popcorn", categoryId: "sandwich", name: "Chicken Popcorn", price: 100, description: "Crispy chicken popcorn.", type: "nonveg", spicy: false, bestseller: false, recommended: true, status: "available", order: 3 },
    { id: "kebab-platter", categoryId: "platters", name: "Kebab Platter", price: 200, description: "Mixed kebab platter.", type: "nonveg", spicy: true, bestseller: true, recommended: true, status: "available", order: 1 },
    { id: "mix-platter", categoryId: "platters", name: "MS Special Mix Platter", price: 250, description: "House special mixed platter.", type: "nonveg", spicy: true, bestseller: false, recommended: true, status: "available", order: 2 },
    { id: "shahi-malai", categoryId: "desserts", name: "Shahi Malai", price: 120, description: "Creamy dessert finish.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 1 },
    { id: "fruit-mandi", categoryId: "desserts", name: "Fruit Mandi", price: 200, description: "Fruit dessert platter.", type: "veg", spicy: false, bestseller: false, recommended: false, status: "available", order: 2 }
  ],
  orders: [],
  reviews: [
    { id: "r1", name: "Adil", rating: 5, text: "Fresh shawarma and fast service.", approved: true },
    { id: "r2", name: "Sameer", rating: 5, text: "Best late-night cafe stop in Nizamabad.", approved: true },
    { id: "r3", name: "Ayesha", rating: 4, text: "Loved the broasted chicken and wraps.", approved: true }
  ]
};

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(dbPath);
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    const migrated = migrateDb(db);
    if (migrated.changed) await writeFile(dbPath, JSON.stringify(migrated.db, null, 2));
  } catch {
    await writeFile(dbPath, JSON.stringify(migrateDb(seed).db, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  return JSON.parse(await readFile(dbPath, "utf8"));
}

async function writeDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith("scrypt:")) return password === stored;
  const [, salt, hash] = stored.split(":");
  const actual = Buffer.from(hashPassword(password, salt).split(":")[2], "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function verifyAdminLogin(body, db) {
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (ADMIN_EMAIL && (ADMIN_PASSWORD_HASH || ADMIN_PASSWORD)) {
    const stored = ADMIN_PASSWORD_HASH || hashPassword(ADMIN_PASSWORD);
    return email === ADMIN_EMAIL && verifyPassword(password, stored);
  }
  return email === db.admin.email && verifyPassword(password, db.admin.passwordHash || db.admin.password);
}

function normalizeStatus(status) {
  const map = {
    New: "Pending",
    pending: "Pending",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
    unavailable: "unavailable"
  };
  return map[status] || (ORDER_STATUSES.includes(status) ? status : "Pending");
}

function defaultImageFor(categoryId) {
  const map = {
    shawarma: "/assets/logo.jpg",
    starters: "/assets/menu-curry-starters.png",
    burgers: "/assets/menu-burgers.png",
    curry: "/assets/menu-curry-starters.png",
    broasted: "/assets/images.jpg",
    desserts: "/assets/images (1).jpg"
  };
  return map[categoryId] || "/assets/logo.jpg";
}

function migrateDb(db) {
  let changed = false;
  db.settings = {
    logo: "/assets/logo.jpg",
    heroBanner: "/assets/images (1).jpg",
    openingHours: "10:00",
    closingHours: "23:00",
    themeColor: "#d8aa45",
    whatsappEnabled: false,
    ...db.settings
  };
  if (db.admin?.password && !db.admin.passwordHash) {
    db.admin.passwordHash = hashPassword(db.admin.password);
    delete db.admin.password;
    changed = true;
  }
  db.items = (db.items || []).map(item => {
    const next = { image: defaultImageFor(item.categoryId), ...item };
    if (!item.image) changed = true;
    return next;
  });
  db.orders = (db.orders || []).map(order => {
    const status = normalizeStatus(order.status);
    if (status !== order.status) changed = true;
    return { ...order, status };
  });
  db.reviews = (db.reviews || []).map(review => {
    const next = {
      createdAt: review.createdAt || new Date().toISOString(),
      hidden: Boolean(review.hidden),
      featured: Boolean(review.featured),
      image: review.image || "",
      ...review
    };
    if (!review.createdAt || review.hidden === undefined || review.featured === undefined || review.image === undefined) changed = true;
    return next;
  });
  // Guarantee the "Others" catch-all category exists
  if (!(db.categories || []).some(c => c.id === "others")) {
    db.categories = [...(db.categories || []), { id: "others", name: "Others", order: 99 }];
    changed = true;
  }
  return { db, changed };
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function sign(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}

function verify(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function requireAuth(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const user = verify(token);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

function cleanItem(input) {
  return {
    id: input.id || `${Date.now()}-${randomBytes(3).toString("hex")}`,
    categoryId: String(input.categoryId || ""),
    name: String(input.name || "").trim(),
    price: Number(input.price || 0),
    description: String(input.description || "").trim(),
    image: String(input.image || defaultImageFor(input.categoryId)).trim(),
    type: input.type || "nonveg",
    spicy: Boolean(input.spicy),
    bestseller: Boolean(input.bestseller),
    recommended: Boolean(input.recommended),
    status: input.status || "available",
    order: Number(input.order || 99)
  };
}

function dateRange(filter) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (filter === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (filter === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    end.setTime(now.getTime());
  } else if (filter === "month") {
    start.setDate(1);
    end.setTime(now.getTime());
  } else if (filter === "all") {
    return null;
  }
  return { start, end };
}

function withinRange(order, range) {
  if (!range) return true;
  const date = new Date(order.createdAt);
  return date >= range.start && date < range.end;
}

function buildDashboard(db, filter = "today") {
  const todayRange = dateRange("today");
  const selectedRange = dateRange(filter);
  const todayCompleted = db.orders.filter(order => order.status === "Completed" && withinRange(order, todayRange));
  const selectedOrders = db.orders.filter(order => withinRange(order, selectedRange));
  const selectedCompleted = selectedOrders.filter(order => order.status === "Completed");
  const statusCount = status => db.orders.filter(order => order.status === status).length;
  const itemCounts = {};
  const categoryCounts = {};
  const revenueByDay = {};
  const ordersByDay = {};
  for (const order of selectedOrders) {
    const day = order.createdAt.slice(0, 10);
    ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    if (order.status === "Completed") revenueByDay[day] = (revenueByDay[day] || 0) + Number(order.total || 0);
    for (const item of order.items) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + Number(item.qty || 1);
      const menuItem = db.items.find(entry => entry.id === item.id);
      const category = db.categories.find(entry => entry.id === (item.categoryId || menuItem?.categoryId));
      if (category) categoryCounts[category.name] = (categoryCounts[category.name] || 0) + Number(item.qty || 1);
    }
  }
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const bestCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No data";
  const selectedRevenue = selectedCompleted.reduce((sum, order) => sum + Number(order.total || 0), 0);
  return {
    stats: {
      todayRevenue: todayCompleted.reduce((sum, order) => sum + Number(order.total || 0), 0),
      todayOrders: db.orders.filter(order => withinRange(order, todayRange)).length,
      pending: statusCount("Pending"),
      accepted: statusCount("Accepted"),
      preparing: statusCount("Preparing"),
      ready: statusCount("Ready"),
      completed: statusCount("Completed"),
      selectedRevenue,
      selectedOrders: selectedOrders.length,
      averageOrderValue: selectedCompleted.length ? selectedRevenue / selectedCompleted.length : 0,
      bestSellingItem: topItems[0]?.[0] || "No data",
      bestCategory,
      topItems,
      revenueByDay,
      ordersByDay
    },
    orders: db.orders,
    settings: db.settings,
    categories: db.categories,
    items: db.items,
    reviews: db.reviews,
    statuses: ORDER_STATUSES
  };
}

async function api(req, res, url) {
  const db = await readDb();
  db.orders = await mongoDb
  .collection("orders")
  .find({})
  .sort({ createdAt: -1 })
  .toArray();

db.settings = await mongoDb.collection("settings").findOne({});

db.admin = await mongoDb.collection("admin").findOne({});

db.categories = await mongoDb
  .collection("categories")
  .find({})
  .sort({ order: 1 })
  .toArray();

db.items = await mongoDb
  .collection("items")
  .find({})
  .sort({ order: 1 })
  .toArray();

db.reviews = await mongoDb
  .collection("reviews")
  .find({})
  .sort({ createdAt: -1 })
  .toArray();  

  


  if (req.method === "GET" && url.pathname === "/api/qr") {
    const table = String(url.searchParams.get("table") || "").replace(/[^\w-]/g, "");
    const target = `${url.origin}/menu?table=${encodeURIComponent(table || "1")}`;
    const svg = await QRCode.toString(target, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      color: {
        dark: "#241b18",
        light: "#fffaf4"
      }
    });
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="mann-o-salwa-table-${table || "1"}.svg"`
    });
    return res.end(svg);
  }

  if (req.method === "GET" && url.pathname === "/api/public") {
    const visibleItems = db.items.filter(item => item.status !== "hidden");
    return json(res, 200, { settings: db.settings, categories: db.categories, items: visibleItems, reviews: db.reviews.filter(r => r.approved) });
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!body.customerName || !body.table || !items.length) return json(res, 400, { error: "Name, table, and items are required" });
    const validItems = items.map(item => {
      const menuItem = db.items.find(entry => entry.id === item.id);
      if (!menuItem || !["available", "seasonal"].includes(menuItem.status)) return null;
      return {
        id: menuItem.id,
        name: menuItem.name,
        price: Number(menuItem.price || 0),
        qty: Math.max(1, Number(item.qty || 1)),
        categoryId: menuItem.categoryId
      };
    }).filter(Boolean);
    if (!validItems.length) return json(res, 400, { error: "No available menu items selected" });
    const order = {
      id: `MS-${Date.now().toString(36).toUpperCase()}`,
      customerName: String(body.customerName).trim(),
      table: String(body.table).trim(),
      items: validItems,
      total: validItems.reduce((sum, item) => sum + item.price * item.qty, 0),
      status: "Pending",
      createdAt: new Date().toISOString()
    };await mongoDb.collection("orders").insertOne(order);
    
    return json(res, 201, { order });
  }

  if (req.method === "POST" && url.pathname === "/api/reviews") {
    const body = await readBody(req);
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    if (!body.name || !body.text) return json(res, 400, { error: "Name and review are required" });
    const review = {
      id: `RV-${Date.now().toString(36).toUpperCase()}`,
      name: String(body.name).trim(),
      rating,
      text: String(body.text).trim(),
      image: String(body.image || ""),
      approved: false,
      hidden: false,
      featured: false,
      createdAt: new Date().toISOString()
    };
    db.reviews.unshift(review);
    await writeDb(db);
    return json(res, 201, { review });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    if (verifyAdminLogin(body, db)) {
      return json(res, 200, { token: sign({ email: body.email, exp: Date.now() + 1000 * 60 * 60 * 12 }) });
    }
    return json(res, 401, { error: "Invalid login" });
  }

  if (url.pathname.startsWith("/api/admin")) {
    if (!requireAuth(req, res)) return;
    if (req.method === "GET" && url.pathname === "/api/admin/dashboard") {
      return json(res, 200, buildDashboard(db, url.searchParams.get("range") || "today"));
    }
   if (req.method === "PUT" && url.pathname.startsWith("/api/admin/orders/")) {
  const id = decodeURIComponent(url.pathname.split("/").pop());
  const body = await readBody(req);

  const status = normalizeStatus(body.status);

  await mongoDb.collection("orders").updateOne(
    { id },
    {
      $set: { status }
    }
  );

  const order = await mongoDb.collection("orders").findOne({ id });

  if (!order) {
    return json(res, 404, { error: "Order not found" });
  }

  return json(res, 200, { order });
}
   if (req.method === "POST" && url.pathname === "/api/admin/items") {
  const item = cleanItem(await readBody(req));

  if (!item.name || !item.categoryId) {
    return json(res, 400, {
      error: "Item name and category are required"
    });
  }

  await mongoDb.collection("items").insertOne(item);

  return json(res, 201, { item });
}
    
      if (req.method === "PUT" && url.pathname.startsWith("/api/admin/items/")) {
  const id = decodeURIComponent(url.pathname.split("/").pop());

  const existing = await mongoDb.collection("items").findOne({ id });

  if (!existing) {
    return json(res, 404, { error: "Item not found" });
  }

  const updated = cleanItem({
    ...existing,
    ...(await readBody(req)),
    id
  });

  await mongoDb.collection("items").updateOne(
    { id },
    {
      $set: updated
    }
  );

  return json(res, 200, {
    item: updated
  });
}
   
    if (req.method === "POST" && url.pathname === "/api/admin/categories") {
      const body = await readBody(req);
      const category = { id: body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: body.name, order: Number(body.order || db.categories.length + 1) };
      db.categories.push(category);
      await writeDb(db);
      return json(res, 201, { category });
    }
    
    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/items/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());

      const result = await mongoDb.collection("items").deleteOne({ id });

      if (result.deletedCount === 0) {
       return json(res, 404, {
       error: "Item not found"
       });
     }

      return json(res, 200, {
        ok: true
      });
    }
    if (req.method === "PUT" && url.pathname === "/api/admin/settings") {
      db.settings = { ...db.settings, ...(await readBody(req)) };
      await writeDb(db);
      return json(res, 200, { settings: db.settings });
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/reviews/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const review = db.reviews.find(entry => entry.id === id);
      if (!review) return json(res, 404, { error: "Review not found" });
      Object.assign(review, await readBody(req));
      await writeDb(db);
      return json(res, 200, { review });
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/reviews/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      db.reviews = db.reviews.filter(review => review.id !== id);
      await writeDb(db);
      return json(res, 200, { ok: true });
    }
  }

  json(res, 404, { error: "Not found" });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/menu") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";
  const file = normalize(join(publicDir, pathname));
  if (!file.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    await stat(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

await ensureDb();
await connectMongo();


createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
}).listen(PORT, () => {
  console.log(`Mann O Salwa running at http://localhost:${PORT}`);
});
