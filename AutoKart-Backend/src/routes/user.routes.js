const express = require("express");
const router = express.Router();
const generateInvoicePDF = require("../utils/invoice");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcrypt");   // ✅ ADD THIS
// const auth = require("../controllers/auth.controller");

// Import SEO functions
const { 
  generateWebSiteSchema,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateCollectionPageSchema,
  generateLocalBusinessSchema
} = require("../utils/structuredData");

const authController = require("../controllers/auth.controller");
const { sendOrderPlacedEmail } = require("../utils/sendMail");
const BlogController = require("../controllers/blog.controller");
const uploadReviewImage = require("../middleware/reviewUpload");
const reviewController = require("../controllers/review.controller");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



/* =========================
   MULTER CONFIG (CAREER)
========================= */

// Use a runtime-safe folder (outside deployed code)
const uploadBaseDir = path.join(process.cwd(), "runtime_uploads", "resumes");

// Create folder automatically if not exists
if (!fs.existsSync(uploadBaseDir)) {
  fs.mkdirSync(uploadBaseDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadBaseDir);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  }
});


const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".pdf", ".doc", ".docx"].includes(ext)) {
      return cb(new Error("Only PDF/DOC/DOCX allowed"));
    }
    cb(null, true);
  }
});


// 🌍 LANGUAGE HANDLER
router.get("/set-language/:lang", (req, res) => {

  const lang = req.params.lang;

  if (["en", "mr"].includes(lang)) {
    req.session.lang = lang;
  }

  res.redirect(req.header("Referer") || "/");
});
/* =========================
   GLOBAL HEADER DATA
========================= */

router.use((req, res, next) => {

  const sectionQuery = `
    SELECT id, name, name_mr, display_slug
    FROM sections
  `;

  const subSectionQuery = `
    SELECT id, name, name_mr, section_id, display_slug
    FROM sub_sections
  `;

  req.db.query(sectionQuery, (err, sections) => {
    if (err) {
      console.error("SECTIONS ERROR:", err);
      return next();
    }

    req.db.query(subSectionQuery, (err, subSections) => {
      if (err) {
        console.error("SUB SECTIONS ERROR:", err);
        return next();
      }

      const subSectionsBySection = {};
      subSections.forEach(s => {
        if (!subSectionsBySection[s.section_id]) {
          subSectionsBySection[s.section_id] = [];
        }
        subSectionsBySection[s.section_id].push(s);
      });

      // 🔥 VERY IMPORTANT
      res.locals.sections = sections;
      res.locals.subSectionsBySection = subSectionsBySection;

      next();
    });
  });

});




/* =========================
   AUTO LOGIN VIA REMEMBER TOKEN
========================= */
router.use((req, res, next) => {

  if (req.session.user) {
    return next();
  }

  const token = req.cookies.remember_token;

  if (!token) {
    return next();
  }

  req.db.query(
    `
    SELECT rt.user_id, u.user_email,u.user_first_name
    FROM user_remember_tokens rt
    JOIN user_create_account u
      ON u.user_id = rt.user_id
    WHERE rt.token = ?
      AND rt.expires_at > NOW()
    LIMIT 1
    `,
    [token],
    (err, rows) => {

      if (err || rows.length === 0) {
        res.clearCookie("remember_token");
        return next();
      }

      // ✅ Recreate session
      req.session.user = {
        user_id: rows[0].user_id,
        user_email: rows[0].user_email,
          user_first_name: rows[0].user_first_name   // 🔥 ADD THIS
      };

      console.log("");

      next();
    }
  );
});
/* =========================
   FAVICON
========================= */
router.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No content response for favicon
});

/* =========================
   USER ROUTES
========================= */

/* HOME */
router.get("/", (req, res) => {

  const sectionQuery = `
    SELECT id, name, name_mr, display_slug
    FROM sections
  `;

  const subSectionQuery = `
    SELECT id, name, name_mr, section_id, display_slug
    FROM sub_sections
  `;

  const productQuery = `
    SELECT * FROM products 
    WHERE is_active = 1
  `;

  const sliderQuery = `
    SELECT * FROM sliders 
    WHERE status = 'active'
  `;

  const shopSliderQuery = `
  SELECT * FROM shop_sliders
  ORDER BY id DESC
`;


  // 🔥 NEW: Homepage Video Query
  const videoQuery = `
  SELECT * FROM homepage_media
  WHERE type = 'video'
  AND is_active = 1
  LIMIT 1
`;
const topSellingQuery = `
  SELECT *
  FROM top_selling_sliders
  ORDER BY id DESC
  LIMIT 1
`;



  req.db.query(sectionQuery, (err, sections) => {
    if (err) {
      console.error("SECTIONS ERROR", err);
      return res.status(500).send(err.message);
    }

    req.db.query(subSectionQuery, (err, subSections) => {
      if (err) {
        console.error("SUB SECTIONS ERROR:", err);
        return res.status(500).send(err.message);
      }

      req.db.query(productQuery, (err, products) => {
        if (err) return res.send("Error loading products");

        req.db.query(sliderQuery, (err, sliders) => {
          if (err) return res.send("Error loading sliders");

          // 🔥 FETCH VIDEO
          req.db.query(videoQuery, (err, videoRows) => {

            let homepageVideo = null;

            if (!err && videoRows.length > 0) {
              homepageVideo = videoRows[0];
            }

            // GROUP PRODUCTS
            const productsBySection = {};
            products.forEach(p => {
              if (!productsBySection[p.section_id]) {
                productsBySection[p.section_id] = [];
              }
              productsBySection[p.section_id].push(p);
            });

            // GROUP SUBSECTIONS
            const subSectionsBySection = {};
            subSections.forEach(s => {
              if (!subSectionsBySection[s.section_id]) {
                subSectionsBySection[s.section_id] = [];
              }
              subSectionsBySection[s.section_id].push(s);
            });

            // 🔥 PASS homepageVideo TO EJS
           req.db.query(shopSliderQuery, (err, shopSliders) => {

req.db.query(topSellingQuery, (err, rows) => {

  if (err) {
    console.error("MIDDLE BANNER ERROR:", err);
    rows = [];
  }

  const middleBanner = rows[0] || null;   // ✅ DEFINE IT HERE

  // SEO Meta Data for Homepage
  const baseUrl = process.env.BASE_URL;
  const meta = {
    title: 'AutoKart - Best Auto Parts & Car Accessories Online Store',
    description: 'AutoKart is your trusted online store for auto parts and car accessories. Wide range, best prices, genuine products, fast delivery across India.',
    keywords: 'auto parts, car accessories, online auto parts store, car parts online, buy auto parts',
    image: `${baseUrl}/uploads/autokart_logo.jpeg`,
    url: baseUrl,
    type: 'website'
  };

  const hreflangUrls = [
    { lang: 'en', url: baseUrl },
    { lang: 'mr', url: `${baseUrl}?lang=mr` }
  ];

  // Structured Data for Homepage
  const structuredData = generateWebSiteSchema();

  res.render("user/home", {
    sections,
    productsBySection,
    subSectionsBySection,
    sliders,
    homepageVideo,
    shopSliders: shopSliders || [],
    middleBanner,                     // ✅ PASS ONLY THIS
    meta,                            // ✅ ADD META
    hreflangUrls,                     // ✅ ADD HREFLANG
    structuredData                     // ✅ ADD STRUCTURED DATA
  });

});

});



          });

        });
      });
    });
  });

});
/* =========================
   REGISTER PAGE
========================= */
/* =========================
   REGISTER PAGE
========================= */
router.get("/register", (req, res) => {
  res.render("user/Login/register", {
    success: false,
    fieldError: {},
    old: {},
    error: null
  });
});


/* =========================
   REGISTER (SAVE USER)
========================= */
router.post("/register", (req, res) => {

  const {
    user_first_name,
    user_last_name,
    user_mobile,
    user_email,
    user_password
  } = req.body;

  // 🔒 Basic validation
  if (
    !user_first_name ||
    !user_last_name ||
    !user_mobile ||
    !user_email ||
    !user_password
  ) {
    return res.render("user/Login/register", {
      success: false,
      error: "All fields are required",
      fieldError: {},
      old: req.body
    });
  }

  // 🔍 DUPLICATE CHECK
  const checkSql = `
    SELECT * FROM user_create_account
    WHERE user_email = ?
    OR user_mobile = ?
  `;

  req.db.query(
    checkSql,
    [user_email, user_mobile],
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.render("user/Login/register", {
          success: false,
          error: "Server Error",
          fieldError: {},
          old: req.body
        });
      }

      if (rows.length > 0) {

        let fieldError = {};

        rows.forEach(user => {
          if (user.user_mobile === user_mobile) {
            fieldError.user_mobile = "Mobile already registered.";
          }
          if (user.user_email === user_email) {
            fieldError.user_email = "Email already registered.";
          }
        });

        return res.render("user/Login/register", {
          success: false,
          fieldError,
          old: req.body,
          error: null
        });
      }

      // ✅ HASH PASSWORD AND INSERT USER
      bcrypt.hash(user_password, 10, (err, hashedPassword) => {
        if (err) {
          console.error("PASSWORD HASH ERROR:", err);
          return res.render("user/Login/register", {
            success: false,
            error: "Registration failed",
            fieldError: {},
            old: req.body
          });
        }

        const insertSql = `
          INSERT INTO user_create_account
          (
            user_first_name,
            user_last_name,
            user_mobile,
            user_email,
            user_password
          )
          VALUES (?, ?, ?, ?, ?)
        `;

        req.db.query(
          insertSql,
          [
            user_first_name,
            user_last_name,
            user_mobile,
            user_email,
            hashedPassword
          ],
          (err, result) => {

            if (err) {
              console.error("REGISTER ERROR:", err);

              return res.render("user/Login/register", {
                success: false,
                error: "Registration failed",
                fieldError: {},
                old: req.body
              });
            }

            // 🔥 ACCOUNT CREATED → REDIRECT TO LOGIN WITH SUCCESS
            return res.render("user/Login/customer_login", { 
              fieldError: {}, 
              success: "Account created successfully! Please login.",
              error: null
            });

          }
        );
      });

    }
  );

});








/* =========================
   LOGIN (USER)
========================= */
router.get("/customer_login", (req, res) => {
  res.render("user/Login/customer_login", { 
    fieldError: {}, 
    success: req.query.success || null,
    error: null,
    returnTo: req.query.returnTo || ""
  });
});

// 🔥 Save previous page before login
router.use((req, res, next) => {

  const ignoreRoutes = [
    "/customer_login",
    "/cart-count",
    "/api",
    "/search"
  ];

  const shouldIgnore = ignoreRoutes.some(route =>
    req.path.startsWith(route)
  );

  if (
    req.method === "GET" &&
    !req.session.user &&
    !shouldIgnore
  ) {
    req.session.returnTo = req.originalUrl;
  }

  next();
});
/* =========================
   LOGIN (USER)
========================= */
/* =========================
   LOGIN (USER)
========================= */
router.post("/customer_login", (req, res) => {

  const { user_email, user_password, remember_me } = req.body;

  const sql = `
    SELECT *
    FROM user_create_account
    WHERE user_email = ?
    LIMIT 1
  `;

  req.db.query(sql, [user_email], (err, results) => {

    if (err) {
      return res.render("user/Login/customer_login", {
        fieldError: { user_email: "Server Error" },
        success: null,
        error: null
      });
    }

    if (results.length === 0) {
      return res.render("user/Login/customer_login", {
        fieldError: { user_email: "Email not registered" },
        success: null,
        error: null
      });
    }

    const user = results[0];

    bcrypt.compare(user_password, user.user_password, (err, passwordMatch) => {

      if (err) {
        return res.render("user/Login/customer_login", {
          fieldError: { user_password: "Server Error" },
          success: null,
          error: null
        });
      }

      if (!passwordMatch) {
        return res.render("user/Login/customer_login", {
          fieldError: { user_password: "Incorrect password" },
          success: null,
          error: null
        });
      }

      // ✅ LOGIN SUCCESS
      req.session.user = {
        user_id: user.user_id,
        user_email: user.user_email,
        user_first_name: user.user_first_name   // 🔥 ADD THIS LINE
      };

      // =========================
      // REMEMBER ME
      // =========================
      if (remember_me === "1" || remember_me === "on") {

        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;

        const token = crypto.randomBytes(64).toString("hex");
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        req.db.query(
          "DELETE FROM user_remember_tokens WHERE user_id = ?",
          [user.user_id],
          () => {
            req.db.query(
              "INSERT INTO user_remember_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
              [user.user_id, token, expiry]
            );
          }
        );

        res.cookie("remember_token", token, {
          httpOnly: true,
          expires: expiry,
          sameSite: "lax"
        });

      } else {
        req.session.cookie.expires = false;
      }

      req.session.save(() => {

        const redirectUrl =
          req.session.returnTo &&
          req.session.returnTo !== "/customer_login"
            ? req.session.returnTo
            : "/";

        delete req.session.returnTo;

        return res.redirect(redirectUrl);

      });

    });

  });

});



/* =========================
   LOGOUT
========================= */
router.get("/logout", (req, res) => {

  if (req.cookies.remember_token) {
    req.db.query(
      "DELETE FROM user_remember_tokens WHERE token = ?",
      [req.cookies.remember_token]
    );
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
    }

    res.clearCookie("remember_token");
    res.redirect("/customer_login");
  });

});



/* =========================
   MY PROFILE
========================= */
router.get("/my_profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const email = req.session.user.user_email;

  req.db.query(
    "SELECT * FROM user_create_account WHERE user_email = ?",
    [email],
    (err, result) => {
      if (err) return res.send("Database error");
      if (result.length === 0) return res.send("User not found");

      res.render("user/Login/my_profile", {
        user: result[0]
      });
    }
  );
});
router.get("/test-session-write", (req, res) => {
  req.session.test = "hello";
  res.send("session written");
});


/* =========================
   ORDERS PAGE (NO LOGIN BARRIER)
========================= */
router.get("/orders", (req, res) => {
  /* =========================
     AUTH CHECK
  ========================= */
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  console.log("📦 FETCHING ORDERS FOR USER:", userId);

  /* =========================
     FETCH USER ORDERS + ITEMS
     (Added product_id for review system)
  ========================= */
  const ordersSql = `
   SELECT
  o.order_id,
  o.created_at,
  o.order_status,
  o.total_amount,
  o.total_items,
  oi.product_id,   -- ✅ ADD THIS
  oi.product_name,
  oi.product_image,
  oi.quantity,
  oi.price
    FROM orders o
    INNER JOIN order_items oi
      ON oi.order_id = o.order_id

    WHERE o.user_id = ?
    ORDER BY o.updated_at DESC
  `;

  req.db.query(ordersSql, [userId], (err, orders) => {
    if (err) {
      console.error("❌ ORDERS FETCH ERROR:", err);
      return res.status(500).send("Error loading orders");
    }

    console.log("✅ ORDERS FOUND:", orders.length);

    /* =========================
       RENDER ORDERS PAGE
    ========================= */
    res.render("user/Login/orders", {
      orders
    });
  });
});

/* =========================
   ORDER DETAILS PAGE
========================= */
router.get("/orders/:orderId", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const orderId = req.params.orderId;

  /* 1️⃣ Fetch order header */
  const orderSql = `
  SELECT
    o.*,
    a.full_name,
    a.mobile,
    a.address_line,
    a.landmark,
    a.city,
    a.state,
    a.pincode,
    a.address_type
  FROM orders o
 LEFT JOIN user_addresses a ON o.address_id = a.address_id

  WHERE o.order_id = ?
    AND o.user_id = ?
  LIMIT 1
`;


  req.db.query(orderSql, [orderId, userId], (err, orderRows) => {
    if (err || orderRows.length === 0) {
      return res.send("Order not found");
    }

    const order = orderRows[0];

    /* 2️⃣ Fetch order items */
    const itemsSql = `
      SELECT
        product_name,
        product_image,
        price,
        quantity
      FROM order_items
      WHERE order_id = ?
    `;

    req.db.query(itemsSql, [orderId], (err, items) => {
      if (err || items.length === 0) {
        return res.send("No items found for this order");
      }

      /* 3️⃣ Calculate total safely */
      let totalAmount = 0;
      items.forEach(i => {
        totalAmount += i.price * i.quantity;
      });

      res.render("user/Login/order_details", {
        order,
        items,
        totalAmount
      });
    });
  });
});

/* =========================
   DOWNLOAD INVOICE
========================= */
router.get("/orders/:orderId/invoice", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const orderId = req.params.orderId;

  /* 1️⃣ Fetch order */
  const orderSql = `
    SELECT
      o.order_id,
      o.created_at,
      o.payment_method,
      o.razorpay_payment_id, 
      a.full_name,
      a.mobile,
      a.address_type,
      a.address_line,
      a.city,
      a.state,
      a.pincode
    FROM orders o
    JOIN user_addresses a
      ON o.address_id = a.address_id
    WHERE o.order_id = ?
      AND o.user_id = ?
    LIMIT 1
  `;

  req.db.query(orderSql, [orderId, userId], (err, orderRows) => {
    if (err || orderRows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const order = orderRows[0];

    /* 2️⃣ Fetch order items */
    const itemsSql = `
      SELECT
        product_name,
        price,
        quantity
      FROM order_items
      WHERE order_id = ?
        AND user_id = ?
    `;

    req.db.query(itemsSql, [orderId, userId], (err, items) => {
      if (err || items.length === 0) {
        return res.status(404).send("No items found");
      }

      /* 3️⃣ Calculate total */
      let totalAmount = 0;
      items.forEach(i => {
        totalAmount += Number(i.price) * Number(i.quantity);
      });

      /* 4️⃣ Generate PDF */
      generateInvoicePDF(res, order, items, totalAmount);
    });
  });
});

/* =========================
  CAREERS PAGE
========================= */
router.get("/careers", (req, res) => {
  res.render("user/careers");
});

router.get("/career-success", (req, res) => {
  res.render("user/careers-success");
});


/* =========================
   CAREERS APPLY FORM
========================= */
router.post("/careers/apply", (req, res) => {

  console.log("➡️ CAREER APPLY REQUEST RECEIVED");

  upload.single("resume")(req, res, async function (err) {

    /* =========================
       HANDLE MULTER ERROR
    ========================== */
    if (err) {
  console.error("❌ MULTER FULL ERROR:", err);
  return res.status(500).send("UPLOAD ERROR → " + err.message);
}


    try {
      const { name, email, mobile, position, cover_letter } = req.body;
      const resume = req.file ? req.file.filename : null;

      console.log("📄 BODY:", req.body);
      console.log("📎 FILE:", req.file);

      /* =========================
         SAVE TO DATABASE
      ========================== */
      const sql = `
        INSERT INTO career_applications
        (name, email, mobile, position, cover_letter, resume)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await req.db.promise().query(sql, [
        name,
        email,
        mobile,
        position,
        cover_letter || null,
        resume
      ]);

      console.log("✅ CAREER DATA SAVED");

      /* =========================
         SEND MAIL (NON-BLOCKING)
      ========================== */
      try {
        let attachments = [];

        if (resume) {
          const resumePath = path.join(uploadBaseDir, resume);
          attachments.push({
            filename: resume,
            path: resumePath
          });
        }

        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: "New Career Application – AutoKart",
          html: `
            <h2>🚀 New Career Application Received</h2>
            <hr/>
            <p><b>Name:</b> ${name}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Mobile:</b> ${mobile}</p>
            <p><b>Position:</b> ${position}</p>
            <p><b>Cover Letter:</b></p>
            <p>${cover_letter || "N/A"}</p>
          `,
          attachments
        });

        console.log("✅ MAIL SENT");
      } catch (mailErr) {
        // IMPORTANT: Do NOT crash if mail fails
        console.error("⚠️ MAIL FAILED (ignored):", mailErr.message);
      }

      return res.redirect("/career-success");

    } catch (error) {
      console.error("❌ CAREER ROUTE ERROR:", error);
      return res.status(500).send("Internal Server Error");
    }

  });

});







router.post("/orders/:orderId/cancel", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const orderId = req.params.orderId;

  /* =========================
     1️⃣ VERIFY ORDER
  ========================= */
  const checkSql = `
    SELECT order_status
    FROM orders
    WHERE order_id = ?
      AND user_id = ?
    LIMIT 1
  `;

  req.db.query(checkSql, [orderId, userId], (err, rows) => {
    if (err || rows.length === 0) {
      return res.send("Order not found");
    }

    const status = rows[0].order_status;

    // ❌ BLOCK IF ALREADY SHIPPED
    if (!["PLACED", "CONFIRMED"].includes(status)) {
      return res.send("Order cannot be cancelled at this stage");
    }

    /* =========================
       2️⃣ DELETE ORDER ITEMS
    ========================= */
    req.db.query(
      "DELETE FROM order_items WHERE order_id = ?",
      [orderId],
      err => {
        if (err) {
          console.error("❌ ORDER ITEMS DELETE ERROR:", err);
          return res.send("Cancel failed");
        }

        /* =========================
           3️⃣ DELETE ORDER
        ========================= */
        req.db.query(
          "DELETE FROM orders WHERE order_id = ?",
          [orderId],
          err => {
            if (err) {
              console.error("❌ ORDER DELETE ERROR:", err);
              return res.send("Cancel failed");
            }

            console.log("❌ ORDER CANCELLED:", orderId);

            return res.redirect("/orders");
          }
        );
      }
    );
  });
});

router.post("/orders/:orderId/cancel-request", (req, res) => {
  const db = req.db;

  const orderId = req.params.orderId;
const userId = req.session.user?.user_id;
// make sure session exists
  const { reason, description } = req.body;

  if (!reason) {
    return res.send("Cancellation reason is required");
  }

  const insertQuery = `
    INSERT INTO order_cancellation_requests
      (order_id, user_id, reason, description, status)
    VALUES
      (?, ?, ?, ?, 'PENDING')
  `;

  db.query(
    insertQuery,
    [orderId, userId, reason, description || null],
    (err) => {
      if (err) {
        console.error("❌ CANCEL REQUEST ERROR:", err);
        return res.send("Failed to submit cancellation request");
      }

      // ✅ redirect back to order details page
      res.redirect(`/orders/${orderId}`);
    }
  );
});

/* ===============================
   CART COUNT API (FIXED)
================================ */
router.get("/cart-count", async (req, res) => {
  try {
    const db = req.db; // ✅ use req.db

    const userId = req.session.user?.user_id || null; // ✅ correct session key
    const sessionId = req.sessionID;                  // ✅ include guest cart also

    const [rows] = await db.promise().query(
      `
      SELECT SUM(quantity) AS count
      FROM cart
      WHERE (user_id = ? OR session_id = ?)
      `,
      [userId, sessionId]
    );

    const count = rows[0].count || 0;

    res.json({ count });

  } catch (err) {
    console.error("Cart Count Error:", err);
    res.json({ count: 0 });
  }
});

/* PRODUCT DETAILS */

router.get("/product/:slug", (req, res) => {

  const slug = req.params.slug;

  /* =========================
     1️⃣ FETCH PRODUCT
  ========================== */
  const query = `
    SELECT p.*, 
           s.name AS section_name, s.display_slug AS section_slug,
           ss.name AS sub_section_name, ss.display_slug AS sub_slug
    FROM products p
    JOIN sections s ON p.section_id = s.id
    LEFT JOIN sub_sections ss ON p.sub_section_id = ss.id
    WHERE p.display_slug = ?
    LIMIT 1
  `;

  req.db.query(query, [slug], (err, result) => {

    if (err) {
      console.error("❌ PRODUCT FETCH ERROR:", err);
      return res.send("Error loading product");
    }

    if (!result.length) {
      return res.status(404).send("Product not found");
    }

    const product = result[0];
    

/* ✅ CREATE BREADCRUMBS HERE ONLY */
const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: product.section_name, url: `/${product.section_slug}` }
];

if (product.sub_slug) {
  breadcrumbs.push({
    name: product.sub_section_name,
    url: `/${product.section_slug}/${product.sub_slug}`
  });
}

breadcrumbs.push({
  name: product.product_name,
  url: `/product/${product.display_slug}`
});

    /* =========================
       2️⃣ FETCH PRODUCT GALLERY
    ========================== */
    req.db.query(
      "SELECT image FROM product_images WHERE product_id = ?",
      [product.id],
      (imgErr, images) => {

        if (imgErr) {
          console.error("❌ IMAGE FETCH ERROR:", imgErr);
          return res.send("Error loading images");
        }

        /* =========================
           3️⃣ FETCH RELATED PRODUCTS
        ========================== */
        const relatedQuery = `
          SELECT *
          FROM products
          WHERE id != ?
            AND section_id = ?
            AND is_active = 1
          ORDER BY RAND()
          LIMIT 8
        `;

        req.db.query(
          relatedQuery,
          [product.id, product.section_id],
          (relErr, relatedProducts) => {

            if (relErr) {
              console.error("❌ RELATED PRODUCTS ERROR:", relErr);
              relatedProducts = [];
            }

            /* =========================
               4️⃣ SEO META GENERATION
            ========================== */
            const baseUrl = process.env.BASE_URL;

            const productUrl = `${baseUrl}/product/${product.display_slug}`;

            const meta = {
              title: `${product.product_name} | AutoKart`,
              description: product.description || `Buy ${product.product_name} online at AutoKart. Best price and fast delivery.`,
              keywords: `${product.product_name}, auto parts, ${product.section_name}`,
              image: `${baseUrl}/uploads/${product.image}`,
              url: productUrl,
              type: "product"
            };

            const hreflangUrls = [
              { lang: "en", url: productUrl },
              { lang: "mr", url: `${productUrl}?lang=mr` }
            ];

            /* =========================
               5️⃣ STRUCTURED DATA (GOOGLE PRODUCT SCHEMA)
            ========================== */
            const structuredData = generateProductSchema({
              name: product.product_name,
              description: product.description || product.product_name,
              image: `${baseUrl}/uploads/${product.image}`,
              sku: product.id,
              price: product.price,
              currency: "INR",
              availability: product.quantity > 0 ? "InStock" : "OutOfStock",
              url: productUrl
            });

            /* =========================
               6️⃣ BREADCRUMB SCHEMA
            ========================== */
            const breadcrumbSchema = generateBreadcrumbSchema([
              { name: "Home", url: baseUrl },
              { name: product.section_name, url: `${baseUrl}/${product.section_slug}` },
              ...(product.sub_slug ? [{
                name: product.sub_section_name,
                url: `${baseUrl}/${product.section_slug}/${product.sub_slug}`
              }] : []),
              { name: product.product_name, url: productUrl }
            ]);

  
/* =========================
    7 FETCH REVIEWS
========================= */

const reviewSql = `
  SELECT r.*, u.user_first_name, u.user_last_name
  FROM product_reviews r
  JOIN user_create_account u ON r.user_id = u.user_id
  WHERE r.product_id = ?
  ORDER BY r.created_at DESC
`;

req.db.query(reviewSql, [product.id], (revErr, reviews) => {

  if (revErr) {
    console.error("❌ REVIEW FETCH ERROR:", revErr);
    reviews = [];
  }

  /* ⭐ Calculate Average Rating */
  let averageRating = 0;

  if (reviews.length > 0) {
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    averageRating = (total / reviews.length).toFixed(1);
  }

  res.render("user/product-details", {
    product,
    images,
    relatedProducts: relatedProducts || [],
    reviews,
    averageRating,

    meta,
    hreflangUrls,
    structuredData,
    breadcrumbSchema,
    breadcrumbs
  });

});
          }
        );
      }
    );
  });
});

   /*
   =========================
   RESERVED ROUTES (DO NOT TREAT AS CATEGORY)
   ========================= */

const RESERVED_SLUGS = new Set([
  "admin",
  "admin-login",
  "dashboard",

  "cart",
  "checkout",
  "orders",
  "product",
  "search",
  "api",
  "create-checkout",
  "customer_login",
  "register",
  "logout",
  "my_profile",
  "about-us",
  "contact",
  "privacy",
  "terms",
  "returns",
  "security",
  "dealer",
  "become_dealer",
  "payment-success",
  "create-razorpay-order",
  "verify-payment",
  "blog",
  "forgot-password",
  "reset-password",

  "uploads",
  "runtime_uploads"
]);
/* SECTION PRODUCTS */
/* =========================
   SECTION PRODUCTS (PAGINATION READY)
   50 PRODUCTS PER PAGE
========================= */
router.get("/:sectionSlug", (req, res, next) => {

  const sectionSlug = req.params.sectionSlug.toLowerCase();

  // ✅ Skip static pages
  if (RESERVED_SLUGS.has(sectionSlug)) {
    return next();
  }

  let page = parseInt(req.query.page, 10) || 1;
  if (page < 1) page = 1;

  const limit = 50;

  /* =========================
     1️⃣ FIND SECTION BY SLUG
  ========================== */
  req.db.query(
    "SELECT * FROM sections WHERE display_slug = ? LIMIT 1",
    [sectionSlug],
    (err, sectionRows) => {

      if (err || sectionRows.length === 0) {
        return res.status(404).send("Section not found");
      }

      const section = sectionRows[0];

      /* =========================
         2️⃣ COUNT PRODUCTS (FOR PAGINATION)
      ========================== */
      req.db.query(
        `
        SELECT COUNT(id) AS total
        FROM products
        WHERE section_id = ?
          AND is_active = 1
        `,
        [section.id],
        (err, countRows) => {

          if (err) {
            console.error("COUNT ERROR:", err);
            return res.send("Error loading products");
          }

          const totalRows = countRows[0].total;
          const totalPages = Math.max(1, Math.ceil(totalRows / limit));

          if (page > totalPages) page = totalPages;

          const offset = (page - 1) * limit;

          /* =========================
             3️⃣ FETCH PRODUCTS
          ========================== */
          req.db.query(
            `
            SELECT *
            FROM products
            WHERE section_id = ?
              AND is_active = 1
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            `,
            [section.id, limit, offset],
            (err, products) => {

              if (err) {
                console.error("PRODUCT FETCH ERROR:", err);
                return res.send("Error loading products");
              }

              /* =========================
                 4️⃣ SEO META GENERATION
              ========================== */
              const baseUrl = process.env.BASE_URL;

              const meta = {
                title: `${section.name} | AutoKart`,
                description: `Buy ${section.name} online at AutoKart. Genuine products, best price, fast delivery across India.`,
                keywords: `${section.name}, auto parts, buy ${section.name} online`,
                image: `${baseUrl}/uploads/autokart_logo.jpeg`,
                url: `${baseUrl}/${section.display_slug}`,
                type: "website"
              };

              const hreflangUrls = [
                { lang: "en", url: `${baseUrl}/${section.display_slug}` },
                { lang: "mr", url: `${baseUrl}/${section.display_slug}?lang=mr` }
              ];

              const structuredData = generateCollectionPageSchema({
                name: section.name,
                url: `${baseUrl}/${section.display_slug}`
              });

              /* =========================
                 5️⃣ RENDER PAGE
              ========================== */

              const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: section.name, url: `/${section.display_slug}` }
];
              res.render("user/section-products", {
                section,
                products,

                currentPage: page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1,

                /* SEO DATA */
                meta,
                hreflangUrls,
                structuredData,
                 breadcrumbs
              });

            }
          );
        }
      );
    }
  );
});

/* SUB-SECTION PRODUCTS */


router.get("/:sectionSlug/:subSlug", (req, res, next) => {

  const { sectionSlug, subSlug } = req.params;

  /* 🚫 Prevent conflict with system routes */
  if (RESERVED_SLUGS.has(sectionSlug)) {
    return next();
  }

  let page = parseInt(req.query.page, 10) || 1;
  if (page < 1) page = 1;

  const limit = 50;

  /* =========================
     1️⃣ FIND SECTION
  ========================== */
  req.db.query(
    "SELECT * FROM sections WHERE display_slug = ? LIMIT 1",
    [sectionSlug],
    (err, sectionRows) => {

      if (err || !sectionRows.length) {
        return res.status(404).send("Section not found");
      }

      const section = sectionRows[0];

      /* =========================
         2️⃣ FIND SUB-SECTION
      ========================== */
      req.db.query(
        `
        SELECT *
        FROM sub_sections
        WHERE display_slug = ?
          AND section_id = ?
        LIMIT 1
        `,
        [subSlug, section.id],
        (err, subRows) => {

          if (err || !subRows.length) {
            return res.status(404).send("Sub-section not found");
          }

          const subSection = subRows[0];
          /* ✅ BUILD BREADCRUMBS FOR UI */
const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: section.name, url: `/${section.display_slug}` },
  { name: subSection.name, url: `/${section.display_slug}/${subSection.display_slug}` }
];

          /* =========================
             3️⃣ COUNT PRODUCTS
          ========================== */
          req.db.query(
            `
            SELECT COUNT(id) AS total
            FROM products
            WHERE sub_section_id = ?
              AND is_active = 1
            `,
            [subSection.id],
            (err, countRows) => {

              if (err) {
                console.error("COUNT ERROR:", err);
                return res.send("Error loading products");
              }

              const totalRows = countRows[0].total;
              const totalPages = Math.max(1, Math.ceil(totalRows / limit));

              if (page > totalPages) page = totalPages;

              const offset = (page - 1) * limit;

              /* =========================
                 4️⃣ FETCH PRODUCTS
              ========================== */
              req.db.query(
                `
                SELECT *
                FROM products
                WHERE sub_section_id = ?
                  AND is_active = 1
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                `,
                [subSection.id, limit, offset],
                (err, products) => {

                  if (err) {
                    console.error("PRODUCT FETCH ERROR:", err);
                    return res.send("Error loading products");
                  }

                  /* =========================
                     5️⃣ SEO META GENERATION
                  ========================== */
                  const baseUrl = process.env.BASE_URL;

                  const pageUrl = `${baseUrl}/${section.display_slug}/${subSection.display_slug}`;

                  const meta = {
                    title: `${subSection.name} | ${section.name} | AutoKart`,
                    description: `Shop ${subSection.name} in ${section.name} at AutoKart. Genuine products, best pricing, fast delivery.`,
                    keywords: `${subSection.name}, ${section.name}, auto parts`,
                    image: `${baseUrl}/uploads/autokart_logo.jpeg`,
                    url: pageUrl,
                    type: "website"
                  };

                  const hreflangUrls = [
                    { lang: "en", url: pageUrl },
                    { lang: "mr", url: `${pageUrl}?lang=mr` }
                  ];

                  const structuredData = generateCollectionPageSchema({
                    name: subSection.name,
                    url: pageUrl
                  });

                  const breadcrumbSchema = generateBreadcrumbSchema([
                    { name: "Home", url: baseUrl },
                    { name: section.name, url: `${baseUrl}/${section.display_slug}` },
                    { name: subSection.name, url: pageUrl }
                  ]);

                  /* =========================
                     6️⃣ RENDER PAGE
                  ========================== */
                  res.render("user/sub-section-products", {
                    section,
                    subSection,
                    products,

                    currentPage: page,
                    totalPages,
                    hasPrev: page > 1,
                    hasNext: page < totalPages,
                    prevPage: page - 1,
                    nextPage: page + 1,

                    /* SEO */
                    meta,
                    hreflangUrls,
                    structuredData,
                    breadcrumbSchema,
                    breadcrumbs 
                    
                  });

                }
              );
            }
          );
        }
      );
    }
  );
});

/* =========================
  SEARCH BOX
========================= */
router.get("/search", (req, res) => {
  const q = req.query.q;

  if (!q || q.length < 2) {
    return res.json([]);
  }

  const sql = `
    SELECT id, product_name, image, price
    FROM products
    WHERE product_name LIKE ?
    LIMIT 6
  `;

  req.db.query(sql, [`%${q}%`], (err, results) => {
    if (err) {
      console.error(err);
      return res.json([]);
    }

    res.json(results);
  });
});
router.get("/api/search", (req, res) => {
  const q = req.query.q;

  const sql = `
    SELECT id, product_name, price, image, display_slug
    FROM products
    WHERE product_name LIKE ?
    LIMIT 5
  `;

  req.db.query(sql, [`%${q}%`], (err, results) => {
    if (err) return res.json([]);
    res.json(results);
  });
});

/* =========================
   CART PAGE
========================= */

router.get("/cart", (req, res) => {
  const sessionId = req.sessionID;
  const userId = req.session.user?.user_id || null;

  const query = `
    SELECT
  c.product_id,
  c.quantity,
  p.product_name,
  p.price,
  p.image,
  p.quantity AS stock_quantity
FROM cart c
JOIN products p ON p.id = c.product_id

    WHERE (c.user_id = ? OR c.session_id = ?)
  `;

  req.db.query(query, [userId, sessionId], (err, cart) => {
    if (err) return res.send("Cart error");
    res.render("user/cart", { cart });
  });
});





router.post("/cart/update", async (req, res) => {
  const { product_id, action } = req.body;
  const sessionId = req.sessionID;
  const userId = req.session.user?.user_id || null;
  const db = req.db;

  try {
    // 1️⃣ Get product stock
    const [productRows] = await db.promise().query(
      "SELECT quantity FROM products WHERE id = ? LIMIT 1",
      [product_id]
    );

    if (!productRows.length) {
      return res.redirect("/cart");
    }

    const stock = productRows[0].quantity;

    // 2️⃣ Get current cart quantity
    const [cartRows] = await db.promise().query(
      `
      SELECT quantity
      FROM cart
      WHERE (user_id = ? OR session_id = ?)
        AND product_id = ?
      LIMIT 1
      `,
      [userId, sessionId, product_id]
    );

    if (!cartRows.length) {
      return res.redirect("/cart");
    }

    const currentQty = cartRows[0].quantity;
    let newQty = currentQty;

    // 3️⃣ Apply logic safely
    if (action === "increase") {
      if (currentQty < stock) {
        newQty = currentQty + 1;
      }
    } else if (action === "decrease") {
      if (currentQty > 1) {
        newQty = currentQty - 1;
      }
    }

    // 4️⃣ Update cart
    await db.promise().query(
      `
      UPDATE cart
      SET quantity = ?
      WHERE (user_id = ? OR session_id = ?)
        AND product_id = ?
      `,
      [newQty, userId, sessionId, product_id]
    );

    return res.redirect("/cart");

  } catch (err) {
    console.error("❌ CART UPDATE ERROR:", err);
    return res.redirect("/cart");
  }
});




router.post("/cart/remove", (req, res) => {
  const { product_id } = req.body;
  const sessionId = req.sessionID;
  const userId = req.session.user?.user_id || null;

  req.db.query(
    `
    DELETE FROM cart
    WHERE (user_id = ? OR session_id = ?)
      AND product_id = ?
    `,
    [userId, sessionId, product_id],
    () => res.redirect("/cart")
  );
});


/* =========================
   ADD TO CART (DB)
========================= */
router.post("/add-to-cart", (req, res) => {
  const db = req.db;
  const { productId, qty } = req.body;
  const sessionId = req.sessionID;
  const userId = req.session.user?.user_id || null;

  if (!productId) {
    return res.json({ success: false, message: "Product missing" });
  }

  const checkSql = `
    SELECT *
    FROM cart
    WHERE (user_id = ? OR session_id = ?)
      AND product_id = ?
  `;

  db.query(checkSql, [userId, sessionId, productId], (err, rows) => {
    if (err) return res.json({ success: false });

    if (rows.length > 0) {
      db.query(
        `
        UPDATE cart
        SET quantity = quantity + 1
        WHERE (user_id = ? OR session_id = ?)
          AND product_id = ?
        `,
        [userId, sessionId, productId],
        err => {
          if (err) return res.json({ success: false });
          return res.json({ success: true });
        }
      );
    } else {
      db.query(
        `
        INSERT INTO cart (session_id, user_id, product_id, quantity)
        VALUES (?, ?, ?, ?)
        `,
        [sessionId, userId, productId, qty || 1],
        err => {
          if (err) return res.json({ success: false });
          return res.json({ success: true });
        }
      );
    }
  });
});


router.get("/create-checkout", (req, res) => {
  return res.redirect("/cart");
});


router.post("/create-checkout", (req, res) => {
  console.log("✅ POST /create-checkout HIT");

  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const sessionId = req.sessionID;
  const productId = req.body.product_id; // buy-now
  const checkoutId = "CHK" + Date.now();
  console.log("🔥 /create-checkout HIT");

  let itemsSql;
  let params;

  // 🟠 BUY NOW
  if (productId) {
    itemsSql = `
      SELECT
        p.id AS product_id,
        1 AS quantity,
        p.product_name,
        p.image,
        p.price
      FROM products p
      WHERE p.id = ?
      LIMIT 1
    `;
    params = [productId];
  }
  // 🔵 CART
  else {
    itemsSql = `
      SELECT
        c.product_id,
        c.quantity,
        p.product_name,
        p.image,
        p.price
      FROM cart c
      JOIN products p ON p.id = c.product_id
      WHERE (c.user_id = ? OR c.session_id = ?)

    `;
    params = [userId, sessionId]
;
  }

  req.db.query(itemsSql, params, (err, items) => {
    if (err || items.length === 0) {
      return res.send("Nothing to checkout");
    }

    let totalAmount = 0;
    let totalItems = 0;

    items.forEach(i => {
      totalAmount += i.price * i.quantity;
      totalItems += i.quantity;

    });



    // 1️⃣ CREATE CHECKOUT SESSION
  req.db.query(
`
INSERT INTO checkout_sessions
(
  checkout_id,
  user_id,
  session_id,
  mode,
  status,
  total_amount,
  total_items
)
VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
`,
[
  checkoutId,
  userId,
  sessionId,
  productId ? "BUY_NOW" : "CART",
  totalAmount,
  totalItems
],


      err => {
        if (err) {
  console.error("CHECKOUT INSERT ERROR 👉", err);
  return res.send("Checkout failed");
}


        // 2️⃣ INSERT CHECKOUT ITEMS
        const values = items.map(i => [
          checkoutId,
          userId,
          i.product_id,
          i.product_name,
          i.image,
          i.price,
          i.quantity
        ]);

        req.db.query(
          `
          INSERT INTO checkout_session_items
          (checkout_id, user_id, product_id, product_name, product_image, price, quantity)
          VALUES ?
          `,
          [values],
          err => {
            if (err) {
  console.error("CHECKOUT INSERT ERROR 👉", err);
  return res.send("Checkout failed");
}
    /* =====================================================
   🔧 SAVE TOTALS INTO CHECKOUT SESSION (CRITICAL)
===================================================== */

            // 3️⃣ REDIRECT TO CHECKOUT PAGE
            res.redirect(`/checkout?checkout_id=${checkoutId}`);
          }
        );
      }
    );
  });
});










/* =========================
   CHECKOUT (AMAZON / FLIPKART STYLE)
   SOURCE: checkout_sessions
========================= */
router.get("/checkout", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const checkoutId = req.query.checkout_id;

  if (!checkoutId) {
    return res.send("Checkout session missing");
  }

  /* =========================
     1️⃣ FETCH CHECKOUT SESSION
  ========================= */
  const checkoutSql = `
    SELECT checkout_id, total_amount, total_items, status
    FROM checkout_sessions
    WHERE checkout_id = ?
      AND user_id = ?
      AND status = 'ACTIVE'
    LIMIT 1
  `;

  req.db.query(checkoutSql, [checkoutId, userId], (err, checkoutRows) => {
    if (err || checkoutRows.length === 0) {
      console.error("❌ CHECKOUT SESSION ERROR:", err);
      return res.send("Invalid checkout session");
    }

    const checkout = checkoutRows[0];

    /* =========================
       2️⃣ FETCH CHECKOUT ITEMS
    ========================= */
    const itemsSql = `
      SELECT product_id, product_name, product_image, price, quantity
      FROM checkout_session_items
      WHERE checkout_id = ?
        AND user_id = ?
    `;

    req.db.query(itemsSql, [checkoutId, userId], (err, items) => {
      if (err || items.length === 0) {
        console.error("❌ CHECKOUT ITEMS ERROR:", err);
        return res.send("Checkout items missing");
      }

      /* =========================
         3️⃣ FETCH LATEST ADDRESS
      ========================= */
      const addressSql = `
        SELECT *
        FROM user_addresses
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;

      req.db.query(addressSql, [userId], (addrErr, addressRows) => {
        if (addrErr) {
          console.error("❌ ADDRESS FETCH ERROR:", addrErr);
          return res.send("Address error");
        }

        const addresses = addressRows || [];
        let selectedAddress = null;

        if (req.session.selectedAddressId) {
          selectedAddress = addresses.find(
            a => a.address_id == req.session.selectedAddressId
          );
        }

        if (!selectedAddress && addresses.length > 0) {
          selectedAddress = addresses[0];
        }

        if (selectedAddress) {
          req.db.query(
            `
            UPDATE checkout_sessions
            SET address_id = ?
            WHERE checkout_id = ?
              AND user_id = ?
              AND status = 'ACTIVE'
            `,
            [selectedAddress.address_id, checkoutId, userId]
          );

          checkout.address_id = selectedAddress.address_id;
        } else {
          checkout.address_id = null;
        }

        res.render("user/checkout", {
          checkout,
          items,
          addresses,
          selectedAddress
        });
      });
    });
  });
});


  

router.post("/select-address", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ success: false });
  }

  const userId = req.session.user.user_id;
  const { address_id } = req.body;

  req.db.query(
    `
    UPDATE user_addresses
    SET is_selected = CASE
      WHEN address_id = ? THEN 1
      ELSE 0
    END
    WHERE user_id = ?
    `,
    [address_id, userId],
    err => {
      if (err) {
        console.error("❌ ADDRESS SELECT ERROR:", err);
        return res.json({ success: false });
      }

      return res.json({ success: true });
    }
  );
});


router.post("/checkout/select-address", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false });
  }

  const userId = req.session.user.user_id;
  const { address_id, checkout_id } = req.body;

  if (!address_id || !checkout_id) {
    return res.json({ success: false });
  }

  req.db.query(
    `
    UPDATE checkout_sessions
    SET address_id = ?
    WHERE checkout_id = ?
      AND user_id = ?
      AND status = 'ACTIVE'
    `,
    [address_id, checkout_id, userId],
    (err, result) => {
      if (err) {
        console.error("❌ ADDRESS SAVE ERROR:", err);
        return res.json({ success: false });
      }

      if (result.affectedRows === 0) {
        return res.json({ success: false });
      }

      return res.json({ success: true });
    }
  );
});



/* =========================
   PAY (CHECKOUT FLOW)
========================= */
router.post("/pay", (req, res) => {
  const paymentMethod = req.body.paymentMethod?.toUpperCase();
  const checkoutId = req.body.checkout_id;

  console.log("REQ BODY 👉", req.body);
  console.log("PAYMENT METHOD 👉", paymentMethod);
  console.log("CHECKOUT ID 👉", checkoutId);

  /* =========================
     AUTH CHECK
  ========================= */
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  if (!checkoutId) {
    return res.send("Checkout session missing");
  }

  if (paymentMethod !== "COD") {
    return res.send("Invalid payment method");
  }

  const userId = req.session.user.user_id;
  const sessionId = req.sessionID;

  /* =====================================================
     1️⃣ FETCH CHECKOUT SESSION
  ===================================================== */
  const checkoutSql = `
    SELECT *
    FROM checkout_sessions
    WHERE checkout_id = ?
      AND user_id = ?
      AND status = 'ACTIVE'
    LIMIT 1
  `;

  req.db.query(checkoutSql, [checkoutId, userId], (err, checkoutRows) => {
    if (err) {
      console.error("❌ CHECKOUT FETCH ERROR:", err);
      return res.send("Order failed");
    }

    if (checkoutRows.length === 0) {
      return res.send("Invalid or expired checkout session");
    }

    const checkout = checkoutRows[0];

    /* =====================================================
       2️⃣ FETCH CHECKOUT SESSION ITEMS
    ===================================================== */
    const itemsSql = `
      SELECT *
      FROM checkout_session_items
      WHERE checkout_id = ?
        AND user_id = ?
    `;

    req.db.query(itemsSql, [checkoutId, userId], (err, items) => {
      if (err) {
        console.error("❌ CHECKOUT ITEMS ERROR:", err);
        return res.send("Order failed");
      }

      if (items.length === 0) {
        return res.send("No items found for checkout");
      }


 // 3.5️⃣ FETCH SELECTED ADDRESS
/* =========================
   FETCH ADDRESS FROM CHECKOUT SESSION
========================= */

if (!checkout.address_id) {
  return res.send("Please select delivery address");
}

const addressSql = `
  SELECT *
  FROM user_addresses
  WHERE address_id = ?
    AND user_id = ?
  LIMIT 1
`;

req.db.query(
  addressSql,
  [checkout.address_id, userId],
  (addrErr, addrRows) => {

    if (addrErr) {
      console.error("❌ ADDRESS FETCH ERROR:", addrErr);
      return res.send("Address fetch failed");
    }

    if (addrRows.length === 0) {
      return res.send("Invalid delivery address");
    }

    const address = addrRows[0];

    // continue order creation here
  }
    );


    /* =====================================================
       3️⃣ CREATE ORDER
    ===================================================== */
    const orderId = "ORD" + Date.now();

    const orderSql = `
  INSERT INTO orders
  (
    order_id,
    user_id,
    checkout_id,
    address_id,
    total_amount,
    total_items,
    order_status,
    payment_method,
    payment_status
  )
  VALUES (?, ?, ?, ?, ?, ?, 'PLACED', 'COD', 'PENDING')
`;



   req.db.query(
  orderSql,
  [
    orderId,
    userId,
    checkoutId,
   checkout.address_id, // 🔥 THIS LINE
    checkout.total_amount,
    checkout.total_items
  ],

      err => {
        if (err) {
          console.error("❌ ORDER INSERT ERROR:", err);
          return res.send("Order failed");
        }

          /* =====================================================
             4️⃣ INSERT ORDER ITEMS
          ===================================================== */
          const orderItemsSql = `
            INSERT INTO order_items
            (
              order_id,
              user_id,
              product_id,
              product_name,
              product_image,
              price,
              quantity
            )
            VALUES ?
          `;

          const orderItemValues = items.map(item => [
            orderId,
            userId,
            item.product_id,
            item.product_name,
            item.product_image,
            item.price,
            item.quantity
          ]);

          req.db.query(orderItemsSql, [orderItemValues], err => {
            if (err) {
              console.error("❌ ORDER ITEMS INSERT ERROR:", err);
              return res.send("Order failed");
            }

   /* =====================================================
   5️⃣ MARK CHECKOUT SESSION COMPLETED
===================================================== */
const updateCheckoutSql = `
  UPDATE checkout_sessions
  SET status = 'COMPLETED',
      payment_method = 'COD',
      payment_status = 'PENDING'
  WHERE checkout_id = ?
`;

req.db.query(updateCheckoutSql, [checkoutId], err => {
  if (err) {
    console.error("❌ CHECKOUT UPDATE ERROR:", err);
    return res.send("Order failed");
  }

  /* =====================================================
   6️⃣ CLEAR CART (ONLY IF CART CHECKOUT)
===================================================== */

const sendOrderMail = () => {

  // 🔹 1️⃣ Fetch user
  req.db.query(
    `
    SELECT user_email, user_first_name
    FROM user_create_account
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId],
    (mailErr, userRows) => {

      if (mailErr) {
        console.error("Email fetch error:", mailErr);
        return;
      }

      if (userRows.length === 0) return;

      // 🔹 2️⃣ Fetch order items  🔥 ADD THIS
      req.db.query(
        `
        SELECT product_name, quantity, price
        FROM order_items
        WHERE order_id = ?
        `,
        [orderId],
        (itemErr, itemsRows) => {

          if (itemErr) {
            console.error("Item fetch error:", itemErr);
            return;
          }

          // 🔹 3️⃣ Send email with items
          sendOrderPlacedEmail(
            userRows[0].user_email,
            userRows[0].user_first_name,
            orderId,
            checkout.total_amount,
            checkout.total_items,
            "COD",
            null,
            itemsRows   // 🔥 VERY IMPORTANT
          ).catch(err =>
            console.error("Order placed email failed:", err)
          );

        }
      );
    }
  );
};

if (checkout.mode === "CART") {
req.db.query(
  `
  DELETE FROM cart
  WHERE user_id = ?
     OR session_id = ?
  `,
  [userId, sessionId],
  err => {
    if (err) {
      console.error("❌ CART CLEAR ERROR:", err);
    } else {
      console.log("🧹 CART CLEARED COMPLETELY");
    }

    sendOrderMail();

    return res.redirect(`/payment-success?order_id=${orderId}`);
  }
);
} else {
  console.log("🛒 BUY NOW ORDER → CART PRESERVED");
  console.log("✅ ORDER PLACED SUCCESSFULLY:", orderId);

  sendOrderMail(); // ✅ EMAIL CALL

  return res.redirect(`/payment-success?order_id=${orderId}`);
}
});
          });
          });
        }
      );
    });
  });


router.post("/save-address", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false });
  }

  const userId = req.session.user.user_id;

  const {
    address_id,
    full_name,
    mobile,
    address_line,
    landmark,
    city,
    state,
    pincode,
    address_type
  } = req.body;

  console.log("📦 SAVE ADDRESS:", req.body);

  // ======================
  // UPDATE ADDRESS
  // ======================
  if (address_id) {
    req.db.query(
      `
      UPDATE user_addresses
      SET
        full_name = ?,
        mobile = ?,
        address_line = ?,
        landmark = ?,
        city = ?,
        state = ?,
        pincode = ?,
        address_type = ?
      WHERE address_id = ?
        AND user_id = ?
      `,
      [
        full_name,
        mobile,
        address_line,
        landmark,
        city,
        state,
        pincode,
        address_type,
        address_id,
        userId
      ],
      (err, result) => {
        if (err) {
          console.error("❌ ADDRESS UPDATE ERROR:", err);
          return res.json({ success: false });
        }

        console.log("✅ ADDRESS UPDATED");
        return res.json({ success: true, action: "updated" });
      }
    );
    return; // 🔴 VERY IMPORTANT
  }

  // ======================
  // INSERT ADDRESS
  // ======================
  req.db.query(
    `
    INSERT INTO user_addresses
    (
      user_id,
      full_name,
      mobile,
      address_line,
      landmark,
      city,
      state,
      pincode,
      address_type
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      full_name,
      mobile,
      address_line,
      landmark,
      city,
      state,
      pincode,
      address_type
    ],
    (err, result) => {
      if (err) {
        console.error("❌ ADDRESS INSERT ERROR:", err);
        return res.json({ success: false });
      }

      console.log("✅ ADDRESS INSERTED");
      return res.json({
  success: true,
  action: "inserted",
  address_id: result.insertId
});

    }
  );
});



/* =========================
   PAYMENT SUCCESS (TEMP)
========================= */

router.get("/payment-success", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const orderId = req.query.order_id;

  if (!orderId) {
    return res.redirect("/orders");
  }

  const sql = `
    SELECT payment_method
    FROM orders
    WHERE order_id = ?
      AND user_id = ?
    LIMIT 1
  `;

  req.db.query(sql, [orderId, userId], (err, rows) => {
    if (err) {
      console.error("❌ PAYMENT SUCCESS FETCH ERROR:", err);
      return res.redirect("/orders");
    }

    if (rows.length === 0) {
      return res.redirect("/orders");
    }

    const method = rows[0].payment_method;

    res.render("user/payment-success", {
      method
    });
  });
});



router.get("/dealer", (req, res) => {
  res.render("become_dealer/become_dealer");
});

router.get("/dealer__login", (req, res) => {
  res.render("become_dealer/dealer_login");
});

router.get("/dealer_start_selling", (req, res) => {
  res.render("become_dealer/start_selling");
});

router.get("/payment_cycle", (req, res) => {
  res.render("become_dealer/payment_cycle");
});



router.get("/become_dealer", (req, res) => {
  res.render("become_dealer/become_dealer_from", {
    successMessage: null,
    errorMessage: null
  });
});



router.post("/dealer/register", function (req, res) {
  const db = req.db;
  const { full_name, mobile, email, city, dealer_type } = req.body;

  if (!full_name || !mobile || !email || !city || !dealer_type) {
    return res.render("become_dealer/become_dealer_from", {
      errorMessage: "All fields are required",
      successMessage: null
    });
  }

  db.query(
    "SELECT id FROM dealers WHERE mobile = ?",
    [mobile],
    function (err, rows) {

      if (rows.length > 0) {
        return res.render("become_dealer/become_dealer_from", {
          errorMessage: "Mobile number already registered",
          successMessage: null
        });
      }

      db.query(
        `INSERT INTO dealers
        (full_name, mobile, email, city, dealer_type, status)
        VALUES (?, ?, ?, ?, ?, 'pending')`,
        [full_name, mobile, email, city, dealer_type],
        () => {
          return res.render("become_dealer/dealer_welcome", {
            successMessage:
              "✅ Registration successful. Please check your status.",
            errorMessage: null
          });
        }
      );
    }
  );
});


router.post("/dealer/check_status", (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.redirect(
      "/dealer/status_result?error=Please enter mobile number"
    );
  }

  return res.redirect(
    `/dealer/status_result?mobile=${mobile}`
  );
});


router.get("/dealer/status_result", (req, res) => {
  const db = req.db;
  const { mobile, error } = req.query;

  if (error) {
    return res.render("become_dealer/dealer_status", {
      message: error,
      type: "error",
      name: "",
      reason: ""
    });
  }

  db.query(
    "SELECT full_name, status, rejection_reason FROM dealers WHERE mobile = ?",
    [mobile],
    (err, rows) => {

      if (!rows || rows.length === 0) {
        return res.render("become_dealer/dealer_status", {
          message: "Dealer not found",
          type: "error",
          name: "",
          reason: ""
        });
      }

      const dealer = rows[0];
      let message = "";
      let type = "";

      if (dealer.status === "approved") {
        message = "Your request has been APPROVED.";
        type = "success";
      } else if (dealer.status === "rejected") {
        message = "Your request has been REJECTED.";
        type = "error";
      } else {
        message = "Your request is PENDING.";
        type = "warning";
      }

      res.render("become_dealer/dealer_status", {
        message,
        type,
        name: dealer.full_name,
        reason: dealer.rejection_reason || ""
      });
    }
  );
});





//contact//
router.get("/contact", (req, res) => {
  // SEO Meta Data for Contact Page
  const baseUrl = process.env.BASE_URL;
  const meta = {
    title: 'Contact AutoKart - Customer Support & Service',
    description: 'Contact AutoKart for customer support, product inquiries, and service requests. Get in touch with our team for the best auto parts and accessories.',
    keywords: 'contact AutoKart, customer support, auto parts service, car accessories help, AutoKart phone, AutoKart email',
    image: `${baseUrl}/uploads/autokart_logo.jpeg`,
    url: `${baseUrl}/contact`,
    type: 'website'
  };

  const hreflangUrls = [
    { lang: 'en', url: `${baseUrl}/contact` },
    { lang: 'mr', url: `${baseUrl}/contact?lang=mr` }
  ];

  // Structured Data for Contact Page
  const structuredData = generateLocalBusinessSchema();

  res.render("user/contact", {
    // SEO data
    meta,
    hreflangUrls,
    structuredData
  });

});

router.get("/privacy", (req, res) => {
  res.render("policy/privacy");
});

router.get("/terms", (req, res) => {
  res.render("policy/terms");
});

router.get("/returns", (req, res) => {
  res.render("policy/returns");
});

router.get("/security", (req, res) => {
  res.render("policy/security");
});




router.post("/create-razorpay-order", async (req, res) => {
  try {
    const db = req.db;
    const user_id = req.session.user?.user_id;
    const { checkout_id } = req.body;

    console.log("🔵 CREATE RAZORPAY ORDER HIT");
    console.log("User:", user_id);
    console.log("Checkout:", checkout_id);

    /* =========================
       1️⃣ SESSION VALIDATION
    ========================== */
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!checkout_id) {
      return res.status(400).json({
        success: false,
        message: "Checkout ID missing"
      });
    }

    /* =========================
       2️⃣ FETCH FROM CHECKOUT_SESSIONS
       (NOT FROM ORDERS)
    ========================== */
    const [rows] = await db.promise().query(
      `
      SELECT total_amount, status
      FROM checkout_sessions
      WHERE checkout_id = ?
        AND user_id = ?
        AND status = 'ACTIVE'
      LIMIT 1
      `,
      [checkout_id, user_id]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired checkout session"
      });
    }

    const totalAmount = Number(rows[0].total_amount);

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid checkout amount"
      });
    }

    /* =========================
       3️⃣ CREATE RAZORPAY ORDER
    ========================== */
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // ₹ → paisa
      currency: "INR",
      receipt: `receipt_${checkout_id}`
    });

    console.log("✅ Razorpay Order Created:", razorpayOrder.id);

    /* =========================
       4️⃣ SAVE RAZORPAY ORDER ID
       (store in checkout_sessions)
    ========================== */
    await db.promise().query(
      `
      UPDATE checkout_sessions
      SET razorpay_order_id = ?
      WHERE checkout_id = ?
      `,
      [razorpayOrder.id, checkout_id]
    );

    /* =========================
       5️⃣ RETURN TO FRONTEND
    ========================== */
    return res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("🔥 RAZORPAY CREATE ERROR:");
    console.dir(error, { depth: null });

    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order"
    });
  }
});

router.post("/verify-payment", async (req, res) => {
  try {
    const db = req.db;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    /* =========================
       1️⃣ VERIFY SIGNATURE
    ========================== */
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({ success: false });
    }

    /* =========================
       2️⃣ FIND CHECKOUT SESSION
    ========================== */
    const [checkoutRows] = await db.promise().query(
      `
      SELECT *
      FROM checkout_sessions
      WHERE razorpay_order_id = ?
      LIMIT 1
      `,
      [razorpay_order_id]
    );

    if (!checkoutRows.length) {
      return res.json({ success: false });
    }

    const checkout = checkoutRows[0];
    const checkoutId = checkout.checkout_id;
    const userId = checkout.user_id;

    /* =========================
       3️⃣ FETCH CHECKOUT ITEMS
    ========================== */
    const [items] = await db.promise().query(
      `
      SELECT *
      FROM checkout_session_items
      WHERE checkout_id = ?
      `,
      [checkoutId]
    );

    if (!items.length) {
      return res.json({ success: false });
    }

    /* =========================
       4️⃣ CREATE ORDER
    ========================== */
    const orderId = "ORD" + Date.now();

    await db.promise().query(
      `
      INSERT INTO orders
      (
        order_id,
        user_id,
        checkout_id,
        address_id,
        total_amount,
        total_items,
        order_status,
        payment_method,
        payment_status,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      )
      VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', 'RAZORPAY', 'PAID', ?, ?, ?)
      `,
      [
        orderId,
        userId,
        checkoutId,
       checkout.address_id,


        checkout.total_amount,
        checkout.total_items,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      ]
    );

    /* =========================
       5️⃣ INSERT ORDER ITEMS
    ========================== */
    const orderItemValues = items.map(item => [
      orderId,
      userId,
      item.product_id,
      item.product_name,
      item.product_image,
      item.price,
      item.quantity
    ]);

    await db.promise().query(
      `
      INSERT INTO order_items
      (
        order_id,
        user_id,
        product_id,
        product_name,
        product_image,
        price,
        quantity
      )
      VALUES ?
      `,
      [orderItemValues]
    );

    /* =========================
       6️⃣ MARK CHECKOUT COMPLETED
    ========================== */
    await db.promise().query(
      `
      UPDATE checkout_sessions
      SET status = 'COMPLETED'
      WHERE checkout_id = ?
      `,
      [checkoutId]
    );

    /* =========================
   7️⃣ CLEAR CART
========================= */
await db.promise().query(
  `
  DELETE FROM cart
  WHERE user_id = ?
     OR session_id = ?
  `,
  [userId, req.sessionID]
);

/* =========================
   8️⃣ SEND ORDER PLACED EMAIL
========================= */
try {

  // 🔹 1️⃣ Fetch user
  const [userRows] = await db.promise().query(
    `
    SELECT user_email, user_first_name
    FROM user_create_account
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  // 🔹 2️⃣ Fetch order items  🔥 ADD THIS
  const [itemsRows] = await db.promise().query(
    `
    SELECT product_name, quantity, price
    FROM order_items
    WHERE order_id = ?
    `,
    [orderId]
  );

  if (userRows.length > 0) {

    await sendOrderPlacedEmail(
      userRows[0].user_email,
      userRows[0].user_first_name,
      orderId,
      checkout.total_amount,
      checkout.total_items,
      "RAZORPAY",
      razorpay_payment_id,
      itemsRows   // 🔥 VERY IMPORTANT
    );
  }

} catch (mailErr) {
  console.error("Razorpay order email failed:", mailErr);
}

return res.json({ 
  success: true,
  order_id: orderId
});

  } catch (error) {
    console.error("VERIFY ERROR:", error);
    return res.json({ success: false });
  }
});

/* abut us*/

router.get("/about-us", (req, res) => {

  console.log("🔥 ABOUT US PAGE HIT");

  const lang = req.session.lang || "en";
  const baseUrl = process.env.BASE_URL;

  const meta = {
    title: "About Us | AutoKart",
    description:
      "AutoKart Store offers premium automobile accessories across India.",
    keywords:
      "AutoKart, about autokart, car accessories india",
    image: `${baseUrl}/uploads/autokart_logo.jpeg`,
    url: `${baseUrl}/about-us`,
    type: "website"
  };

  const hreflangUrls = [
    { lang: "en", url: `${baseUrl}/about-us?lang=en` },
    { lang: "mr", url: `${baseUrl}/about-us?lang=mr` }
  ];

  const structuredData = [
    generateOrganizationSchema(),
    generateWebSiteSchema()
  ];

  res.render("user/about-us", {
    meta,
    hreflangUrls,
    structuredData,
    currentLang: lang
  });

});


// forgot passworldn 
// router.get("/forgot-password", (req, res) => {
//   res.render("user/forgot_password", {
//     message: null,
//     error: null
//   });
// });



// router.post("/forgot-password", auth.forgotPassword);
// router.get("/reset-password/:token", auth.resetPage);
// router.post("/reset-password", auth.updatePassword);
// // router.get("/reset-password/:token", auth.resetPage);

router.get("/forgot-password", (req, res) => {
  res.render("user/forgot_password", { message: null, error: null });
});

router.post("/forgot-password", authController.forgotPassword);

router.get("/reset-password/:token", authController.resetPage);

router.post("/reset-password", authController.updatePassword);

/* =========================
   BLOG LANGUAGE MIDDLEWARE
========================= */
router.use((req, res, next) => {

  if (req.query.lang) {
    req.session.lang = req.query.lang;
  }

  if (!req.session.lang) {
    req.session.lang = "en";
  }

  res.locals.currentLang = req.session.lang;

  next();
});


/* =========================
   BLOG ROUTES
========================= */


// Blog home page
router.get("/blog", (req, res) => {

  const lang = req.session.lang || "en";

  const meta = {
    title: "Blog - AutoKart",
    description: "Read the latest tips, guides, and news about auto parts and car maintenance from the AutoKart team.",
    keywords: "blog, auto parts, car maintenance, automotive tips, guides"
  };

  const hreflangUrls = [
    { lang: "en", url: `${process.env.BASE_URL}/blog` },
    { lang: "mr", url: `${process.env.BASE_URL}/blog?lang=mr` }
  ];

  const structuredData = generateCollectionPageSchema({
    name: "AutoKart Blog",
    url: `${process.env.BASE_URL}/blog`
  });

  res.render("user/blog/index", {
    meta,
    hreflangUrls,
    structuredData,
    currentLang: lang
  });
});


// Single blog post
router.get("/blog/:slug", (req, res) => {

  const lang = req.session.lang || "en";

  const meta = {
    title: "Blog Post - AutoKart",
    description: "Read detailed blog posts about auto parts and car maintenance.",
    keywords: "blog post, auto parts, car maintenance"
  };

  const hreflangUrls = [
    { lang: "en", url: `${process.env.BASE_URL}/blog/${req.params.slug}` },
    { lang: "mr", url: `${process.env.BASE_URL}/blog/${req.params.slug}?lang=mr` }
  ];

  const structuredData = generateWebSiteSchema();

  res.render("user/blog/post", {
    meta,
    hreflangUrls,
    structuredData,
    currentLang: lang
  });
});


// Blog category page
router.get("/blog/category/:slug", (req, res) => {

  const lang = req.session.lang || "en";

  const meta = {
    title: "Blog Category - AutoKart",
    description: "Browse blog posts by category on AutoKart blog.",
    keywords: "blog category, auto parts, car maintenance"
  };

  const hreflangUrls = [
    { lang: "en", url: `${process.env.BASE_URL}/blog/category/${req.params.slug}` },
    { lang: "mr", url: `${process.env.BASE_URL}/blog/category/${req.params.slug}?lang=mr` }
  ];

  const structuredData = generateCollectionPageSchema({
    name: `Blog Category - ${req.params.slug}`,
    url: `${process.env.BASE_URL}/blog/category/${req.params.slug}`
  });

  res.render("user/blog/category", {
    meta,
    hreflangUrls,
    structuredData,
    currentLang: lang
  });
});


// Blog tag page
router.get("/blog/tag/:slug", (req, res) => {

  const lang = req.session.lang || "en";

  const meta = {
    title: "Blog Tag - AutoKart",
    description: "Browse blog posts by tag on AutoKart blog.",
    keywords: "blog tag, auto parts, car maintenance"
  };

  const hreflangUrls = [
    { lang: "en", url: `${process.env.BASE_URL}/blog/tag/${req.params.slug}` },
    { lang: "mr", url: `${process.env.BASE_URL}/blog/tag/${req.params.slug}?lang=mr` }
  ];

  const structuredData = generateCollectionPageSchema({
    name: `Blog Tag - ${req.params.slug}`,
    url: `${process.env.BASE_URL}/blog/tag/${req.params.slug}`
  });

  res.render("user/blog/tag", {
    meta,
    hreflangUrls,
    structuredData,
    currentLang: lang
  });
});


// API routes
router.get("/api/blog/posts", BlogController.getAllPosts);
router.get("/api/blog/post/:slug", BlogController.getPostBySlug);
router.get("/api/blog/categories", BlogController.getAllCategories);
router.get("/api/blog/tags", BlogController.getAllTags);


/* Review*/

router.post("/submit-review", uploadReviewImage.single("review_image"), (req, res) => {

  if (!req.session.user) {
    return res.redirect("/customer_login");
  }

  const userId = req.session.user.user_id;
  const { product_id, order_id, rating, review_text } = req.body;
  const imageName = req.file ? req.file.filename : null;

  /* ===============================
     1️⃣ VERIFY ORDER BELONGS TO USER
  =============================== */
  const verifySql = `
    SELECT o.order_id
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.order_id = ?
      AND o.user_id = ?
      AND oi.product_id = ?
      AND o.order_status = 'DELIVERED'
  `;

  req.db.query(verifySql, [order_id, userId, product_id], (err, rows) => {

    if (err || rows.length === 0) {
      console.error("❌ Invalid review attempt");
      return res.redirect("/orders");
    }

    /* ===============================
       2️⃣ PREVENT DUPLICATE REVIEW
    =============================== */
    const checkSql = `
      SELECT id FROM product_reviews
      WHERE order_id = ? AND product_id = ? AND user_id = ?
    `;

    req.db.query(checkSql, [order_id, product_id, userId], (err, exists) => {

      if (exists.length > 0) {
        console.log("⚠️ Review already exists");
        return res.redirect("/orders");
      }

      /* ===============================
         3️⃣ INSERT REVIEW
      =============================== */
      const insertSql = `
        INSERT INTO product_reviews
        (product_id, order_id, user_id, rating, review_text, review_image)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      req.db.query(
        insertSql,
        [product_id, order_id, userId, rating, review_text, imageName],
        (err) => {

          if (err) {
            console.error("❌ Review insert error:", err);
          } else {
            console.log("✅ Review saved");
          }

          res.redirect("/orders");
        }
      );

    });

  });

});

module.exports = router;