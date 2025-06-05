function getPageText() {
  const article = document.querySelector("article");
  if (article) return article.innerText;

  return document.body.innerText.slice(0, 10000); 
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageText") {
    const text = getPageText();
    sendResponse({ text });
  }
  return true; 
});