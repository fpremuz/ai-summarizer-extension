import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({ path: './backend/.env' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function cleanText(rawText) {
  return rawText
    // Remove disambiguation or redirect notes
    .replace(/"AI" redirects here.*?Artificial intelligence\./s, "")
    // Remove Wikipedia-style sidebar content
    .replace(/This article is part of a series.*?Artificial intelligence \(AI\)/s, "")
    .replace(/Jump to content.*?Edit\s+/s, "")
    // Remove NewsQuiz mentions
    .replace(/The weekly News Quiz.*?\./s, "")
    .replace(/Use the weekly Newsquiz.*?\./s, "")
    // Remove [number] citations
    .replace(/\[\d+\]/g, "")
    // Remove unrelated bullet points or "Var:" mentions
    .replace(/(Var:|Var\b).*?(\.|\n)/gi, "")
    // Fix double words
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    // Remove non-standard characters
    .replace(/[^a-zA-Z0-9\s.,;:'"\-()]/g, "")
    // Collapse excess whitespace
    .replace(/\s+/g, " ")
    .trim();
}

const cache = {};

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

    console.log("Response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);

    const raw = await response.text();

    if (response.status === 504 || response.status === 503) {
      console.warn("⚠️ Hugging Face API timeout or unavailable. Retrying...");
      await new Promise(res => setTimeout(res, 4000 * attempt));
      continue;
    }

    try {
      const data = JSON.parse(raw);

      if (data.error) {
        console.warn("Model error:", data.error);
        throw new Error(data.error);
      }

      if (!Array.isArray(data) || !data[0]?.summary_text) {
        throw new Error("Invalid API response format");
      }

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

app.post("/summarize", async (req, res) => {
  let { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "No input text provided." });
  }

  text = cleanText(text).slice(0, 5000);

  if (cache[text]) {
    return res.json({ summary: cache[text] });
  }

  const chunkSize = 1300;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  try {
    const summaries = [];

    for (const chunk of chunks) {
      console.log("📤 Sending chunk:", chunk.slice(0, 100) + "...");
      const summary = await fetchWithRetry(chunk);
      summaries.push(summary);
    }

    const finalSummary = summaries.join(" ");
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