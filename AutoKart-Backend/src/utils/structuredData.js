/**
 * Schema.org Structured Data Generator
 * Generates JSON-LD structured data for Google
 */

const generateProductSchema = (data) => {
  if (!data) return null;

  const baseUrl = process.env.BASE_URL;

  return {
    "@context": "https://schema.org",
    "@type": "Product",

    "name": data.name,
    "image": [data.image],

    "description": data.description || data.name,

    "brand": {
      "@type": "Brand",
      "name": "AutoKart"
    },

    "sku": String(data.sku),
    "mpn": String(data.sku),

    "offers": {
      "@type": "Offer",
      "url": data.url,
      "priceCurrency": data.currency || "INR",
      "price": data.price,

      "priceValidUntil": new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0],

      "itemCondition": "https://schema.org/NewCondition",

      "availability":
        data.availability === "InStock"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",

      "seller": {
        "@type": "Organization",
        "name": "AutoKart",
        "url": baseUrl
      }
    }
  };
};
const generateBreadcrumbSchema = (breadcrumbs) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": (index + 1).toString(),
      "name": crumb.name,
      "item": crumb.url
    }))
  };
};

const generateOrganizationSchema = () => {
  const baseUrl = process.env.BASE_URL;
  
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "AutoKart",
    "url": baseUrl,
    "logo": `${baseUrl}/uploads/autokart_logo.jpeg`,
    "description": "Your trusted auto parts and accessories store",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Moshi, Pune",
      "addressLocality": "Pune",
      "addressRegion": "Maharashtra",
      "postalCode": "412105",
      "addressCountry": "IN"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-9657418508",
      "contactType": "customer service",
      "availableLanguage": ["English", "Hindi", "Marathi"]
    },
    "sameAs": [
      "https://www.facebook.com/autokart",
      "https://www.instagram.com/autokart",
      "https://www.twitter.com/autokart"
    ]
  };
};

const generateWebSiteSchema = () => {
  const baseUrl = process.env.BASE_URL;
  
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AutoKart",
    "url": baseUrl,
    "description": "Find the best auto parts and accessories at AutoKart",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
};

const generateCollectionPageSchema = (data) => {
  if (!data) return null;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": data.name,
    "url": data.url
  };

  const baseUrl = process.env.BASE_URL;
  
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": section.name,
    "description": section.description || `Browse ${section.name} products at AutoKart`,
    "url": `${baseUrl}/section/${section.display_slug}`,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": products.length,
      "itemListElement": products.slice(0, 10).map((product, index) => ({
        "@type": "Product",
        "position": (index + 1).toString(),
        "name": product.product_name,
        "url": `${baseUrl}/product/${product.display_slug}`,
        "image": `${baseUrl}/uploads/${product.image}`
      }))
    }
  };
};

const generateLocalBusinessSchema = () => {
  const baseUrl = process.env.BASE_URL;
  
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "AutoKart",
    "image": `${baseUrl}/uploads/autokart_logo.jpeg`,
    "url": baseUrl,
    "telephone": "+91-9657418508",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Moshi, Pune",
      "addressLocality": "Pune",
      "addressRegion": "Maharashtra",
      "postalCode": "412105",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "18.6298",
      "longitude": "73.7997"
    },
    "openingHours": [
      "Mo-Sa 09:00-20:00",
      "Su 10:00-18:00"
    ],
    "priceRange": "$$",
    "servesCuisine": "Auto Parts",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "reviewCount": "150"
    }
  };
};

module.exports = {
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateCollectionPageSchema,
  generateLocalBusinessSchema
};
