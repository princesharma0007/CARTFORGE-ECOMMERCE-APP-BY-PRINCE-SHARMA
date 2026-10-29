
const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const User = require('../Models/User');
const Product = require('../Models/Product');
const Order = require('../Models/Order');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const page = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('cart.product');

        if (!user) {
            return res.redirect('/login');
        }

        const items = user.cart.filter(item => item.product);

        if (items.length === 0) {
            return res.redirect('/cart');
        }

        let total = 0;

        for (const item of items) {
            total += item.product.price * item.quantity;
        }

        res.render('checkout', { user, items, total });

    } catch (error) {
        console.log('Checkout error:', error.message);
        res.status(500).send('Unable to open checkout');
    }
};

const saveAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const {
            addressId,
            fullName,
            phone,
            addressLine1,
            addressLine2,
            landmark,
            city,
            state,
            pincode,
            isDefault
        } = req.body;

        const address = {
            fullName,
            phone,
            addressLine1,
            addressLine2: addressLine2 || '',
            landmark: landmark || '',
            city,
            state,
            pincode
        };

        if (!fullName || !addressLine1 || !city || !state ||
            typeof phone !== 'string' ||
            typeof pincode !== 'string' ||
            !/^[6-9]\d{9}$/.test(phone) ||
            !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({
                message: 'Enter a valid delivery address'
            });
        }

        let savedAddress;

        if (addressId) {
            if (!mongoose.isValidObjectId(addressId)) {
                return res.status(400).json({
                    message: 'Invalid address ID'
                });
            }

            savedAddress = user.addresses.id(addressId);

            if (!savedAddress) {
                return res.status(404).json({
                    message: 'Address not found'
                });
            }

            Object.assign(savedAddress, address);

        } else {
            if (user.addresses.length >= 10) {
                return res.status(400).json({
                    message: 'Maximum 10 addresses allowed'
                });
            }

            user.addresses.push(address);
            savedAddress = user.addresses[user.addresses.length - 1];
        }

        if (isDefault === true ||
            isDefault === 'on' ||
            user.addresses.length === 1) {

            for (const item of user.addresses) {
                item.isDefault = item._id.equals(savedAddress._id);
            }
        }

        await user.save();

        res.json({
            message: 'Address saved successfully',
            addressId: savedAddress._id
        });

    } catch (error) {
        console.log('Address error:', error.message);

        res.status(500).json({
            message: 'Unable to save address'
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const addressId = req.params.id;

        if (!mongoose.isValidObjectId(addressId)) {
            return res.status(400).json({
                message: 'Invalid address'
            });
        }

        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(404).json({
                message: 'Address not found'
            });
        }

        const wasDefault = address.isDefault;

        user.addresses.pull(addressId);

        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        res.json({ message: 'Address deleted successfully' });

    } catch (error) {
        console.log('Delete address error:', error.message);

        res.status(500).json({
            message: 'Unable to delete address'
        });
    }
};

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

            if (!product ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > product.stock ||
                !Number.isFinite(product.price) ||
                product.price <= 0) {

                return res.status(400).json({
                    message: 'Invalid or unavailable cart product'
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
                message: 'Invalid order amount'
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: amount,
            currency: 'INR',
            receipt: 'cf_' + crypto.randomBytes(9).toString('hex')
        });

        const order = await Order.create({
            user: user._id,
            items: items,
            address: address.toObject(),
            amount: amount,
            razorpayOrderId: razorpayOrder.id
        });

        res.json({
            key: process.env.RAZORPAY_KEY_ID,
            orderId: razorpayOrder.id,
            amount: amount,
            currency: 'INR',
            name: user.username,
            email: user.email,
            phone: address.phone,
            addressId: order._id
        });

    } catch (error) {
        console.log('Create order error:', error.message);

        res.status(500).json({
            message: 'Could not start payment'
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
                    message: 'Order already paid with another payment'
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

        res.json({
            success: true,
            message: 'Payment successful',
            orderId: updatedOrder._id
        });

    } catch (error) {
        console.log('Verify payment error:', error.message);

        res.status(500).json({
            message: 'Could not verify payment. Check your orders before retrying.'
        });
    }
};

const history = async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user._id
        }).sort({ createdAt: -1 }).lean();

        res.render('orders', {
            user: req.user,
            orders
        });

    } catch (error) {
        console.log('Order history error:', error.message);

        res.status(500).send('Unable to load orders');
    }
};

module.exports = {
    page,
    saveAddress,
    deleteAddress,
    createOrder,
    verifyPayment,
    history
};
