const axios = require("axios");

const cache = {};

async function translateToMarathi(text) {
  if (!text) return "";

  if (cache[text]) return cache[text];

  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: "en",
          tl: "mr",
          dt: "t",
          q: text
        }
      }
    );

    const translated = res.data[0]
      .map(item => item[0])
      .join("");

    cache[text] = translated;

    return translated;

  } catch (err) {
    console.error("Translate error:", err.message);
    return text;
  }
}

module.exports = { translateToMarathi };