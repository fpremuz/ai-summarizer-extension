import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({ path: './backend/.env' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- General cleaner (works for any text) ---
function generalClean(text) {
  return text
    .replace(/\[\d+\]/g, "") // remove [1], [23] etc.
    .replace(/\b(\w+)\s+\1\b/gi, "$1") // remove duplicated words
    .replace(/[^a-zA-Z0-9\s.,;:'"\-()]/g, "") // remove non-standard characters
    .replace(/\s+/g, " ") // collapse extra whitespace
    .replace(/ \./g, ".") // fix space before periods
    .replace(/"\s*([.,])/g, '$1') // remove quote before punctuation
    .replace(/([a-z])\s+([A-Z])/g, (_, a, b) => `${a}. ${b}`) // insert missing periods
    .trim();
}

// --- Specific cleaner for Wikipedia AI article (optional) ---
function cleanWikipediaAIArticle(text) {
  return text
    .replace(/"AI" redirects here.*?Artificial intelligence\./s, "")
    .replace(/This article is part of a series.*?Artificial intelligence \(AI\)/s, "")
    .replace(/Jump to content.*?Edit\s+/s, "")
    .replace(/The weekly News Quiz.*?\./s, "")
    .replace(/Use the weekly Newsquiz.*?\./s, "");
}

// --- Hugging Face API call with retry logic ---
const fetchWithRetry = async (chunk, retries = 3) => {
  const endpoint = "https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6";

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`➡️ Attempt ${attempt} to summarize chunk...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({ inputs: chunk }),
    });

    const raw = await response.text();
    console.log("Response status:", response.status);

    if (response.status === 504 || response.status === 503) {
      console.warn("⚠️ API unavailable or timeout. Retrying...");
      await new Promise(res => setTimeout(res, 4000 * attempt));
      continue;
    }

    try {
      const data = JSON.parse(raw);

      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data) || !data[0]?.summary_text)
        throw new Error("Invalid API response format");

      return data[0].summary_text;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`❌ Failed after ${retries} retries: ${err.message}`);
      }
      console.warn("⚠️ Parse error or API issue:", err.message);
    }
  }

  throw new Error("❌ All retries failed");
};

// --- Caching to avoid repeat summarizations ---
const cache = {};

// --- Helper: Split text into overlapping chunks ---
function splitIntoChunks(text, chunkSize = 1300, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    if (end > text.length) end = text.length;

    chunks.push(text.slice(start, end));
    start += chunkSize - overlap; // move start by chunkSize minus overlap
  }

  return chunks;
}

// --- Post-process final summary for cleaner output ---
function postProcessSummary(summary) {
  return summary
    .replace(/\s+([.,;!?])/g, "$1")     // remove space before punctuation
    .replace(/([.!?])([A-Za-z])/g, (m, p1, p2) => p1 + " " + p2) // ensure space after punctuation
    .replace(/\s+/g, " ")               // normalize whitespace
    .trim();
}

// --- Main summarize route ---
app.post("/summarize", async (req, res) => {
  let { text, source } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "No input text provided." });
  }

  // Optional source flag for better cleaning
  if (source === "wikipedia_ai") {
    text = cleanWikipediaAIArticle(text);
  }

  text = generalClean(text).slice(0, 5000);

  if (cache[text]) {
    return res.json({ summary: cache[text] });
  }

  const chunks = splitIntoChunks(text);

  try {
    const summaries = [];

    for (const chunk of chunks) {
      console.log("📤 Sending chunk:", chunk.slice(0, 100) + "...");
      const summary = await fetchWithRetry(chunk);
      summaries.push(summary);
    }

    let finalSummary = summaries.join(" ");
    finalSummary = postProcessSummary(finalSummary);

    cache[text] = finalSummary;

    res.json({ summary: finalSummary });
  } catch (err) {
    console.error("❌ Summarization error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});