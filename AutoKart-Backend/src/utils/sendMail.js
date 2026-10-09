const nodemailer = require("nodemailer");

/* =========================
   TRANSPORTER
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   ORIGINAL GENERIC FUNCTION
   (OLD LOGIC SAFE)
========================= */
const sendMail = async (options) => {
  try {
    await transporter.sendMail({
      from: `"AutoKart Support" <${process.env.EMAIL_USER}>`,
      ...options
    });

    console.log("✅ Email sent to:", options.to);
  } catch (error) {
    console.error("❌ Email Error:", error.message);
  }
};

/* =========================
   ORDER PLACED TEMPLATE
========================= */
const sendOrderPlacedEmail = async (
  email,
  name,
  orderId,
  amount,
  totalItems,
  paymentMethod,
  razorpayPaymentId = null,
  items = []   // 🔥 ADD THIS
) => {

  const productRows = items.map(item => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${item.product_name}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">
        ₹${Number(item.price).toLocaleString("en-IN")}
      </td>
    </tr>
  `).join("");

  return sendMail({
    to: email,
    subject: `Your Order #${orderId} Has Been Placed 🛒`,
    html: `
      <div style="font-family: Arial; padding:20px;">

        <h2 style="color:#2e86de;">Order Placed Successfully</h2>

        <p>Hello <b>${name}</b>,</p>
        <p>Your order has been placed successfully.</p>

        <div style="background:#f4f6f7;padding:15px;border-radius:8px;">
          <p><b>Order ID:</b> ${orderId}</p>
          <p><b>Total Quantity:</b> ${totalItems}</p>
          <p><b>Total Amount:</b> ₹${Number(amount).toLocaleString("en-IN")}</p>
          <p><b>Payment Method:</b> ${paymentMethod}</p>
          ${
            paymentMethod === "RAZORPAY"
              ? `<p><b>Payment ID:</b> ${razorpayPaymentId}</p>`
              : ""
          }
        </div>

        <br/>
        <h3>Order Items</h3>

        <table style="border-collapse:collapse;width:100%;">
          <tr style="background:#eee;">
            <th style="padding:8px;border:1px solid #ddd;">Product</th>
            <th style="padding:8px;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;">Price</th>
          </tr>
          ${productRows}
        </table>

        <br/>
        <p>We will notify you once delivered.</p>

      </div>
    `
  });
};



/* =========================
   ORDER DELIVERED TEMPLATE
========================= */
const sendOrderDeliveredEmail = async (
  email,
  name,
  orderId,
  amount,
  totalItems,
  paymentMethod,
  razorpayPaymentId = null,
  items = []   // 🔥 ADD THIS
) => {

  const productRows = items.map(item => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${item.product_name}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">
        ₹${Number(item.price).toLocaleString("en-IN")}
      </td>
    </tr>
  `).join("");

  return sendMail({
    to: email,
    subject: `Your Order #${orderId} Has Been Delivered 🎉`,
    html: `
      <div style="font-family: Arial; padding:20px;">

        <h2 style="color:#27ae60;">Order Delivered 🎉</h2>

        <p>Hello <b>${name}</b>,</p>
        <p>Your order has been delivered successfully.</p>

        <div style="background:#f4f6f7;padding:15px;border-radius:8px;">
          <p><b>Order ID:</b> ${orderId}</p>
          <p><b>Total Quantity:</b> ${totalItems}</p>
          <p><b>Total Amount:</b> ₹${Number(amount).toLocaleString("en-IN")}</p>
          <p><b>Payment Method:</b> ${paymentMethod}</p>
          ${
            paymentMethod === "RAZORPAY"
              ? `<p><b>Payment ID:</b> ${razorpayPaymentId}</p>`
              : ""
          }
        </div>

        <br/>
        <h3>Delivered Items</h3>

        <table style="border-collapse:collapse;width:100%;">
          <tr style="background:#eee;">
            <th style="padding:8px;border:1px solid #ddd;">Product</th>
            <th style="padding:8px;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;">Price</th>
          </tr>
          ${productRows}
        </table>

        <br/>
        <p>Thank you for shopping with AutoKart!</p>

      </div>
    `
  });
};

module.exports = {
  sendMail, // 🔥 OLD FUNCTION SAFE
  sendOrderPlacedEmail,
  sendOrderDeliveredEmail
};