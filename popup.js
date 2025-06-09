const resultDiv = document.getElementById("result");
const copyButton = document.getElementById("copy-btn");

let loadingInterval;
let delayHintTimeout; // <-- added this

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
    showLoadingAnimation();

    // 🕒 Set a fallback message if it takes too long
    delayHintTimeout = setTimeout(() => {
      if (resultDiv.textContent.startsWith("🤖 Summarizing")) {
        resultDiv.textContent = "🕒 Still summarizing... This can take up to 30s the first time.";
      }
    }, 15000);

    const summary = await summarizeWithBackend(text);

    clearTimeout(delayHintTimeout); // 🧹 Cancel timeout if done early
    stopLoadingAnimation();

    resultDiv.textContent = summary;
    copyButton.style.display = "block";
  } catch (err) {
    clearTimeout(delayHintTimeout); // 🧹 Cancel on error too
    stopLoadingAnimation();
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