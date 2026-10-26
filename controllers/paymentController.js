
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Product = require('../Models/Product');
const User = require('../Models/User');
const Order = require('../Models/Order');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.cart.length) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        let amount = 0;
        const items = [];

        for (const item of user.cart) {
            const product = await Product.findById(item.product);

            if (!product || !Number.isInteger(item.quantity) ||
                item.quantity < 1 || item.quantity > product.stock ||
                !Number.isFinite(product.price) || product.price <= 0) {
                return res.status(400).json({ message: 'Invalid cart item' });
            }

            amount += Math.round(product.price * 100) * item.quantity;

            items.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        if (!Number.isSafeInteger(amount) || amount < 100) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const payment = await razorpay.orders.create({
            amount,
            currency: 'INR'
        });

        await Order.create({
            user: user._id,
            items,
            amount,
            razorpayOrderId: payment.id
        });

        res.json({
            key: process.env.RAZORPAY_KEY_ID,
            orderId: payment.id,
            amount,
            currency: 'INR',
            name: user.username,
            email: user.email
        });

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: 'Order creation failed' });
    }
};

module.exports = { createOrder, verifyPayment, history };
