import express from "express";
import cors from "cors";
import fetch from "node-fetch"; 
import dotenv from "dotenv";

dotenv.config({ path: './backend/.env' });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post("/summarize", async (req, res) => {
  let { text } = req.body;
  text = text.slice(0, 1000);

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`, 
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error });
    }

    const data = await response.json();

    const summary = data[0]?.summary_text || "No summary generated.";
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});