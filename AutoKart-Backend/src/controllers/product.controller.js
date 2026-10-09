const translateProductFields = require("../utils/translateService");

exports.getSingleProduct = async (req, res) => {
  try {

    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    let finalProduct = product;

    // 🔥 Only translate when Marathi selected
    if (req.getLocale() === "mr") {
      finalProduct = await translateProductFields(product, "mr");
    }

    res.render("product-details", {
      product: finalProduct
    });

  } catch (error) {
    console.error("PRODUCT CONTROLLER ERROR:", error);
    res.status(500).send("Server Error");
  }
};