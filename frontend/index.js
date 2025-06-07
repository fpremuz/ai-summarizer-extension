const inputText = document.getElementById("inputText");
const summarizeBtn = document.getElementById("summarizeBtn");
const loadingIndicator = document.getElementById("loading");
const resultSection = document.getElementById("resultSection");
const summaryText = document.getElementById("summaryText");
const copyBtn = document.getElementById("copyBtn");
const errorMsg = document.getElementById("errorMsg");

summarizeBtn.addEventListener("click", async () => {
  errorMsg.textContent = "";
  const text = inputText.value.trim();

  if (!text) {
    errorMsg.textContent = "Please enter some text to summarize.";
    return;
  }

  summarizeBtn.disabled = true;
  loadingIndicator.classList.remove("hidden");
  resultSection.classList.add("hidden");
  summaryText.textContent = "";

  try {
    const response = await fetch("http://localhost:3000/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    summaryText.textContent = data.summary;
    resultSection.classList.remove("hidden");

  } catch (error) {
    errorMsg.textContent = `❌ Error: ${error.message}`;
  } finally {
    loadingIndicator.classList.add("hidden");
    summarizeBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", () => {
  if (!summaryText.textContent) return;

  navigator.clipboard.writeText(summaryText.textContent).then(() => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy Summary"), 1500);
  });
});