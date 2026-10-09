exports.submitReview = async (req, res) => {
  const db = req.db;
  const user_id = req.session.user?.user_id;

  const { product_id, order_id, rating, review_text } = req.body;

  if (!user_id) return res.redirect("/customer_login");

  // ✅ VERIFY ORDER BELONGS TO USER & IS DELIVERED
  const [order] = await db.promise().query(`
      SELECT * FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      WHERE o.order_id = ?
      AND o.user_id = ?
      AND oi.product_id = ?
      AND o.order_status = 'Delivered'
  `,[order_id, user_id, product_id]);

  if (!order.length) {
      return res.send("Invalid review attempt");
  }

  let image = req.file ? req.file.filename : null;

  await db.promise().query(`
      INSERT INTO product_reviews
      (product_id, order_id, user_id, rating, review_text, review_image)
      VALUES (?,?,?,?,?,?)
  `,[product_id, order_id, user_id, rating, review_text, image]);

  res.redirect("/orders");
};