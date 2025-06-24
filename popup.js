console.log("🔋 popup.js loaded!");

const resultDiv = document.getElementById("result");
const copyButton = document.getElementById("copy-btn");

let loadingInterval;
let delayHintTimeout;

document.addEventListener("DOMContentLoaded", () => {
  summarizeCurrentPage();
  copyButton.addEventListener("click", copySummary);
});

function showLoadingAnimation() {
  let dots = 1;
  loadingInterval = setInterval(() => {
    resultDiv.textContent = "🤖 Summarizing" + ".".repeat(dots);
    dots = (dots % 3) + 1;
  }, 500);
}

function stopLoadingAnimation() {
  clearInterval(loadingInterval);
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function summarizeCurrentPage() {
  try {
    const tab = await getCurrentTab();
    console.log("📺 Tab URL:", tab.url);

    resultDiv.textContent = "⏳ Getting page content...";
    showLoadingAnimation();

    const text = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "getPageText" }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!resp || resp.error) {
          reject(new Error(resp?.error || "No content returned"));
        } else {
          resolve(resp.text || resp.transcript);
        }
      });
    });

    if (!text || text.trim().length === 0) {
      throw new Error("No readable text found.");
    }

    resultDiv.textContent = "🤖 Summarizing with AI...";
    delayHintTimeout = setTimeout(() => {
      if (resultDiv.textContent.startsWith("🤖")) {
        resultDiv.textContent = "🕒 Still summarizing... This can take up to 30s.";
      }
    }, 15000);

    const summaryResult = await summarizeWithBackend(text);
    clearTimeout(delayHintTimeout);
    stopLoadingAnimation();

    resultDiv.textContent = summaryResult.summary;

    if (summaryResult.wasTrimmed) {
      resultDiv.textContent += "\n\n⚠️ Note: Long content was trimmed for free summarization.";
    }

    copyButton.style.display = "inline-block";
  } catch (err) {
    clearTimeout(delayHintTimeout);
    stopLoadingAnimation();
    console.error("❌ ERROR:", err);
    resultDiv.textContent = "❌ Error: " + err.message;
  }
}

function copySummary() {
  navigator.clipboard.writeText(resultDiv.textContent).then(() => {
    alert("✅ Summary copied to clipboard!");
  });
}

async function summarizeWithBackend(text) {
  const MAX_LENGTH = 4000;
  const wasTrimmed = text.length > MAX_LENGTH;
  const trimmedText = text.slice(0, MAX_LENGTH);
  const tokenCount = Math.round(trimmedText.length / 4);
  console.log(`🧠 Estimated tokens: ${tokenCount}`);
  resultDiv.textContent += `\n🧮 Estimated input tokens: ${tokenCount}`;

  const response = await fetch("https://ai-summarizer-extension.onrender.com/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmedText }),
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const fallbackText = await response.text();
    throw new Error("Server error: " + (fallbackText.includes("Payload Too Large")
      ? "Content is too long to summarize."
      : "Unexpected server response."));
  }

  if (!response.ok) {
    const fallback = await response.text();
    throw new Error("Server error: " + (fallback.includes("Payload Too Large")
      ? "Input too long. Try summarizing a shorter page."
      : fallback));
  }

  return {
    summary: data.summary || "No summary generated.",
    wasTrimmed
  };
}