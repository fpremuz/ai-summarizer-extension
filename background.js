// background.js
console.log("🔋 background.js service worker loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "alive" });
  }
  return true; 
});