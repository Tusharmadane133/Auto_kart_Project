const multer = require("multer");
const path = require("path");
const fs = require("fs");

// IMPORTANT: point to Frontend uploads folder
const reviewDir = path.join(
    __dirname,
    "../../../AutoKart-Frontend/public/uploads/reviews"
);

// Ensure folder exists
if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
}

// Storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, reviewDir);
    },
    filename: function (req, file, cb) {
        const uniqueName =
            "review_" + Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

// Allow only images
const fileFilter = (req, file, cb) => {
    const allowed = /jpg|jpeg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Only image files allowed"));
    }
};

const uploadReviewImage = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = uploadReviewImage;