// // fetchData.js
import puppeteer from "puppeteer";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DPS_URL = "https://dps.psx.com.pk/";
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(DPS_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Extract table data
  const data = await page.evaluate(() => {
    const findTable = (keyword) => {
      const tables = document.querySelectorAll("table");
      for (const t of tables) {
        const header = t.innerText.toLowerCase();
        if (header.includes(keyword.toLowerCase())) return t;
      }
      return null;
    };
    const table = findTable("volume");
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    return rows.map((r) => {
      const cols = r.innerText.split("\t");
      return { symbol: cols[0], volume: cols[cols.length - 1] };
    });
  });

  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(dataDir, `${date}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`✅ Saved ${data.length} volume leaders to ${file}`);

  await browser.close();
})();



// // fetchData.js
// import puppeteer from "puppeteer";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const DPS_URL = "https://dps.psx.com.pk/";
// const dataDir = path.join(__dirname, "data");
// if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// (async () => {
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ["--no-sandbox"],
//   });

//   const page = await browser.newPage();
//   await page.goto(DPS_URL, { waitUntil: "networkidle2", timeout: 30000 });
//   await page.waitForTimeout(2000);

//   const data = await page.evaluate(() => {
//     const tables = Array.from(document.querySelectorAll("table"));

//     // Find table that contains "Volume"
//     const table = tables.find(t =>
//       t.innerText.toLowerCase().includes("volume")
//     );
//     if (!table) return [];

//     // Get headers to locate % change column dynamically
//     const headers = Array.from(table.querySelectorAll("thead th"))
//       .map(th => th.innerText.toLowerCase());

//     const symbolIdx = headers.findIndex(h => h.includes("symbol"));
//     const volumeIdx = headers.findIndex(h => h.includes("volume"));
//     const changeIdx = headers.findIndex(h => h.includes("%") || h.includes("chg"));

//     const rows = Array.from(table.querySelectorAll("tbody tr"));

//     return rows.map(row => {
//       const cols = Array.from(row.querySelectorAll("td"))
//         .map(td => td.innerText.trim());

//       return {
//         symbol: cols[symbolIdx] || "",
//         volume: cols[volumeIdx] || "",
//         percentChange: cols[changeIdx] || "0%",
//         direction:
//           cols[changeIdx]?.includes("-") ? "down" :
//           cols[changeIdx]?.includes("+") ? "up" : "flat"
//       };
//     });
//   });

//   const date = new Date().toISOString().slice(0, 10);
//   const file = path.join(dataDir, `${date}.json`);

//   fs.writeFileSync(file, JSON.stringify(data, null, 2));

//   console.log(`✅ Saved ${data.length} volume leaders to ${file}`);
//   await browser.close();
// })();
