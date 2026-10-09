require("dotenv").config();

// Add at the top after dotenv config
if (!process.env.BASE_URL) {
  console.error('❌ BASE_URL is required in .env file');
  process.exit(1);
}

const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const cookieParser = require("cookie-parser");

const i18n = require("i18n");

const adminRoutes = require("./src/routes/admin");
const userRoutes = require("./src/routes/user.routes");

// ... other requires
const { 
  generateMetaTags,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateCollectionPageSchema,
  generateLocalBusinessSchema
} = require('./src/middleware/seoMiddleware');
const { getSitemap } = require('./src/utils/sitemapGenerator');
const { getImageSitemap } = require('./src/utils/imageSitemapGenerator');
const {
  compressionMiddleware,
  securityMiddleware,
  cacheMiddleware,
  preloadMiddleware,
  seoOptimizationMiddleware
} = require('./src/middleware/performanceMiddleware');

const app = express();
const PORT = 5000;



// admin sec 

/* =========================
   TRUST PROXY (IMPORTANT)
========================= */
app.set("trust proxy", 1);

/* =========================
   SESSION DATABASE (POOL)
========================= */
const sessionDB = mysql.createPool({
host: "localhost",
  user: "root",
  password: "",
  database: "autokart_db"
});
/* =========================
   SESSION STORE
========================= */

const sessionStore = new MySQLStore(
  {
    expiration: 1000 * 60 * 60 * 24 * 7,
    clearExpired: true,
    checkExpirationInterval: 900000,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data"
      }
    }
  },
  sessionDB
);


/* =========================
   SESSION MIDDLEWARE
========================= */

app.use(
  session({
    name: "_db_session",
    secret: process.env.SESSION_SECRET || "autokart-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false
    }
  })
);


/* =========================
   MIDDLEWARE
========================= */


app.use(cookieParser());

// Add performance optimization middleware
app.use(compressionMiddleware);
// app.use(securityMiddleware); // Disabled to fix CSP issues
app.use(cacheMiddleware);
app.use(preloadMiddleware);
app.use(seoOptimizationMiddleware);

// Add SEO middleware
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
 
// Sitemap route
app.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await getSitemap(req.db);
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error serving sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Image sitemap route
app.get('/image-sitemap.xml', async (req, res) => {
  try {
    const imageSitemap = await getImageSitemap(req.db);
    res.header('Content-Type', 'application/xml');
    res.send(imageSitemap);
  } catch (error) {
    console.error('Error serving image sitemap:', error);
    res.status(500).send('Error generating image sitemap');
  }
});

// Robots.txt route
app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL;
  const robotsTxt = `# Allow all web crawlers to access all parts of the site
User-agent: *
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/image-sitemap.xml

# Disallow crawling of admin and private areas
Disallow: /admin/
Disallow: /api/
Disallow: /private/

# Crawl-delay for all crawlers
Crawl-delay: 10

# Specific rules for major search engines
User-agent: Googlebot
Allow: /
Crawl-delay: 5

User-agent: Bingbot
Allow: /
Crawl-delay: 5

# Block image search from specific bots
User-agent: Googlebot-Image
Disallow: /assets/images/private/

# Block specific files
Disallow: /*.json$
Disallow: /*.xml$

# Allow all static files
Allow: /*.css$
Allow: /*.js$
Allow: /*.png$
Allow: /*.jpg$
Allow: /*.jpeg$
Allow: /*.gif$
Allow: /*.svg$
Allow: /*.webp$
`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

/* =========================
   I18N CONFIGURATION
========================= */

i18n.configure({
  locales: ["en", "mr"],
  directory: path.join(__dirname, "locales"),
  defaultLocale: "en",
  cookie: "lang",
  queryParameter: "lang",
  autoReload: true,
  syncFiles: true
});

app.use(i18n.init);

app.use((req, res, next) => {

  if (req.query.lang) {
    req.session.lang = req.query.lang;
  }

  if (req.session.lang) {
    req.setLocale(req.session.lang);
  }

  res.locals.__ = res.__;
  res.locals.currentLang = req.getLocale();

  next();
});


app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

app.use(express.static(path.join(__dirname, "../AutoKart-Frontend/public")));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../AutoKart-Frontend/public/uploads"))
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../AutoKart-Frontend/views"));







/* =========================
   MAIN DATABASE
========================= */

const db = mysql.createPool({
host: "localhost",
  user: "root",
  password: "",
  database: "autokart_db"
});
console.log("✅ MySQL Pool ready");
/* =========================
   MAKE DB AVAILABLE
========================= */

app.use((req, res, next) => {
  req.db = db;
  next();
});

/* =========================
   GLOBAL USER SESSION (EJS)
========================= */

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

/* =========================
   GLOBAL NAVBAR DATA
========================= */

app.use((req, res, next) => {
  const sectionQuery = `
    SELECT id, name, display_slug
    FROM sections
  `;

  const subSectionQuery = `
    SELECT id, name, section_id, display_slug
    FROM sub_sections
  `;

  req.db.query(sectionQuery, (err, sections) => {
    if (err) {
      console.error("Section query failed:", err);
      res.locals.sections = [];
      res.locals.subSectionsBySection = {};
      return next();
    }

    req.db.query(subSectionQuery, (err, subSections) => {
      if (err) {
        console.error("Sub-section query failed:", err);
        res.locals.sections = sections || [];
        res.locals.subSectionsBySection = {};
        return next();
      }

      const grouped = {};
      subSections.forEach(s => {
        if (!grouped[s.section_id]) grouped[s.section_id] = [];
        grouped[s.section_id].push(s);
      });

      res.locals.sections = sections;
      res.locals.subSectionsBySection = grouped;
      next();
    });
  });
});



app.use((req, res, next) => {
  res.locals.contact = {
    phone: "+91 9657418508",
    email: "autokartstore@gmail.com",
    whatsapp: "9657418508",
    address: "moshi,Pune"
  };
  
  // Make SEO functions available to all templates
  res.locals.generateMetaTags = generateMetaTags;
  res.locals.generateProductSchema = generateProductSchema;
  res.locals.generateBreadcrumbSchema = generateBreadcrumbSchema;
  res.locals.generateOrganizationSchema = generateOrganizationSchema;
  res.locals.generateWebSiteSchema = generateWebSiteSchema;
  res.locals.generateCollectionPageSchema = generateCollectionPageSchema;
  res.locals.generateLocalBusinessSchema = generateLocalBusinessSchema;
  
  next();
});

/* =========================
   ROUTES
========================= */

app.use("/", userRoutes);
app.use("/admin", adminRoutes);

/* =========================
   ERROR HANDLING
========================= */
// Test error route - remove this in production
app.get('/test-error', (req, res, next) => {
    const error = new Error('This is a test error');
    error.status = 500;
    next(error);
});
 
// Replace the existing error handler with this enhanced version
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err.stack || err);
  
  // If the response has already been sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }
 
  // Check if the request expects JSON
  if (req.accepts('json')) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
 
  // For HTML responses
  res.status(500).render('error', {
    title: 'Error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

/* =========================
   SERVER
========================= */

// console.log("EMAIL_USER:", process.env.EMAIL_USER);
// console.log("EMAIL_PASS:", process.env.EMAIL_PASS);

/* =========================
   SERVER
========================= */
// app.use((err, req, res, next) => {
//   console.error("🔥 GLOBAL ERROR:", err);
//   res.status(500).send("Internal Server Error");
// });

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AutoKart running on port ${PORT}`);
});