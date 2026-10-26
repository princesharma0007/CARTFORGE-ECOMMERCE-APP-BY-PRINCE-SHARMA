const express = require("express");
const router = express.Router();
const isAuthenticated = require("../middleware/isAuthenticated");
const cartController = require("../controllers/cartController");

router.get( "/cart",isAuthenticated,(req, res, next) => {
    if (!req.user) return res.redirect("/dashboard");
    next();
  },
  cartController.ProductDISPLAY,
);
router.post("/cart/add", isAuthenticated, cartController.ProductsADD);
router.post("/cart/sync", isAuthenticated, cartController.ProductsMERGE);
router.post("/cart/update", isAuthenticated, cartController.ProductUPDATE);
module.exports = router;
