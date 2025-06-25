console.log("📄 content.js loaded");

// 🧼 Transcript cleaner
function cleanTranscript(text) {
  return text
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?]/g, "")
    .replace(/^.*?:\s*/gm, "")
    .replace(/(\.\s+)?Ineed/gi, ". I need")
    .replace(/(sponsored by|brought to you by).+?\./gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// 💤 Utility sleep
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// 📥 Tries to open "Show transcript" from description panel
async function openTranscriptPanel() {
  console.log("🧪 Trying to open transcript panel from description...");

  for (let attempt = 1; attempt <= 10; attempt++) {
    const transcriptButton = Array.from(document.querySelectorAll("tp-yt-paper-button, button, yt-formatted-string"))
      .find(el =>
        el.innerText?.toLowerCase().includes("transcrip") ||  // English
        el.innerText?.toLowerCase().includes("transcripción") || // Spanish
        el.innerText?.toLowerCase().includes("transcripcion") // No accent
      );

    if (transcriptButton) {
      transcriptButton.scrollIntoView({ behavior: "smooth" });
      transcriptButton.click();
      console.log("✅ Clicked transcript button in description");
      await sleep(1500);
      return true;
    }

    console.log(`⏳ Transcript button not found... attempt ${attempt}`);
    await sleep(1000);
  }

  console.warn("❌ Transcript button not found in description");
  return false;
}

// 📄 Extracts transcript from the DOM once panel is opened
async function getTranscriptTextFromDOM(retries = 30, delay = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const lines = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (lines.length > 0) {
      console.log(`✅ Found ${lines.length} transcript lines`);
      return Array.from(lines)
        .map(el => el.innerText.trim())
        .filter(Boolean)
        .join("\n\n");
    }

    console.log(`🔁 Waiting for transcript lines... attempt ${attempt}`);
    await sleep(delay);
  }

  console.warn("❌ Transcript content not found in time");
  return null;
}

// 📰 More robust article text extractor
function getReadableArticleText() {
  const blacklist = ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside', 'iframe'];
  const elements = [...document.body.querySelectorAll("p, span, div")];

  const visibleText = elements
    .filter(el => {
      const tag = el.tagName.toLowerCase();
      if (blacklist.includes(tag)) return false;
      const rect = el.getBoundingClientRect();
      return el.innerText.trim().length > 80 && rect.height > 0;
    })
    .map(el => el.innerText.trim())
    .filter(text => text.split(" ").length > 10)
    .join("\n\n");

  return visibleText.slice(0, 10000); // Max 10k chars
}

// 📩 Handles request from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageText") {
    (async () => {
      try {
        if (
          window.location.hostname.includes("youtube.com") &&
          window.location.pathname.startsWith("/watch")
        ) {
          const opened = await openTranscriptPanel();
          if (!opened) {
            sendResponse({ error: "Transcript panel could not be opened automatically." });
            return;
          }

          const transcript = await getTranscriptTextFromDOM();
          if (transcript && transcript.length > 50) {
            sendResponse({ text: cleanTranscript(transcript) });
          } else {
            sendResponse({ error: "Transcript not found in DOM." });
          }
        } else {
          const text = getReadableArticleText();
          if (text) {
            sendResponse({ text });
          } else {
            sendResponse({ error: "Could not extract article content." });
          }
        }
      } catch (err) {
        console.error("❌ content.js error:", err);
        sendResponse({ error: err.message });
      }
    })();

    return true; 
  }
});