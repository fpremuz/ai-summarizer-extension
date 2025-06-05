const resultDiv = document.getElementById("result");

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function fetchPageText() {
  const tab = await getCurrentTab();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: "getPageText" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response.text);
      }
    });
  });
}

async function summarizeWithBackend(text) {
  const response = await fetch("http://localhost:3000/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  const data = await response.json();
  return data.summary || "Failed to generate summary.";
}

async function summarize() {
  try {
    resultDiv.textContent = "Extracting page content...";
    const text = await fetchPageText();
    if (!text || text.length === 0) {
      resultDiv.textContent = "No text found on this page.";
      return;
    }

    resultDiv.textContent = "Summarizing with AI...";
    const summary = await summarizeWithBackend(text);

    resultDiv.textContent = summary;
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
  }
}

summarize();

function copySummary() {
  navigator.clipboard.writeText(resultDiv.textContent).then(() => {
    alert("Summary copied to clipboard!");
  });
}

window.copySummary = copySummary;
