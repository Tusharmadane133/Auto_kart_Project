async function translateText(text) {
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=" 
      + encodeURIComponent(text)
    );

    const data = await res.json();
    return data[0][0][0];
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

async function translatePage() {

  const currentLang = document.documentElement.lang;
  if (currentLang !== "mr") return;

  const container = document.querySelector(".auto-area");
  if (!container) return;

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;

  while (node = walker.nextNode()) {

    const text = node.nodeValue.trim();

    if (!text) continue;

    const translated = await translateText(text);
    node.nodeValue = translated;
  }
}

document.addEventListener("DOMContentLoaded", translatePage);