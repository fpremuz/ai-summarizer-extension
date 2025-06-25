console.log("📄 content.js loaded");

function cleanTranscript(text) {
  return text
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?]/g, "")
    .replace(/^.*?:\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function openTranscriptPanel() {
  console.log("🧪 Trying to open transcript panel from description...");

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let attempt = 1; attempt <= 10; attempt++) {
    const transcriptButton = Array.from(document.querySelectorAll("tp-yt-paper-button, button, yt-formatted-string"))
      .find((el) =>
        el.innerText?.toLowerCase().includes("transcrip") ||  // "Transcript" (English)
        el.innerText?.toLowerCase().includes("transcripción") || // "Transcripción" (Spanish)
        el.innerText?.toLowerCase().includes("transcripcion") // Without accent
      );

    if (transcriptButton) {
      transcriptButton.scrollIntoView({ behavior: "smooth" });
      transcriptButton.click();
      console.log("✅ Clicked transcript button in description");
      await wait(1500);
      return true;
    }

    console.log(`⏳ Transcript button not found... attempt ${attempt}`);
    await wait(1000);
  }

  console.warn("❌ Transcript button not found in description");
  return false;
}

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

function getMainArticleText() {
  const articleTags = document.querySelectorAll("article, main, body");
  for (const tag of articleTags) {
    const text = tag.innerText;
    if (text && text.split(" ").length > 100) {
      return text.trim();
    }
  }

  console.warn("No article-like content found.");
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageText") {
    (async () => {
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
        const text = getMainArticleText();
        if (text) {
          sendResponse({ text });
        } else {
          sendResponse({ error: "Could not extract article content." });
        }
      }
    })();

    return true; // keep the message channel open for async response
  }
});