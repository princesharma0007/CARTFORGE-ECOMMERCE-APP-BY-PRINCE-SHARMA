
const crypto = require('crypto');
const mongoose = require('mongoose');
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

        if (!user || user.cart.length === 0) {
            return res.status(400).json({
                message: 'Cart is empty'
            });
        }

        const addressId = req.body.addressId;

        if (!mongoose.isValidObjectId(addressId)) {
            return res.status(400).json({
                message: 'Select a valid address'
            });
        }

        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(400).json({
                message: 'Address not found'
            });
        }

        let amount = 0;
        const items = [];

        for (const item of user.cart) {
            const product = await Product.findById(item.product);

            if (!product) {
                return res.status(400).json({
                    message: 'Product not found'
                });
            }

            if (!Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > product.stock) {
                return res.status(400).json({
                    message: 'Invalid quantity or insufficient stock'
                });
            }

            if (!Number.isFinite(product.price) ||
                product.price <= 0) {
                return res.status(400).json({
                    message: 'Invalid product price'
                });
            }

            const priceInPaise = Math.round(product.price * 100);

            if (!Number.isSafeInteger(priceInPaise)) {
                return res.status(400).json({
                    message: 'Invalid product price'
                });
            }

            amount += priceInPaise * item.quantity;

            items.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        if (!Number.isSafeInteger(amount) || amount < 100) {
            return res.status(400).json({
                message: 'Invalid amount'
            });
        }

        const payment = await razorpay.orders.create({
            amount: amount,
            currency: 'INR',
            receipt: 'cf_' + crypto.randomBytes(9).toString('hex')
        });

        await Order.create({
            user: user._id,
            items: items,
            amount: amount,
            address: address.toObject(),
            razorpayOrderId: payment.id
        });

        return res.json({
            key: process.env.RAZORPAY_KEY_ID,
            orderId: payment.id,
            amount: amount,
            currency: 'INR',
            name: user.username,
            email: user.email,
            phone: address.phone
        });

    } catch (error) {
        console.log('Create order error:', error.message);

        return res.status(500).json({
            message: 'Order creation failed'
        });
    }
};


const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (
            typeof razorpay_order_id !== 'string' ||
            typeof razorpay_payment_id !== 'string' ||
            typeof razorpay_signature !== 'string' ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !/^[a-f0-9]{64}$/i.test(razorpay_signature)
        ) {
            return res.status(400).json({
                message: 'Invalid payment details'
            });
        }

        const order = await Order.findOne({
            razorpayOrderId: razorpay_order_id,
            user: req.user._id
        });

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        const validSignature = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(razorpay_signature, 'hex')
        );

        if (!validSignature) {
            return res.status(400).json({
                message: 'Invalid payment signature'
            });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (
            payment.order_id !== order.razorpayOrderId ||
            payment.status !== 'captured' ||
            payment.amount !== order.amount ||
            payment.currency !== 'INR'
        ) {
            return res.status(400).json({
                message: 'Payment not captured'
            });
        }

        if (order.status === 'paid') {
            if (order.razorpayPaymentId !== razorpay_payment_id) {
                return res.status(409).json({
                    message: 'Order already paid using another payment'
                });
            }

            return res.json({
                success: true,
                message: 'Payment already verified',
                orderId: order._id
            });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                status: 'pending'
            },
            {
                $set: {
                    status: 'paid',
                    razorpayPaymentId: razorpay_payment_id
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(409).json({
                message: 'Order status changed. Check your orders'
            });
        }

        const user = await User.findById(req.user._id);

        if (user) {
            for (const bought of updatedOrder.items) {
                const cartItem = user.cart.find(item =>
                    String(item.product) === String(bought.product)
                );

                if (cartItem) {
                    cartItem.quantity -= bought.quantity;

                    if (cartItem.quantity <= 0) {
                        user.cart.pull(cartItem._id);
                    }
                }
            }

            await user.save();
        }

        return res.json({
            success: true,
            message: 'Payment successful',
            orderId: updatedOrder._id
        });

    } catch (error) {
        console.log('Verify payment error:', error.message);

        return res.status(500).json({
            message: 'Payment verification failed. Check your orders before retrying.'
        });
    }
};


const history = async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user._id,
            status: 'paid'
        }).sort({ createdAt: -1 });

        return res.render('orders', {
            user: req.user,
            orders: orders
        });

    } catch (error) {
        console.log('Order history error:', error.message);

        return res.status(500).send('Unable to load orders');
    }
};


module.exports = {
    createOrder,
    verifyPayment,
    history
};
