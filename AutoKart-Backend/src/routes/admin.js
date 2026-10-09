const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const generateInvoicePDF = require("../utils/invoice");
const generateDealerPDF = require("../utils/dealerPdf");
const { sendOrderDeliveredEmail } = require("../utils/sendMail");
const BlogController = require("../controllers/blog.controller");
const router = express.Router();

// =========================
// ADMIN SESSION PROTECTION
// =========================
// router.use((req, res, next) => {
//   const openRoutes = ["/login"];

//   if (openRoutes.includes(req.path)) {
//     return next();
//   }

//   if (!req.session.admin) {
//     return res.redirect("/admin/login");
//   }

//   next();
// });
router.use((req, res, next) => {

  const openRoutes = ["/login"];

  if (openRoutes.includes(req.path)) {
    return next();
  }

  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  const currentTime = Date.now();
  const lastActivity = req.session.lastAdminActivity || currentTime;

  if (currentTime - lastActivity > 30 * 60 * 1000) {

    delete req.session.admin;
    delete req.session.lastAdminActivity;

    return res.redirect("/admin/login?timeout=1");
  }

  req.session.lastAdminActivity = currentTime;

  next();
});

// ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc




// =========================
// ADMIN LOGIN PAGE
// =========================
router.get("/login", (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin");
  }
  res.render("admin/login");
});

// =========================
// ADMIN LOGIN POST
// =========================
router.post("/login", async (req, res) => {
  const db = req.db;
  const { username, password } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    // ❌ Username not found
    if (rows.length === 0) {
      return res.redirect("/admin/login?error=notfound");
    }

    const admin = rows[0];

    // ❌ Wrong Password
    if (admin.password !== password) {
      return res.redirect("/admin/login?error=wrongpass");
    }

    // ✅ Login Success
    req.session.admin = admin;
    return res.redirect("/admin?success=1");

  } catch (err) {
    console.error(err);
    return res.redirect("/admin/login?error=server");
  }
});


// =========================
// ADMIN LOGOUT
// =========================
// router.get("/logout", (req, res) => {
//   delete req.session.admin;   // 🔥 only admin session remove
//   res.redirect("/admin/login");
// });

router.get("/logout", (req, res) => {

  delete req.session.admin;
  delete req.session.lastAdminActivity;

  res.redirect("/admin/login");
});














async function getPendingCancelCount(db) {
  const [rows] = await db
    .promise()
    .query(
      "SELECT COUNT(*) AS count FROM order_cancellation_requests WHERE status = 'PENDING'"
    );
  return rows[0].count;
}
// =========================
// ADMIN CANCEL COUNT MIDDLEWARE
// =========================
async function adminCancelCount(req, res, next) {
  try {
    const db = req.db;
    res.locals.cancelCount = await getPendingCancelCount(db);
    next();
  } catch (err) {
    console.error("CancelCount middleware error:", err);
    res.locals.cancelCount = 0;
    next();
  }
}
router.use(adminCancelCount);
/* =========================
   MULTER (ADMIN ONLY)
========================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(
  null,
  path.join(__dirname, "../../../AutoKart-Frontend/public/uploads")),

  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images allowed"), false)
});

/* =========================
   SLIDER MULTER (SEPARATE)
========================= */

const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "../../../AutoKart-Frontend/public/uploads/sliders")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const uploadSlider = multer({
  storage: sliderStorage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images allowed"), false)
});

/* =========================
   VIDEO MULTER (SEPARATE)
========================= */

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(
      null,
      path.join(__dirname, "../../../AutoKart-Frontend/public/uploads/videos")
    ),

  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) =>
    file.mimetype === "video/mp4"
      ? cb(null, true)
      : cb(new Error("Only MP4 videos allowed"), false)
});


/* =========================
   ADMIN DASHBOARD
========================= */

router.get("/", async (req, res) => {
  const db = req.db;

  try {
    

    res.render("admin/dashboard", {
      page: "dashboard",
        // ✅ VERY IMPORTANT
      orders: [],    // ✅ prevent EJS crash
      search: ""     // ✅ prevent EJS crash
    });
  } catch (err) {
    console.error("ADMIN DASHBOARD ERROR:", err);
    res.status(500).send("Admin dashboard error");
  }
});

/* =========================
   ADMIN SLIDERS
========================= */
router.get("/sliders", async (req, res) => {
  const db = req.db;

  try {

    /* existing sliders */
    const [sliders] = await db.promise()
      .query("SELECT * FROM sliders ORDER BY id DESC");

    /* existing videos */
    const [videos] = await db.promise()
      .query("SELECT * FROM homepage_media WHERE type = 'video' ORDER BY id DESC");

    /* 🔥 ADD THIS — LOAD SUB SECTIONS */
    const [subSections] = await db.promise()
      .query("SELECT id, name, section_id, display_slug FROM sub_sections ORDER BY name ASC");

    /* render */
    res.render("admin/dashboard", {
      page: "sliders",
      sliders: sliders || [],
      videos: videos || [],
      subSections: subSections || []   // 🔥 VERY IMPORTANT
    });

  } catch (err) {
    console.error("ADMIN SLIDERS ERROR:", err);

    res.render("admin/dashboard", {
      page: "sliders",
      sliders: [],
      videos: [],
      subSections: []   // 🔥 ALSO ADD HERE
    });
  }
});










router.post(
  "/sliders/add",
  uploadSlider.single("image"),
  (req, res) => {

    const db = req.db;

    if (!req.file) {
      return res.send("Image upload failed");
    }

    const redirect_url = req.body.redirect_url;

    if (!redirect_url) {
      return res.send("Redirect URL missing");
    }

    db.query(
      "INSERT INTO sliders (image, redirect_url, status) VALUES (?, ?, 'active')",
      [req.file.filename, redirect_url],
      err => {
        if (err) {
          console.error("Slider Insert Error:", err);
          return res.send("Slider save failed");
        }

        res.redirect("/admin/sliders");
      }
    );
  }
);

























router.get("/sliders/delete/:id", (req, res) => {
  const db = req.db;
  const sliderId = req.params.id;

  db.query(
    "SELECT image FROM sliders WHERE id = ?",
    [sliderId],
    (err, result) => {
      if (err || !result.length) return res.redirect("/admin/sliders");

     const imagePath = path.join(
  __dirname,
  "../../../AutoKart-Frontend/public/uploads/sliders",
  result[0].image
);


      db.query(
        "DELETE FROM sliders WHERE id = ?",
        [sliderId],
        err => {
          if (err) return res.redirect("/admin/sliders");

          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }

          res.redirect("/admin/sliders");
        }
      );
    }
  );
});
















/* =========================
   HOMEPAGE VIDEO UPLOAD
========================= */

    router.post(
  "/upload-video",
  uploadVideo.single("homepageVideo"),
  (req, res) => {

    const db = req.db;

    if (!req.file) return res.send("Video upload failed");

    const videoPath = "/uploads/videos/" + req.file.filename;

    db.query(
      "INSERT INTO homepage_media (type, file_url) VALUES ('video', ?)",
      [videoPath],
      err => {
        if (err) return res.send("Video save failed");

        res.redirect("/admin/sliders");
      }
    );

  }
);





/* =========================
   HOMEPAGE VIDEO DELETE
========================= */

router.post("/delete-video/:id", (req, res) => {

  const db = req.db;
  const videoId = req.params.id;

  db.query(
    "SELECT file_url FROM homepage_media WHERE id = ?",
    [videoId],
    (err, result) => {

      if (err || !result.length) {
        return res.redirect("/admin/sliders");
      }

      const videoPath = path.join(
        __dirname,
        "../../../AutoKart-Frontend/public",
        result[0].file_url
      );

      db.query(
        "DELETE FROM homepage_media WHERE id = ?",
        [videoId],
        err => {

          if (err) return res.redirect("/admin/sliders");

          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }

          res.redirect("/admin/sliders");
        }
      );
    }
  );
});


router.post('/set-homepage-video/:id', (req, res) => {
  const videoId = req.params.id;

  // Step 1: Sabko inactive karo
  const resetQuery = "UPDATE homepage_media SET is_active = 0";

  req.db.query(resetQuery, (err) => {
    if (err) {
      console.error(err);
      return res.send("Error resetting videos");
    }

    // Step 2: Selected ko active karo
    const setQuery = "UPDATE homepage_media SET is_active = 1 WHERE id = ?";
    req.db.query(setQuery, [videoId], (err2) => {
      if (err2) {
        console.error(err2);
        return res.send("Error setting active video");
      }

      res.redirect('/admin/sliders');
    });
  });
});


/* =========================
   ADMIN PRODUCTS LIST
========================= */

router.get("/products", (req, res) => {
  const db = req.db;

  const sectionQuery = "SELECT id, name FROM sections";

  const productQuery = `
    SELECT 
      p.id,
      p.product_name,
      p.price,
      p.original_price,
      p.discount,
      p.quantity,
      p.image,
      p.section_id,
      p.sub_section_id,
      p.product_description,
      p.display_slug,
      s.name AS section_name
    FROM products p
    JOIN sections s ON p.section_id = s.id
    ORDER BY p.id DESC
  `;

  db.query(sectionQuery, (err, sections) => {
    if (err) return res.send("Error loading sections");

    db.query(productQuery, (err, products) => {
      if (err) return res.send("Error loading products");

      const successMessage = req.session.successMessage;
req.session.successMessage = null;

res.render("admin/dashboard", {
  page: "products",
  sections,
  products,
  successMessage
});



req.session.successMessage = null; // clear after use

      });
    });
  });


/* =========================
   SAVE PRODUCT
========================= */

router.post(
  "/products",
  upload.fields([
    { name: "product_image", maxCount: 1 },
    { name: "gallery_images[]", maxCount: 5 }
  ]),

  
  (req, res) => {

  const db = req.db;
  console.log("REQ BODY:", req.body);

  const {
    section_id,
    sub_section_id,
    product_name,
    price,
    original_price,
    discount,
    quantity,
    product_description
  } = req.body;

  const toNum = v => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const clampPct = v => {
    const n = toNum(v);
    if (n === null) return null;
    return Math.max(0, Math.min(100, n));
  };
  const normalizedOriginal = toNum(original_price);
  const normalizedDiscount = clampPct(discount);
  let normalizedPrice = toNum(price);
  if (normalizedPrice === null && normalizedOriginal !== null) {
    const pct = normalizedDiscount === null ? 0 : normalizedDiscount;
    normalizedPrice = Number((normalizedOriginal * (1 - pct / 100)).toFixed(2));
  }

  if (!section_id) return res.send("Section is required");
  if (!product_name || product_name.trim() === "")
    return res.send("Product name is required");
  if (!quantity || isNaN(quantity))
    return res.send("Quantity is required");
  if (!req.files || !req.files.product_image)
  return res.send("Image upload failed");


function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // remove special characters
    .replace(/\s+/g, "-")       // space → hyphen
    .replace(/--+/g, "-");      // remove duplicate hyphen
}

const displaySlug = generateSlug(product_name);

  const safeSubSectionId =
    sub_section_id && sub_section_id !== ""
      ? parseInt(sub_section_id)
      : null;

  const query = `
    INSERT INTO products
      (section_id, sub_section_id, product_name, price, original_price, discount, quantity, product_description, image, display_slug)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    Number(section_id),
    safeSubSectionId,
    product_name.trim(),
    normalizedPrice,
    normalizedOriginal,
    normalizedDiscount,
    Number(quantity),
    product_description || null,
    req.files.product_image[0].filename,
    displaySlug
  ];

db.query(query, values, (err, result) => {
  if (err) {
    console.error("❌ INSERT ERROR:", err.sqlMessage || err);
    return res.send("Save failed");
  }

  const productId = result.insertId;


 // 👉 SAVE GALLERY IMAGES
if (req.files["gallery_images[]"]) {
  req.files["gallery_images[]"].forEach(file => {
    db.query(
      "INSERT INTO product_images (product_id, image) VALUES (?, ?)",
      [productId, file.filename]
    );
  });
}

req.session.successMessage = "Product added successfully";
res.redirect("/admin/products");

    
});
  }
);

/* =========================
   UPDATE PRODUCT
========================= */
router.post(
  "/products/edit/:id",
  upload.fields([
    { name: "product_image", maxCount: 1 },
    { name: "gallery_images[]", maxCount: 5 }
  ]),
  (req, res) => {
    const db = req.db;
    const productId = req.params.id;

    const {
      section_id,
      sub_section_id,
      product_name,
      price,
      original_price,
      discount,
      quantity,
      product_description,
      delete_images
    } = req.body;
// ✅ regenerate slug when product name changes
const displaySlug = product_name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/--+/g, "-");
    const toNum = v => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const clampPct = v => {
      const n = toNum(v);
      if (n === null) return null;
      return Math.max(0, Math.min(100, n));
    };
    const normalizedOriginal = toNum(original_price);
    const normalizedDiscount = clampPct(discount);
    let normalizedPrice = toNum(price);
    if (normalizedPrice === null && normalizedOriginal !== null) {
      const pct = normalizedDiscount === null ? 0 : normalizedDiscount;
      normalizedPrice = Number((normalizedOriginal * (1 - pct / 100)).toFixed(2));
    }
    let finalOriginal = normalizedOriginal;
    let finalDiscount = normalizedDiscount;
    if (finalOriginal === null && normalizedPrice !== null) {
      finalOriginal = normalizedPrice;
    }
    if (finalDiscount === null) {
      if (finalOriginal !== null && normalizedPrice !== null && finalOriginal > 0) {
        finalDiscount = Math.max(
          0,
          Math.min(
            100,
            Number(((1 - normalizedPrice / finalOriginal) * 100).toFixed(2))
          )
        );
      } else {
        finalDiscount = 0;
      }
    }

    const safeSubSectionId =
      sub_section_id && sub_section_id !== ""
        ? parseInt(sub_section_id)
        : null;

    let query, values;

    if (req.files && req.files.product_image) {
     query = `
  UPDATE products SET
    section_id = ?,
    sub_section_id = ?,
    product_name = ?,
    price = ?,
    original_price = ?,
    discount = ?,
    quantity = ?,
    product_description = ?,
    image = ?,
    display_slug = ?
  WHERE id = ?
`;
      values = [
  section_id,
  safeSubSectionId,
  product_name,
  normalizedPrice,
  finalOriginal,
  finalDiscount,
  quantity,
  product_description,
  req.files.product_image[0].filename,
  displaySlug,
  productId
];
    } else {
     query = `
  UPDATE products SET
    section_id = ?,
    sub_section_id = ?,
    product_name = ?,
    price = ?,
    original_price = ?,
    discount = ?,
    quantity = ?,
    product_description = ?,
    display_slug = ?
  WHERE id = ?
`;
     values = [
  section_id,
  safeSubSectionId,
  product_name,
  normalizedPrice,
  finalOriginal,
  finalDiscount,
  quantity,
  product_description,
  displaySlug,
  productId
];
    }

    db.query(query, values, err => {
      if (err) {
        console.error("❌ UPDATE ERROR:", err);
        return res.send("Update failed");
      }

      // DELETE SELECTED GALLERY IMAGES
      if (delete_images) {
        const ids = Array.isArray(delete_images)
          ? delete_images
          : [delete_images];

        db.query(
          "DELETE FROM product_images WHERE id IN (?)",
          [ids]
        );
      }

      // 👉 REPLACE GALLERY IMAGES (NOT APPEND)
if (req.files && req.files["gallery_images[]"]) {

  // 1️⃣ DELETE OLD GALLERY IMAGES
  db.query(
    "DELETE FROM product_images WHERE product_id = ?",
    [productId],
    err => {
      if (err) {
        console.error("❌ GALLERY DELETE ERROR:", err);
      }

      // 2️⃣ INSERT NEW GALLERY IMAGES
      req.files["gallery_images[]"].forEach(file => {
        db.query(
          "INSERT INTO product_images (product_id, image) VALUES (?, ?)",
          [productId, file.filename]
        );
      });
    }
  );
}
req.session.successMessage = "Product Edited successfully";
res.redirect("/admin/products");




    });
  }
);


/* =========================
   DELETE PRODUCT
========================= */

router.get("/products/delete/:id", (req, res) => {
  const db = req.db;
  const productId = req.params.id;

  db.query(
    "SELECT image FROM products WHERE id = ?",
    [productId],
    (err, result) => {
      if (err || !result.length)
        return res.send("Product not found");

      const imagePath = path.join(
  __dirname,
  "../../../AutoKart-Frontend/public/uploads",
  result[0].image
);


      db.query(
        "DELETE FROM products WHERE id = ?",
        [productId],
        err => {
          if (err) return res.send("Delete failed");

          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
          res.redirect("/admin/products");
        }
      );
    }
  );
});

/* =========================
   API: SUB-SECTIONS
========================= */

router.get("/api/subsections/:sectionId", (req, res) => {
  const db = req.db;

  db.query(
    "SELECT id, name, display_slug FROM sub_sections WHERE section_id = ?",
    [req.params.sectionId],
    (err, results) => {
      if (err) return res.json([]);
      res.json(results);
    }
  );
});


/* =========================
   ADMIN ORDERS
========================= */
router.get("/orders", async (req, res) => {
  const db = req.db;

  const search = req.query.search || "";
    const status = req.query.status || "";
  const page = parseInt(req.query.page) || 1;

  const limit = 15;
  const offset = (page - 1) * limit;

  const searchValue = `%${search}%`;

  try {
    /* =========================
       1️⃣ MAIN ORDERS QUERY
       🔴 Cancel Requested FIRST
       📄 Pagination applied
    ========================= */
    const ordersQuery = `
      SELECT
        o.order_id,
        o.order_status,
        o.payment_method,
        o.payment_status,
        o.created_at,

        u.user_first_name,
        u.user_last_name,
        u.user_mobile,

        COUNT(oi.id) AS total_items,

        -- 🔥 CANCEL REQUEST FLAG
        MAX(
          CASE
            WHEN ocr.status = 'PENDING' THEN 1
            ELSE 0
          END
        ) AS has_cancel_request

      FROM orders o

      JOIN user_create_account u
        ON o.user_id = u.user_id

      LEFT JOIN order_items oi
        ON o.order_id = oi.order_id

      LEFT JOIN order_cancellation_requests ocr
        ON o.order_id = ocr.order_id

      WHERE
(
  o.order_id LIKE ?
  OR u.user_mobile LIKE ?
  OR LOWER(CONCAT(u.user_first_name, ' ', u.user_last_name)) LIKE ?
)
AND
( ? = '' OR o.order_status = ? )

      GROUP BY
        o.order_id,
        o.order_status,
        o.payment_method,
        o.payment_status,
        o.created_at,
        u.user_first_name,
        u.user_last_name,
        u.user_mobile

   ORDER BY o.order_id DESC
         -- latest first

      LIMIT ? OFFSET ?
    `;

    const [orders] = await db.promise().query(ordersQuery, [
  searchValue,
  searchValue,
  searchValue,
  status,
  status,
  limit,
  offset
]);

    /* =========================
       2️⃣ TOTAL COUNT QUERY
       (For pagination)
    ========================= */
    const countQuery = `
      SELECT COUNT(DISTINCT o.order_id) AS total
      FROM orders o
      JOIN user_create_account u
        ON o.user_id = u.user_id
      WHERE
        o.order_id LIKE ?
        OR u.user_mobile LIKE ?
        OR LOWER(CONCAT(u.user_first_name, ' ', u.user_last_name)) LIKE ?
    `;

    const [[{ total }]] = await db.promise().query(countQuery, [
      searchValue,
      searchValue,
      searchValue
    ]);

    const totalPages = Math.ceil(total / limit);

    /* =========================
       3️⃣ RENDER
    ========================= */
    res.render("admin/dashboard", {
  page: "orders",
  orders,
  search,
  status,            
  pageNumber: page,
  totalPages
});

  } catch (err) {
    console.error("❌ ORDERS FETCH ERROR:", err);
    res.send("Error loading orders");
  }

});


router.get("/orders/:orderId/invoice", (req, res) => {
  const db = req.db;
  const orderId = req.params.orderId;

  const orderSql = `
    SELECT
      o.order_id,
      o.created_at,
      o.payment_method,
      o.payment_status,
      o.razorpay_payment_id,   
      a.full_name,
      a.mobile,
      a.address_type,
      a.address_line,
      a.city,
      a.state,
      a.pincode
    FROM orders o
    JOIN user_create_account u 
      ON o.user_id = u.user_id
    LEFT JOIN user_addresses a
      ON o.address_id = a.address_id
    WHERE o.order_id = ?
    LIMIT 1
  `;

  db.query(orderSql, [orderId], (err, orderRows) => {
    if (err || orderRows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const order = orderRows[0];

    const itemsSql = `
      SELECT product_name, price, quantity
      FROM order_items
      WHERE order_id = ?
    `;

    db.query(itemsSql, [orderId], (err, items) => {
      if (err || items.length === 0) {
        return res.status(404).send("No items found");
      }

      let totalAmount = 0;

      items.forEach(i => {
        totalAmount += Number(i.price) * Number(i.quantity);
      });

      generateInvoicePDF(res, order, items, totalAmount);
    });
  });
});
/* =========================
   ADMIN VIEW ORDER
========================= */

router.get("/orders/:order_id", (req, res) => {
  const db = req.db;
  const orderId = req.params.order_id;

  const orderQuery = `
  SELECT 
    o.order_id,
    o.order_status,
    o.payment_method,
    o.payment_status,
    o.created_at,

    u.user_first_name,
    u.user_last_name,
    u.user_mobile,
    u.user_email,

    -- 📍 ADDRESS DATA
    a.full_name AS address_name,
    a.mobile AS address_mobile,
    a.address_line,
    a.landmark,
    a.city,
    a.state,
    a.pincode,
    a.address_type

  FROM orders o
  JOIN user_create_account u 
    ON o.user_id = u.user_id
  LEFT JOIN user_addresses a

    ON o.address_id = a.address_id

  WHERE o.order_id = ?
`;

  const itemsQuery = `
    SELECT 
      product_name,
      product_image,
      price,
      quantity
    FROM order_items
    WHERE order_id = ?
  `;
db.query(orderQuery, [orderId], (err, orderResult) => {
  if (err || orderResult.length === 0) {
    return res.send("Order not found");
  }

  db.query(itemsQuery, [orderId], async (err, items) => {
    if (err) {
      return res.send("Error loading order items");
    }

    // 🔹 Calculate total amount
    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += item.price * item.quantity;
    });

    // 🔹 Fetch pending cancellation request (if any)
    const cancelQuery = `
      SELECT reason, description, created_at
      FROM order_cancellation_requests
      WHERE order_id = ?
        AND status = 'PENDING'
      LIMIT 1
    `;

    db.query(cancelQuery, [orderId], async (err, cancelRows) => {
      if (err) {
        console.error("❌ CANCEL REQUEST FETCH ERROR:", err);
        return res.send("Error loading cancellation request");
      }

      const cancelRequest =
        cancelRows && cancelRows.length > 0 ? cancelRows[0] : null;

    

      // 🔹 Final render
      res.render("admin/dashboard", {
        page: "order-view",
        order: {
          ...orderResult[0],
          calculated_total: totalAmount
        },
        items,
        cancelRequest,
        
      });
    });
  });
});
});

/* =========================
   UPDATE ORDER STATUS
========================= */
router.post("/orders/:order_id/status", async (req, res) => {
  const db = req.db;
  const orderId = req.params.order_id;
  const { order_status } = req.body;

  try {
    /* =========================
       1️⃣ FETCH CURRENT ORDER
    ========================= */
    const [orderRows] = await db
      .promise()
      .query(
        "SELECT order_status, stock_deducted FROM orders WHERE order_id = ?",
        [orderId]
      );

    if (orderRows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const previousStatus = orderRows[0].order_status;
    const stockDeducted = orderRows[0].stock_deducted;

    /* =========================
       2️⃣ BLOCK INVALID CHANGES
    ========================= */
    if (previousStatus === "DELIVERED" || previousStatus === "CANCELLED") {
      return res.send("Order status cannot be changed");
    }

    /* =========================
       3️⃣ UPDATE ORDER STATUS
    ========================= */
    await db
      .promise()
      .query(
        "UPDATE orders SET order_status = ? WHERE order_id = ?",
        [order_status, orderId]);
        if (order_status === "CANCELLED") {

  // 1️⃣ Mark cancellation request as APPROVED
  await db
    .promise()
    .query(
      `
      UPDATE order_cancellation_requests
      SET status = 'APPROVED'
      WHERE order_id = ?
        AND status = 'PENDING'
      `,
      [orderId]
    );

  // 2️⃣ Restore stock ONLY if it was deducted
  if (stockDeducted === 1) {
    const [items] = await db
      .promise()
      .query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [orderId]
      );

    for (const item of items) {
      await db
        .promise()
        .query(
          `
          UPDATE products
          SET quantity = quantity + ?
          WHERE id = ?
          `,
          [item.quantity, item.product_id]
        );
    }

    // 3️⃣ Mark stock as restored
    await db
      .promise()
      .query(
        "UPDATE orders SET stock_deducted = 0 WHERE order_id = ?",
        [orderId]
      );
  }
     }

      
    /* =========================
       4️⃣ DEDUCT STOCK (ONLY ONCE)
       👉 ONLY WHEN MOVING TO SHIPPED
    ========================= */
    if (
      previousStatus !== "SHIPPED" &&
      order_status === "SHIPPED" &&
      stockDeducted === 0
    ) {
      const [items] = await db
        .promise()
        .query(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
          [orderId]
        );

      for (const item of items) {
        const [result] = await db.promise().query(
          `
          UPDATE products
          SET quantity = quantity - ?
          WHERE id = ?
            AND quantity >= ?
          `,
          [item.quantity, item.product_id, item.quantity]
        );

        if (result.affectedRows === 0) {
          return res.send("Insufficient stock for one or more products");
        }
      }

      // ✅ Mark stock as deducted
      await db
        .promise()
        .query(
          "UPDATE orders SET stock_deducted = 1 WHERE order_id = ?",
          [orderId]
        );
    }

/* =========================
   5️⃣ AUTO PAY COD ON DELIVERY
========================= */

if (order_status === "DELIVERED") {

  // 1️⃣ Mark Payment Paid
  await db.promise().query(
    "UPDATE orders SET payment_status = 'PAID' WHERE order_id = ?",
    [orderId]
  );

  // 2️⃣ Fetch order + user details
  const [orderRows] = await db.promise().query(
    `
    SELECT 
      o.total_amount,
      o.payment_method,
      o.razorpay_payment_id,
      u.user_email,
      u.user_first_name
    FROM orders o
    JOIN user_create_account u 
      ON o.user_id = u.user_id
    WHERE o.order_id = ?
    LIMIT 1
    `,
    [orderId]
  );

  if (orderRows.length > 0) {

    const order = orderRows[0];

    // 3️⃣ Get total quantity
    const [qtyRows] = await db.promise().query(
      `
      SELECT SUM(quantity) AS totalItems
      FROM order_items
      WHERE order_id = ?
      `,
      [orderId]
    );

    const totalItems = qtyRows[0].totalItems || 0;

    // 4️⃣ 🔥 Fetch order items (ADD THIS)
    const [itemsRows] = await db.promise().query(
      `
      SELECT product_name, quantity, price
      FROM order_items
      WHERE order_id = ?
      `,
      [orderId]
    );

    // 5️⃣ Send delivered email with products
    await sendOrderDeliveredEmail(
      order.user_email,
      order.user_first_name,
      orderId,
      order.total_amount,
      totalItems,
      order.payment_method,
      order.razorpay_payment_id,
      itemsRows   // 🔥 VERY IMPORTANT
    );
  }
}

    /* =========================
       6️⃣ REDIRECT BACK
    ========================= */
    return res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error("❌ ORDER STATUS UPDATE ERROR:", err);
    return res.send("Status update failed");
  }
});


/* =========================
   ADMIN → DEALER REQUESTS LIST
========================= */
router.get("/dealer_requests", (req, res) => {
  const db = req.db;

  const dealersQuery = `
    SELECT * FROM dealers
    ORDER BY created_at DESC
  `;

  const summaryQuery = `
    SELECT
      COUNT(*) AS total,
      SUM(status = 'pending') AS pending,
      SUM(status = 'approved') AS approved,
      SUM(status = 'rejected') AS rejected
    FROM dealers
  `;

  db.query(dealersQuery, (err, dealers) => {
    if (err) return res.send("Error loading dealer requests");

    db.query(summaryQuery, (err, result) => {
      if (err) return res.send("Error loading summary");

      res.render("admin/dashboard", {
        page: "dealers",
        dealers,
        summary: result[0]
      });
    });
  });
});


/* =========================
   ADMIN → APPROVE
========================= */
router.post("/dealer/approve", (req, res) => {
  const db = req.db;
  const { dealer_id } = req.body;

  db.query(
    "UPDATE dealers SET status = 'approved' WHERE id = ?",
    [dealer_id],
    () => res.redirect("/admin/dealer_requests")
  );
});


/* =========================
   ADMIN → REJECT
========================= */
router.post("/dealer/reject", (req, res) => {
  const db = req.db;
  const { dealer_id, rejection_reason } = req.body;

  db.query(
    `UPDATE dealers
     SET status = 'rejected',
         rejection_reason = ?
     WHERE id = ?`,
    [rejection_reason, dealer_id],
    () => res.redirect("/admin/dealer_requests")
  );
});


/* =========================
   ADMIN → PDF
========================= */
router.get("/dealer/:id/pdf", (req, res) => {
  const db = req.db;
  const dealerId = req.params.id;

  db.query(
    "SELECT * FROM dealers WHERE id = ?",
    [dealerId],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(404).send("Dealer not found");
      }

      generateDealerPDF(res, rows[0]);
    }
  );
});

// USER LIST
router.get("/user", async (req, res) => {
  const db = req.db;

  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const search = req.query.search || "";
  const searchValue = `%${search}%`;

  try {
    /* =========================
       FETCH USERS (PAGINATED)
    ========================= */
    const [users] = await db.promise().query(
      `
      SELECT 
        user_id,
        user_first_name,
        user_last_name,
        user_mobile,
        user_email
      FROM user_create_account
      WHERE user_mobile LIKE ?
      ORDER BY user_id DESC
      LIMIT ? OFFSET ?
      `,
      [searchValue, limit, offset]
    );

    /* =========================
       COUNT TOTAL USERS
    ========================= */
    const [[{ total }]] = await db.promise().query(
      `
      SELECT COUNT(*) AS total
      FROM user_create_account
      WHERE user_mobile LIKE ?
      `,
      [searchValue]
    );

    const totalPages = Math.ceil(total / limit);

    res.render("admin/dashboard", {
      page: "user_details",
      users,
      currentPage: page,
      totalPages,
      search
    });

  } catch (err) {
    console.error("USER LIST ERROR:", err);
    res.send("Error loading users");
  }
});










router.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  const sql = `
SELECT 
  u.user_id,
  u.user_first_name,
  u.user_last_name,
 
  u.user_email,

  -- 🛒 CART DATA
  c.product_id AS cart_product_id,
  cp.product_name AS cart_product_name,
  cp.price AS cart_price,
  c.quantity AS cart_qty,

  -- 📦 ORDER DATA
  oi.product_id AS order_product_id,
  p.product_name AS order_product_name,
  oi.price AS order_price,
  oi.quantity AS order_qty,
  o.created_at AS order_date,

  -- 💳 PAYMENT DATA
  o.payment_method,
  o.payment_status

FROM user_create_account u

LEFT JOIN cart c 
  ON c.user_id = u.user_id

LEFT JOIN products cp 
  ON cp.id = c.product_id

LEFT JOIN orders o 
  ON o.user_id = u.user_id

LEFT JOIN order_items oi 
  ON oi.order_id = o.order_id

LEFT JOIN products p 
  ON p.id = oi.product_id

WHERE u.user_id = ?
ORDER BY
  has_cancel_request DESC,
  o.created_at DESC

`;

  req.db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.log(err);
      return res.send("DB Error");
    }

    res.render("admin/dashboard", {
      page: "user_view",
      data: rows
    });
  });
});



















// shop all session start 



const shopSliderStorage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(
      null,
      path.join(
        __dirname,
        "../../../AutoKart-Frontend/public/uploads/shop_sliders"
      )
    ),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const uploadShopSlider = multer({
  storage: shopSliderStorage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images allowed"), false)
});








/* =========================
   ADMIN → BUSINESS OVERVIEW
========================= */
router.get("/overview", async (req, res) => {
  const db = req.db;
const { from, to } = req.query;

/* ---------- ORDER DATE FILTER ---------- */
let orderFilterSQL = "";
let orderParams = [];

if (from && to) {
  orderFilterSQL = " AND DATE(o.created_at) BETWEEN ? AND ? ";
  orderParams = [from, to];
}

/* ---------- USER DATE FILTER ---------- */
let userFilterSQL = "";
let userParams = [];

if (from && to) {
  userFilterSQL = " WHERE DATE(created_at) BETWEEN ? AND ? ";
  userParams = [from, to];
}

  try {

    /* =============================
       1️⃣ TOTAL DELIVERED ORDERS
    ============================= */
  const [[deliveredOrders]] = await db.promise().query(`
  SELECT COUNT(*) AS count
  FROM orders o
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
`, orderParams);



    /* =============================
       2️⃣ TOTAL USERS
    ============================= */
    const [[totalUsers]] = await db.promise().query(`
      SELECT COUNT(*) AS count
      FROM user_create_account
    `);


    /* =============================
       3️⃣ TOTAL ITEMS SOLD (DELIVERED ONLY)
    ============================= */
  const [[itemsSold]] = await db.promise().query(`
  SELECT IFNULL(SUM(oi.quantity),0) AS total
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
`, orderParams);


    /* =============================
       4️⃣ TOTAL REVENUE (DELIVERED ONLY)
    ============================= */
  const [[revenue]] = await db.promise().query(`
  SELECT IFNULL(SUM(oi.price * oi.quantity),0) AS total
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
`, orderParams);


    /* =============================
       5️⃣ MONTHLY REVENUE (DELIVERED ONLY)
    ============================= */
const [monthlyRows] = await db.promise().query(`
  SELECT 
    DATE_FORMAT(o.created_at,'%m') AS month_num,
    DATE_FORMAT(o.created_at,'%b') AS month_label,
    SUM(oi.price * oi.quantity) AS revenue
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
  GROUP BY month_num, month_label
  ORDER BY month_num
`, orderParams);

/* =============================
   5️⃣B MONTHLY NEW USERS
============================= */
const [monthlyUsers] = await db.promise().query(`
  SELECT
    DATE_FORMAT(created_at,'%m') AS month_num,
    DATE_FORMAT(created_at,'%b') AS month_label,
    COUNT(*) AS users
  FROM user_create_account
  ${userFilterSQL}
  GROUP BY month_num, month_label
  ORDER BY month_num
`, userParams);

/* =============================
   5️⃣C MONTHLY ITEMS SOLD
============================= */
const [monthlyItems] = await db.promise().query(`
  SELECT
    DATE_FORMAT(o.created_at,'%m') AS month_num,
    DATE_FORMAT(o.created_at,'%b') AS month_label,
    SUM(oi.quantity) AS items
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
  GROUP BY month_num, month_label
  ORDER BY month_num
`, orderParams);


    /* =============================
       6️⃣ SECTION-WISE ORDERS (DELIVERED ONLY)
    ============================= */
const [sectionRows] = await db.promise().query(`
  SELECT 
    s.name AS section,
    COUNT(DISTINCT o.order_id) AS total_orders
  FROM orders o
  JOIN order_items oi ON o.order_id = oi.order_id
  JOIN products p ON oi.product_id = p.id
  JOIN sections s ON p.section_id = s.id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
  GROUP BY s.name
  ORDER BY total_orders DESC
`, orderParams);

/* =============================
   7️⃣ SUBSECTION-WISE ORDERS (DELIVERED ONLY)
============================= */
const [subSectionRows] = await db.promise().query(`
  SELECT
    s.id AS section_id,
    s.name AS section_name,
    ss.id AS subsection_id,
    ss.name AS subsection_name,
    COUNT(DISTINCT o.order_id) AS total_orders
  FROM orders o
  JOIN order_items oi  ON o.order_id = oi.order_id
  JOIN products p      ON oi.product_id = p.id
  JOIN sections s      ON p.section_id = s.id
  LEFT JOIN sub_sections ss ON p.sub_section_id = ss.id
  WHERE o.order_status='DELIVERED' ${orderFilterSQL}
  GROUP BY s.id, ss.id
  ORDER BY s.id
`, orderParams);




/* =============================
   FORMAT → SECTION → SUBSECTION PIES
============================= */

const sectionSubsectionMap = {};

subSectionRows.forEach(row => {

  // create section group if not exists
  if (!sectionSubsectionMap[row.section_id]) {
    sectionSubsectionMap[row.section_id] = {
      section: row.section_name,
      labels: [],
      data: []
    };
  }

  // ignore NULL subsections
  if (row.subsection_name) {
    sectionSubsectionMap[row.section_id].labels.push(row.subsection_name);
    sectionSubsectionMap[row.section_id].data.push(row.total_orders);
  }
});

// convert object → array for EJS loop
const subsectionCharts = Object.values(sectionSubsectionMap);


    /* =============================
       FORMAT 12 MONTHS (SHOW EMPTY MONTHS)
    ============================= */
    const allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const revenueMap = {};
    monthlyRows.forEach(r => {
      revenueMap[r.month_label] = Number(r.revenue);
    });

const months = [];
const sales  = [];
const users  = [];
const items = [];

/* ---- Build Users Map FIRST ---- */
const usersMap = {};
monthlyUsers.forEach(r => {
  usersMap[r.month_label] = Number(r.users);
});
const itemsMap = {};
monthlyItems.forEach(r => {
  itemsMap[r.month_label] = Number(r.items);
});

/* ---- Now fill all 12 months ---- */
allMonths.forEach(m => {
  months.push(m);

  sales.push(revenueMap[m] ?? null);
  users.push(usersMap[m] ?? null);
  items.push(itemsMap[m] ?? null);   // ← NEW
});


    /* =============================
       FORMAT PIE DATA
    ============================= */
    const sectionLabels = sectionRows.map(r => r.section);
    const sectionCounts = sectionRows.map(r => r.total_orders);



  /* =============================
   RENDER DASHBOARD
============================= */
res.render("admin/dashboard", {
  page: "overview",

  stats: {
    deliveredOrders: deliveredOrders.count,
    totalUsers: totalUsers.count,
    totalItemsSold: itemsSold.total,
    totalRevenue: revenue.total
  },

 charts: {
  months,
  sales,
  users, 
    items,  // 👈 ADD THIS
  sections: sectionLabels,
  sectionCounts: sectionCounts
},


  // 👇 NEW DATA FOR MULTIPLE PIE CHARTS
  subsectionCharts
});


  } catch (err) {
    console.error("❌ OVERVIEW ERROR:", err);
    res.send("Overview Failed");
  }
});

// new session start top selling kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk

// top-selling-slider session start 
router.get("/middle-banner", (req, res) => {

  // 🔥 1️⃣ First fetch sections
  req.db.query(
    "SELECT id, name, display_slug FROM sections",
    (err, sections) => {

      if (err) {
        console.error("SECTION ERROR:", err);
        sections = [];
      }

      // 🔥 2️⃣ Then fetch top selling sliders
      req.db.query(
        "SELECT * FROM top_selling_sliders ORDER BY id DESC",
        (err, rows) => {

          if (err) {
            console.error(err);
            return res.send("Database error");
          }

          res.render("admin/dashboard", {
            page: "top_selling_slider",  // must match include name
            sliders: rows || [],
            sections: sections || []      // 👈 VERY IMPORTANT
          });

        }
      );

    }
  );

});


router.post("/middle-banner/upload", async (req, res) => {
  try {
    const { croppedImage, redirect_url } = req.body;

    if (!croppedImage || !redirect_url) {
      return res.send("Image or Redirect URL missing");
    }

    // Ensure we received a valid base64 image
    if (!croppedImage.startsWith("data:image")) {
      return res.send("Invalid image data received");
    }

    /* =========================
       GENERATE FILE NAME
    ========================= */
    const fileName = "top_" + Date.now() + ".jpg";

    /* =========================
       RESOLVE ABSOLUTE PATH
    ========================= */
 // Always resolve from project root (AutoKart-Backend)
const uploadDir = path.join(
  process.cwd(),
   "../AutoKart-Frontend/public/uploads/middle-banner"
);

    // Ensure folder exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadPath = path.join(uploadDir, fileName);

    /* =========================
       SAFE BASE64 → BUFFER CONVERSION
    ========================= */
    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, "");

    const imageBuffer = Buffer.from(base64Data, "base64");

    // Write binary file correctly
    fs.writeFileSync(uploadPath, imageBuffer);

    console.log("✅ Image Saved:", uploadPath, imageBuffer.length, "bytes");

    /* =========================
       INSERT DATABASE RECORD
    ========================= */
    await new Promise((resolve, reject) => {
      req.db.query(
        "INSERT INTO top_selling_sliders (image, redirect_url) VALUES (?, ?)",
        [fileName, redirect_url],
        (err) => (err ? reject(err) : resolve())
      );
    });

    res.redirect("/admin/middle-banner");

  } catch (error) {
    console.error("🔥 TOP SELLING UPLOAD FAILED:", error);
    res.status(500).send("Upload failed. Check server log.");
  }
});


router.post("/middle-banner/delete/:id", (req, res) => {

  const db = req.db;
  const id = req.params.id;

  // 1️⃣ Get image name first
  db.query(
    "SELECT image FROM top_selling_sliders WHERE id = ?",
    [id],
    (err, result) => {

      if (err || result.length === 0) {
        console.error("Fetch error:", err);
        res.redirect("/admin/middle-banner");
      }

      const imageName = result[0].image;

      const imagePath = path.join(
        __dirname,
        "../../../AutoKart-Frontend/public/uploads/middle-banner",
        imageName
      );

      // 2️⃣ Delete from DB
      db.query(
        "DELETE FROM top_selling_sliders WHERE id = ?",
        [id],
        (err) => {

          if (err) {
            console.error("Delete error:", err);
            return res.redirect("/admin/middle-banner");
          }

          // 3️⃣ Delete image file
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }

          res.redirect("/admin/middle-banner");
        }
      );

    }
  );

});

/* =========================
   BLOG ADMIN ROUTES
========================= */

// Blog posts listing
router.get("/blog", (req, res) => {
  res.render("admin/dashboard", { page: "blog" });
});

// Create new blog post
router.get("/blog/create", (req, res) => {
  res.render("admin/dashboard", { page: "blog-create" });
});

// Edit blog post
router.get("/blog/edit/:id", (req, res) => {
  res.render("admin/dashboard", { page: "blog-edit" });
});

// API routes for blog admin
router.get("/api/blog/posts", BlogController.adminGetAllPosts);
router.get("/api/blog/post/:id", BlogController.adminGetPost);
router.post("/api/blog/post", BlogController.createPost);
router.put("/api/blog/post/:id", BlogController.updatePost);
router.delete("/api/blog/post/:id", BlogController.deletePost);

router.get("/api/blog/categories", BlogController.adminGetAllCategories);
router.get("/api/blog/tags", BlogController.adminGetAllTags);
module.exports = router;