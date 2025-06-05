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
    .replace(/"AI" redirects here.*?Artificial intelligence\./s, "")
    .replace(/Jump to content.*?Newsquiz.*?\./s, "")
    .replace(/\[\d+\]/g, "") 
    .replace(/\s+/g, " ") 
    .trim();
}

app.post("/summarize", async (req, res) => {
  let { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "No input text provided." });
  }

  text = cleanText(text).slice(0, 3000); 

  const chunkSize = 1000;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  try {
    const summaries = [];

    for (const chunk of chunks) {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          },
          body: JSON.stringify({ inputs: `Summarize this article in 3-4 sentences: ${chunk}` }),
        }
      );

      const data = await response.json();

      if (!Array.isArray(data) || !data[0]?.summary_text) {
        console.error("API error response:", data);
        return res.status(500).json({ error: JSON.stringify(data) });
      }

      summaries.push(data[0].summary_text);
    }

    const finalSummary = summaries.join(" ");
    res.json({ summary: finalSummary });
  } catch (err) {
    console.error("Summarization error:", err);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});