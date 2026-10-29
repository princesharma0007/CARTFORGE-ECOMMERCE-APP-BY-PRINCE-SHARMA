
const express = require('express');
const router = express.Router();

const checkoutController = require('../controllers/checkoutController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/checkout', isAuthenticated, checkoutController.page);

router.post('/checkout/address', isAuthenticated, checkoutController.saveAddress);

router.delete('/checkout/address/:id', isAuthenticated, checkoutController.deleteAddress);

router.post('/checkout/create-order', isAuthenticated, checkoutController.createOrder);

router.post('/checkout/verify-payment', isAuthenticated, checkoutController.verifyPayment);

router.get('/orders', isAuthenticated, checkoutController.history);

module.exports = router;
