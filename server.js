import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ---- File paths ----
const portfolioPath = path.join(__dirname, "portfolio.json");
const tradesPath = path.join(__dirname, "trades.json");
const dataDir = path.join(__dirname, "data"); // for PSX JSONs

// ---- Utility: Safe JSON Read/Write ----
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]");
  const data = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(data);
  } catch {
    fs.writeFileSync(filePath, "[]");
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---- Safe Portfolio/Trades Readers ----
function readPortfolio() {
  const data = readJSON(portfolioPath);
  if (Array.isArray(data)) return data;
  if (data.portfolio && Array.isArray(data.portfolio)) return data.portfolio;
  return [];
}

function readTrades() {
  const data = readJSON(tradesPath);
  if (Array.isArray(data)) return data;
  if (data.trades && Array.isArray(data.trades)) return data.trades;
  return [];
}

// ---- Portfolio Routes ----
app.get("/api/portfolio", (req, res) => {
  res.json({ portfolio: readPortfolio() });
});

app.post("/api/portfolio", (req, res) => {
  const { symbol, qty, price } = req.body;
  if (!symbol || !qty || !price)
    return res.status(400).json({ error: "Missing symbol, qty, or price" });

  const portfolio = readPortfolio();
  const trades = readTrades();

  const existing = portfolio.find((s) => s.symbol === symbol);
  if (existing) {
    const oldQty = existing.qty;
    existing.qty += qty;
    existing.price = (existing.price * oldQty + price * qty) / existing.qty;
  } else {
    portfolio.push({ symbol, qty, price });
  }

  trades.push({
    type: "Buy",
    symbol,
    qty,
    price,
    date: new Date().toISOString(),
  });

  writeJSON(portfolioPath, portfolio);
  writeJSON(tradesPath, trades);

  res.json({ success: true, portfolio });
});

app.delete("/api/portfolio/:symbol", (req, res) => {
  const { symbol } = req.params;
  const { sellPrice } = req.body;
  if (!sellPrice) return res.status(400).json({ error: "Missing sellPrice" });

  const portfolio = readPortfolio();
  const trades = readTrades();

  const idx = portfolio.findIndex((s) => s.symbol === symbol);
  if (idx === -1) return res.status(404).json({ error: "Stock not found" });

  const stock = portfolio[idx];
  const proceeds = sellPrice * stock.qty;

  portfolio.splice(idx, 1);

  trades.push({
    type: "Sell",
    symbol,
    qty: stock.qty,
    price: sellPrice,
    proceeds,
    date: new Date().toISOString(),
  });

  writeJSON(portfolioPath, portfolio);
  writeJSON(tradesPath, trades);

  res.json({ success: true, message: `Sold ${symbol}`, newBalance: proceeds });
});

// ---- Trades with Filters ----
app.get("/api/trades", (req, res) => {
  let trades = readTrades();
  const { symbol, type, from, to } = req.query;

  if (symbol)
    trades = trades.filter((t) => t.symbol === symbol.toUpperCase());
  if (type)
    trades = trades.filter(
      (t) => t.type.toLowerCase() === type.toLowerCase()
    );
  if (from) trades = trades.filter((t) => new Date(t.date) >= new Date(from));
  if (to) trades = trades.filter((t) => new Date(t.date) <= new Date(to));

  res.json({ trades });
});

// ---- 🧠 Volume Leaders Comparison ----
// 📊 Compare today's and yesterday's data
app.get("/api/snapshot", (req, res) => {
  try {
    const dataDir = path.resolve("./data");
    if (!fs.existsSync(dataDir))
      return res.status(404).json({ error: "Data folder missing" });

    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    if (files.length === 0)
      return res.status(404).json({ error: "No data files found" });

    const latestFile = files[files.length - 1];
    const prevFile = files.length > 1 ? files[files.length - 2] : null;

    const todayRaw = JSON.parse(fs.readFileSync(path.join(dataDir, latestFile)));
    const prevRaw = prevFile
      ? JSON.parse(fs.readFileSync(path.join(dataDir, prevFile)))
      : [];

    // 🧠 Auto-handle both formats: array OR wrapped object
    const todayData = Array.isArray(todayRaw)
      ? { date: latestFile.replace(".json", ""), volumeLeaders: todayRaw }
      : todayRaw;

    const yesterdayData = Array.isArray(prevRaw)
      ? { volumeLeaders: prevRaw }
      : prevRaw;

    const todaySymbols = todayData.volumeLeaders.map((s) => s.symbol);
    const prevSymbols = yesterdayData.volumeLeaders
      ? yesterdayData.volumeLeaders.map((s) => s.symbol)
      : [];

    const newEntries = todayData.volumeLeaders.filter(
      (s) => !prevSymbols.includes(s.symbol)
    );

    res.json({
      date: todayData.date,
      volumeLeaders: todayData.volumeLeaders,
      newEntries,
    });
  } catch (err) {
    console.error("❌ Error in /api/snapshot:", err);
    res.status(500).json({ error: "Failed to compare snapshots." });
  }
});




app.listen(3000, () =>
  console.log("📊 psx-spotter server running on http://localhost:3000")
);
