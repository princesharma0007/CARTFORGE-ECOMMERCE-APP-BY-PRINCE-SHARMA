const express = require('express');

const productController = require('../controllers/productController');
const router = express.Router();

router.get('/dashboard', productController.dashboard);
router.get('/products', productController.products);
router.get('/products/more', productController.moreProducts);
router.get('/products/:id', productController.productDetails);
router.get('/profile', productController.profile);
router.post('/logout', productController.logout);

module.exports = router;
