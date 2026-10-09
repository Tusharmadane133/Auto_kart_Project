/**
 * Performance Optimization Middleware
 * Improves page speed and Core Web Vitals
 */

const compression = require('compression');

// Compression middleware
const compressionMiddleware = compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

// Security headers with performance optimization (disabled)
const securityMiddleware = (req, res, next) => {
  next(); // Pass through without security headers
};

// Cache control middleware
const cacheMiddleware = (req, res, next) => {
  const cacheTime = process.env.NODE_ENV === 'production' ? '1y' : '1h';
  
  // Set cache headers for static assets
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', `public, max-age=${process.env.NODE_ENV === 'production' ? '31536000' : '3600'}`);
    res.setHeader('Expires', new Date(Date.now() + (process.env.NODE_ENV === 'production' ? 31536000000 : 3600000)).toUTCString());
  }
  
  // Set cache headers for API responses
  if (req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Preload critical resources
const preloadMiddleware = (req, res, next) => {
  const preloads = [];
  
  // Preload critical CSS (only existing files)
  preloads.push('</css/navbar.css>; as=style; rel=preload');
  
  // Preload critical JavaScript (only existing files)
  preloads.push('</js/autoTranslate.js>; as=script; rel=preload');
  
  // Preload critical images
  preloads.push('</uploads/autokart_logo.jpeg>; as=image; rel=preload');
  
  if (preloads.length > 0) {
    res.setHeader('Link', preloads.join(', '));
  }
  
  next();
};

// Remove SEO Monitor (not needed for rankings)
const seoOptimizationMiddleware = (req, res, next) => {
  // Add performance hints
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add DNS prefetch for external resources
  const dnsPrefetch = [
    '//fonts.googleapis.com',
    '//fonts.gstatic.com',
    '//www.google-analytics.com'
  ];
  
  if (dnsPrefetch.length > 0) {
    res.setHeader('X-DNS-Prefetch-Control', 'on');
  }
  
  next();
};

module.exports = {
  compressionMiddleware,
  securityMiddleware,
  cacheMiddleware,
  preloadMiddleware,
  seoOptimizationMiddleware
};
