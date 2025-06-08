const copyBtn = document.getElementById('copyBtn');
const outputDiv = document.getElementById('output');

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputDiv.innerText)
    .then(() => {
      copyBtn.innerText = 'Copied!';
      setTimeout(() => copyBtn.innerText = 'Copy Summary', 2000);
    })
    .catch(() => alert('Failed to copy'));
});

document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const inputText = document.getElementById('inputText').value.trim();
  const loadingDiv = document.getElementById('loading');

  if (!inputText) {
    alert('Please enter some text to summarize.');
    return;
  }

  outputDiv.classList.add('hidden');
  copyBtn.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    const response = await fetch('https://ai-summarizer-extension.onrender.com/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: inputText }),
    });

    const data = await response.json();

    outputDiv.innerText = data.summary || 'No summary returned.';
    outputDiv.classList.remove('hidden');
    copyBtn.classList.remove('hidden');
  } catch (error) {
    outputDiv.innerText = 'An error occurred. Please try again.';
    outputDiv.classList.remove('hidden');
    console.error(error);
  }

  loadingDiv.classList.add('hidden');
});