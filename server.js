// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 8080;
const DATA_FILE = path.join(__dirname, "data.json");

// 1) middleware
app.use(cors());

// Tăng giới hạn body để tránh PayloadTooLargeError
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(express.static(__dirname)); // phục vụ index.html, css, js...

// helper: đảm bảo file data.json tồn tại và là object đúng format
function safeParseData(text) {
  try {
    const parsed = JSON.parse(text || "");
    // Nếu file cũ là [] thì convert về object mặc định
    if (Array.isArray(parsed)) {
      return { categories: [], currentCategoryIndex: 0 };
    }
    // Nếu là object thì dùng luôn, thiếu field thì bổ sung
    if (parsed && typeof parsed === "object") {
      if (!Array.isArray(parsed.categories)) parsed.categories = [];
      if (typeof parsed.currentCategoryIndex !== "number")
        parsed.currentCategoryIndex = 0;
      return parsed;
    }
  } catch (e) {}
  return { categories: [], currentCategoryIndex: 0 };
}

// 2) API: đọc dữ liệu
app.get("/api/data", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, text) => {
    if (err) {
      // Nếu chưa có file thì trả default
      if (err.code === "ENOENT") {
        return res.json({ categories: [], currentCategoryIndex: 0 });
      }
      return res.status(500).json({ error: "Không đọc được dữ liệu" });
    }
    const data = safeParseData(text);
    res.json(data);
  });
});

// 3) API: ghi dữ liệu
app.post("/api/data", (req, res) => {
  const newData = req.body;

  // Chặn rác / đảm bảo format tối thiểu
  if (!newData || typeof newData !== "object") {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }

  fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), (err) => {
    if (err) return res.status(500).json({ error: "Lưu dữ liệu thất bại" });
    res.json({ success: true });
  });
});

// 4) sync (nếu bạn còn cần)
app.post("/api/sync", (req, res) => {
  res.json(req.body);
});

// 5) start server
app.listen(PORT, () => {
  console.log(`✅ Server chạy tại: http://localhost:${PORT}`);
});
