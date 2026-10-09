const multer = require("multer");
const path = require("path");
const fs = require("fs");

const reviewDir = path.join(__dirname, "../../../AutoKart-Frontend/public/uploads/reviews");

if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewDir),
  filename: (req, file, cb) => {
    const unique = "review_" + Date.now() + path.extname(file.originalname);
    cb(null, unique);
  }
});

module.exports = multer({ storage });