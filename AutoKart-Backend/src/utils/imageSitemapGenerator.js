/**
 * Image Sitemap Generator
 * Generates XML sitemap for product images with metadata
 */

const getImageSitemap = async (db) => {
  const baseUrl = process.env.BASE_URL;
  const date = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  try {
    // Fetch products with images
    const products = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          p.id,
          p.product_name,
          p.display_slug,
          p.image as main_image,
          p.product_description,
          p.updated_at,
          s.name as section_name,
          ss.name as sub_section_name
        FROM products p
        LEFT JOIN sections s ON p.section_id = s.id
        LEFT JOIN sub_sections ss ON p.sub_section_id = ss.id
        WHERE p.image IS NOT NULL AND p.image != ''
        ORDER BY p.updated_at DESC
        LIMIT 1000
      `;
      
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Fetch product gallery images
    const galleryImages = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          pi.image,
          p.product_name,
          p.display_slug,
          p.product_description,
          p.updated_at
        FROM product_images pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.image IS NOT NULL 
        AND pi.image != ''
        ORDER BY p.updated_at DESC
        LIMIT 2000
      `;
      
      db.query(query, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Generate sitemap entries for products with main images
    products.forEach(product => {
      const lastmod = product.updated_at ? product.updated_at.toISOString().split('T')[0] : date;
      const productUrl = `${baseUrl}/product/${product.display_slug}`;
      const imageUrl = `${baseUrl}/uploads/${product.main_image}`;
      
      // Create title and description for image
      const imageTitle = product.product_name;
      const imageCaption = product.product_description 
        ? product.product_description.substring(0, 160) + (product.product_description.length > 160 ? '...' : '')
        : `High-quality ${product.product_name} at AutoKart`;

      sitemap += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${imageTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</image:title>
      <image:caption>${imageCaption.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</image:caption>
      <image:geo_location>Pune, Maharashtra, India</image:geo_location>
      <image:license>https://autokart.com/license</image:license>
    </image:image>
  </url>`;
    });

    // Generate sitemap entries for gallery images
    galleryImages.forEach(galleryImage => {
      const lastmod = galleryImage.updated_at ? galleryImage.updated_at.toISOString().split('T')[0] : date;
      const productUrl = `${baseUrl}/product/${galleryImage.display_slug}`;
      const imageUrl = `${baseUrl}/uploads/${galleryImage.image}`;
      
      // Create title and description for gallery image
      const imageTitle = galleryImage.product_name;
      const imageCaption = galleryImage.product_description 
        ? galleryImage.product_description.substring(0, 160) + (galleryImage.product_description.length > 160 ? '...' : '')
        : `High-quality ${galleryImage.product_name} image gallery at AutoKart`;

      sitemap += `
  <url>
    <loc>${productUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${imageTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')} - Gallery Image</image:title>
      <image:caption>${imageCaption.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</image:caption>
      <image:geo_location>Pune, Maharashtra, India</image:geo_location>
      <image:license>https://autokart.com/license</image:license>
    </image:image>
  </url>`;
    });

    // Add banner images if they exist
    const bannerImages = [
      { name: 'Shop Banner', path: '/uploads/banners/shop-right-banner.jpg' },
      { name: 'Electronics Banner', path: '/uploads/banners/electronics-banner.png' },
      { name: 'AutoKart Logo', path: '/uploads/autokart_logo.jpeg' }
    ];

    bannerImages.forEach(banner => {
      sitemap += `
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <image:image>
      <image:loc>${baseUrl}${banner.path}</image:loc>
      <image:title>${banner.name} - AutoKart</image:title>
      <image:caption>AutoKart ${banner.name.toLowerCase()} - Your trusted auto parts store</image:caption>
      <image:geo_location>Pune, Maharashtra, India</image:geo_location>
      <image:license>https://autokart.com/license</image:license>
    </image:image>
  </url>`;
    });

  } catch (error) {
    console.error('Error generating image sitemap:', error);
    // Continue with basic structure if dynamic generation fails
  }

  sitemap += `
</urlset>`;

  return sitemap;
};

module.exports = { getImageSitemap };
