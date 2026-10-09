const bcrypt = require("bcrypt");
const db = require("../config/db");

exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM admins WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.send("Admin not found");
    }

    const admin = rows[0];

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.send("Invalid Password");
    }

    /* ✅ Store ONLY what is needed */
    req.session.admin = {
      admin_id: admin.id,
      username: admin.username,
      role: "admin"
    };

    res.redirect("/admin/dashboard");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
