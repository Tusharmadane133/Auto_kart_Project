
// src/middleware/seoMiddleware.js
const { 
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateCollectionPageSchema,
  generateLocalBusinessSchema
} = require('../utils/structuredData');

const generateMetaTags = (meta = {}, hreflangUrls = [], structuredData = null) => {
  const defaultMeta = {
    title: 'AutoKart - Your Auto Parts Store',
    description: 'Find the best auto parts and accessories at AutoKart',
    keywords: 'auto parts, car accessories, auto shop, car parts online',
    image: `${process.env.BASE_URL }/images/og-image.jpg`,
    url: process.env.BASE_URL,
    type: 'website',
    siteName: 'AutoKart'
  };

  const finalMeta = { ...defaultMeta, ...meta };

  let hreflangTags = '';
  if (hreflangUrls && hreflangUrls.length > 0) {
    hreflangUrls.forEach(hreflang => {
      hreflangTags += `<link rel="alternate" hreflang="${hreflang.lang}" href="${hreflang.url}">\n`;
    });
  }

  // Generate structured data JSON-LD
  let structuredDataScript = '';
  if (structuredData) {
    structuredDataScript = `<script type="application/ld+json">${JSON.stringify(structuredData, null, 2)}</script>`;
  }

  return `
    <title>${finalMeta.title}</title>
    <meta name="description" content="${finalMeta.description}">
    <meta name="keywords" content="${finalMeta.keywords}">
    <meta property="og:type" content="${finalMeta.type}">
    <meta property="og:url" content="${finalMeta.url}">
    <meta property="og:title" content="${finalMeta.title}">
    <meta property="og:description" content="${finalMeta.description}">
    <meta property="og:image" content="${finalMeta.image}">
    <meta property="og:site_name" content="${finalMeta.siteName}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${finalMeta.title}">
    <meta name="twitter:description" content="${finalMeta.description}">
    <meta name="twitter:image" content="${finalMeta.image}">
    <link rel="canonical" href="${finalMeta.url}">
    ${hreflangTags}
    ${structuredDataScript}
  `;
};

module.exports = {
  generateMetaTags,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateCollectionPageSchema,
  generateLocalBusinessSchema
};