console.log("📄 content.js loaded");

function cleanTranscript(text) {
  return text
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?]/g, "") // Remove [00:01]
    .replace(/^.*?:\s*/gm, "")                  // Remove speaker names
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function getYouTubeTranscriptFromDOM() {
  const lines = document.querySelectorAll(
    "ytd-transcript-segment-renderer yt-formatted-string"
  );

  if (!lines || lines.length === 0) {
    console.warn("❌ Transcript lines not found in DOM");
    return null;
  }

  const transcript = Array.from(lines)
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join(" ");

  return cleanTranscript(transcript);
}

function getMainArticleText() {
  if (window.location.hostname.includes("wikipedia.org")) {
    const el = document.querySelector("#mw-content-text");
    if (el) return el.innerText.trim();
  }

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
    if (
      window.location.hostname.includes("youtube.com") &&
      window.location.pathname.startsWith("/watch")
    ) {
      const transcript = getYouTubeTranscriptFromDOM();
      if (transcript) {
        sendResponse({ text: transcript });
      } else {
        sendResponse({ error: "Transcript not found in DOM. Please open transcript panel on YouTube first." });
      }
    } else {
      const text = getMainArticleText();
      if (text) {
        sendResponse({ text });
      } else {
        sendResponse({ error: "Could not extract article content." });
      }
    }
    return true;
  }
});