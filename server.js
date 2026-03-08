const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------------- GOOGLE TRANSLATE (UNOFFICIAL) ----------------

async function translateText(text, source, target) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  const data = await res.json();

  // Повертаємо весь переклад (усі речення)
  return data[0].map(item => item[0]).join(" ");
}

// ---------------- TEXT ENDPOINT ----------------

app.post("/translate-text", async (req, res) => {
  const { text, fromLang, toLang } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Empty text" });
  }

  try {
    const translated = await translateText(text, fromLang, toLang);
    res.json({ translated });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

// ---------------- FILE ENDPOINT ----------------

app.post("/translate-file", upload.single("file"), async (req, res) => {
  const file = req.file;
  const { fromLang, toLang } = req.body;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    let text = "";

    if (file.mimetype === "text/plain") {
      text = fs.readFileSync(file.path, "utf8");
    } else if (file.mimetype === "application/pdf") {
      const data = await pdfParse(fs.readFileSync(file.path));
      text = data.text;
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: file.path });
      text = result.value;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!text.trim()) {
      return res.status(400).json({ error: "File content is empty" });
    }

    const translated = await translateText(text, fromLang, toLang);

    fs.unlinkSync(file.path);

    res.json({ translated });
  } catch (err) {
    console.error("File translation error:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

// ---------------- START SERVER ----------------

app.listen(8080,"127.0.0.1", () => {
  console.log("Server running on http://127.0.0.1:8080");
});