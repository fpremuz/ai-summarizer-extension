const resultDiv = document.getElementById("result");
const copyButton = document.getElementById("copy-btn");

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchPageText() {
  const tab = await getCurrentTab();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: "getPageText" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response.text);
      }
    });
  });
}

async function summarizeWithBackend(text) {
  const response = await fetch("https://ai-summarizer-extension.onrender.com/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error("Server error: " + errorData);
  }

  const data = await response.json();
  return data.summary || "No summary generated.";
}

async function summarize() {
  try {
    resultDiv.textContent = "⏳ Extracting page content...";
    const text = await fetchPageText();

    if (!text || text.trim().length === 0) {
      resultDiv.textContent = "⚠️ No readable text found on this page.";
      return;
    }

    resultDiv.textContent = "🤖 Summarizing with AI...";
    const summary = await summarizeWithBackend(text);

    resultDiv.textContent = summary;
    copyButton.style.display = "block";
  } catch (err) {
    console.error(err);
    resultDiv.textContent = "❌ Error: " + err.message;
  }
}

function copySummary() {
  navigator.clipboard.writeText(resultDiv.textContent).then(() => {
    alert("✅ Summary copied to clipboard!");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  summarize();
  copyButton.addEventListener("click", copySummary);
});