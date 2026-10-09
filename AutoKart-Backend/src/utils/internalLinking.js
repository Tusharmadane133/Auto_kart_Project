/**
 * Internal Linking Helper
 * Generates SEO-optimized internal links
 */

const generateRelatedProducts = async (db, productId, limit = 5) => {
  try {
    const query = `
      SELECT p.id, p.product_name, p.display_slug, p.image, p.price, p.section_id, p.sub_section_id
      FROM products p
      WHERE p.id != ? 
      AND (p.section_id = (SELECT section_id FROM products WHERE id = ?) 
           OR p.sub_section_id = (SELECT sub_section_id FROM products WHERE id = ?))
      ORDER BY RAND()
      LIMIT ?
    `;
    
    return await new Promise((resolve, reject) => {
      db.query(query, [productId, productId, productId, limit], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  } catch (error) {
    console.error('Error generating related products:', error);
    return [];
  }
};

const generateCrossSellProducts = async (db, sectionId, limit = 4) => {
  try {
    const query = `
      SELECT p.id, p.product_name, p.display_slug, p.image, p.price
      FROM products p
      WHERE p.section_id != ? 
      AND p.in_stock = 1
      ORDER BY RAND()
      LIMIT ?
    `;
    
    return await new Promise((resolve, reject) => {
      db.query(query, [sectionId, limit], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  } catch (error) {
    console.error('Error generating cross-sell products:', error);
    return [];
  }
};

const generateCategoryLinks = async (db, limit = 10) => {
  try {
    const query = `
      SELECT DISTINCT s.id, s.name, s.display_slug, COUNT(p.id) as product_count
      FROM sections s
      LEFT JOIN products p ON s.id = p.section_id
      WHERE s.is_active = 1
      GROUP BY s.id, s.name, s.display_slug
      ORDER BY product_count DESC
      LIMIT ?
    `;
    
    return await new Promise((resolve, reject) => {
      db.query(query, [limit], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  } catch (error) {
    console.error('Error generating category links:', error);
    return [];
  }
};

const generateBreadcrumbs = (path, product = null, section = null, subSection = null) => {
  const baseUrl = process.env.BASE_URL;
  const breadcrumbs = [
    { name: 'Home', url: baseUrl }
  ];
  
  if (section) {
    breadcrumbs.push({
      name: section.name,
      url: `${baseUrl}/section/${section.display_slug}`
    });
  }
  
  if (subSection) {
    breadcrumbs.push({
      name: subSection.name,
      url: `${baseUrl}/sub-section/${subSection.display_slug}`
    });
  }
  
  if (product) {
    breadcrumbs.push({
      name: product.product_name,
      url: `${baseUrl}/product/${product.display_slug}`
    });
  }
  
  return breadcrumbs;
};

const generateSEOText = (type, data) => {
  const templates = {
    product: {
      title: `Buy ${data.product_name} Online | AutoKart`,
      description: `Shop ${data.product_name} at best price. High-quality ${data.product_name} with warranty. Fast delivery across India.`,
      keywords: `${data.product_name}, buy ${data.product_name}, ${data.product_name} price, auto parts, car accessories`
    },
    category: {
      title: `${data.name} - Buy ${data.name} Online | AutoKart`,
      description: `Browse wide range of ${data.name} at AutoKart. Best prices, genuine products, fast delivery. Shop ${data.name} online.`,
      keywords: `${data.name}, buy ${data.name}, ${data.name} online, auto parts, car accessories`
    },
    homepage: {
      title: 'AutoKart - Best Auto Parts & Car Accessories Online Store',
      description: 'AutoKart is your trusted online store for auto parts and car accessories. Wide range, best prices, genuine products, fast delivery across India.',
      keywords: 'auto parts, car accessories, online auto parts store, car parts online, buy auto parts'
    }
  };
  
  return templates[type] || templates.homepage;
};

module.exports = {
  generateRelatedProducts,
  generateCrossSellProducts,
  generateCategoryLinks,
  generateBreadcrumbs,
  generateSEOText
};
