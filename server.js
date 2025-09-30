// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Cho phép truy cập file index.html

// Đọc dữ liệu
app.get('/api/data', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Không đọc được dữ liệu' });
    res.json(JSON.parse(data || '[]'));
  });
});

// Ghi dữ liệu
app.post('/api/data', (req, res) => {
  const newData = req.body;
  fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'Lưu dữ liệu thất bại' });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server chạy tại: http://localhost:${PORT}`);
});

app.use(express.json());

app.post('/api/sync', (req, res) => {
  const clientData = req.body;
  // 🔸 Ở đây bạn có thể lưu vào file JSON hoặc database
  console.log('📥 Nhận dữ liệu từ client:', clientData);

  // Tạm thời server chỉ phản hồi lại dữ liệu client
  res.json(clientData);
});
