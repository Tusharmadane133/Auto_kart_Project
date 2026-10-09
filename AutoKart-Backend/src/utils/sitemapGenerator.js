// src/utils/sitemapGenerator.js
const getSitemap = async (db) => {
  const baseUrl = process.env.BASE_URL;
  const date = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  try {
    sitemap += `
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <lastmod>${date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Add dynamic sections if database is available
  if (db) {
    try {
      // Fetch sections
    const sections = await new Promise((resolve, reject) => {
      db.query('SELECT id, display_slug FROM sections', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    sections.forEach(section => {
      sitemap += `
  <url>
    <loc>${baseUrl}/section/${section.display_slug}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Fetch sub-sections
    const subSections = await new Promise((resolve, reject) => {
      db.query('SELECT id, display_slug FROM sub_sections', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    subSections.forEach(subSection => {
      sitemap += `
  <url>
    <loc>${baseUrl}/sub-section/${subSection.display_slug}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // Fetch products
    const products = await new Promise((resolve, reject) => {
      db.query('SELECT display_slug, updated_at FROM products ORDER BY updated_at DESC LIMIT 500', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

      products.forEach(product => {
        const lastmod = product.updated_at ? product.updated_at.toISOString().split('T')[0] : date;
        sitemap += `
  <url>
    <loc>${baseUrl}/product/${product.display_slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      });

    } catch (error) {
      console.error('Error generating dynamic sitemap:', error);
      // Continue with static sitemap if dynamic generation fails
    }
  }

  sitemap += `
</urlset>`;
  
  return sitemap;
  
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    throw error;
  }
};

module.exports = { getSitemap };