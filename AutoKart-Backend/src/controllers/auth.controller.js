const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcryptjs = require("bcryptjs");

/* ===============================
   EMAIL SENDER FUNCTION
================================ */
const sendMail = async (to, subject, html) => {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"AutoKart Support" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};


/* ===============================
   FORGOT PASSWORD
================================ */
exports.forgotPassword = async (req, res) => {

  try {

    const { email } = req.body;

    const [rows] = await req.db.promise().query(
      "SELECT * FROM user_create_account WHERE user_email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.render("user/forgot_password", {
        message: null,
        error: "Email not registered"
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await req.db.promise().query(
      `UPDATE user_create_account 
       SET reset_token=?, reset_token_expiry=? 
       WHERE user_email=?`,
      [token, expiryTime, email]
    );

    const resetLink = `${process.env.BASE_URL}/reset-password/${token}`;

    const html = `
      <div style="font-family:Arial;padding:20px">
        <h2 style="color:#ff6600;">AutoKart Password Reset</h2>
        <p>Hello,</p>
        <p>Click below button to reset your password:</p>
        <a href="${resetLink}" 
           style="background:#ff6600;
                  color:white;
                  padding:12px 25px;
                  text-decoration:none;
                  border-radius:5px;">
           Reset Password
        </a>
        <p style="margin-top:20px;">
          This link will expire in 15 minutes.
        </p>
      </div>
    `;

    await sendMail(email, "AutoKart - Password Reset", html);

    res.render("user/forgot_password", {
      message: "Reset link sent to your email",
      error: null
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
};


/* ===============================
   RESET PAGE
================================ */
exports.resetPage = async (req, res) => {

  try {

    const { token } = req.params;

    const [rows] = await req.db.promise().query(
      `SELECT * FROM user_create_account 
       WHERE reset_token=? 
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.send("Invalid or Expired Token");
    }

    res.render("user/reset_password", { token });

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};


/* ===============================
   UPDATE PASSWORD
================================ */
exports.updatePassword = async (req, res) => {

  try {

    const { token, newPassword } = req.body;

    const [rows] = await req.db.promise().query(
      `SELECT * FROM user_create_account 
       WHERE reset_token=? 
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.send("Invalid or Expired Token");
    }

    // 🔥 Direct password store
    await req.db.promise().query(
      `UPDATE user_create_account 
       SET user_password=?, 
           reset_token=NULL, 
           reset_token_expiry=NULL 
       WHERE reset_token=?`,
      [newPassword, token]
    );

    res.redirect("/customer_login");

  

  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};
