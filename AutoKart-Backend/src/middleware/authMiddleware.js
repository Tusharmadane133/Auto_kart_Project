// ===============================
// Admin Session Verification Middleware
// ===============================

exports.verifyAdmin = (req, res, next) => {
  // No session OR no admin logged in
  if (!req.session || !req.session.admin) {
    return res.redirect("/admin/login");
  }

  // Attach admin data to request (for views / logging)
  req.admin = req.session.admin;

  next();
};
