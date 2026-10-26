
const mongoose = require('mongoose');
const Product = require('../Models/Product');
const User = require('../Models/User');

const ProductsADD = async (req, res) => {
    try {
        const { productId } = req.body;

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: 'Invalid product' });
        }

        const product = await Product.findById(productId);

        if (!product || product.stock < 1) {
            return res.status(400).json({ message: 'Product unavailable' });
        }

        const user = await User.findById(req.user._id);

        const item = user.cart.find(item =>
            item.product.toString() === productId
        );

        if (item) {
            if (item.quantity >= product.stock) {
                return res.status(400).json({ message: 'Stock limit reached' });
            }

            item.quantity += 1;
        } else {
            user.cart.push({
                product: productId,
                quantity: 1
            });
        }

        await user.save();

        res.json({ message: 'Added to cart' });

    } catch (error) {
        res.status(500).json({ message: 'Could not add product' });
    }
};

const ProductsMERGE = async (req, res) => {
    try {
        const incoming = req.body.items;

        if (!Array.isArray(incoming) || incoming.length > 100) {
            return res.status(400).json({ message: 'Invalid cart' });
        }

        const user = await User.findById(req.user._id);

        for (const item of incoming) {
            const { productId, quantity } = item || {};

            if (!mongoose.isValidObjectId(productId)) continue;
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) continue;

            const product = await Product.findById(productId);

            if (!product || product.stock < 1) continue;

            const cartItem = user.cart.find(cart =>
                cart.product.toString() === productId
            );

            if (cartItem) {
                cartItem.quantity = Math.min(
                    cartItem.quantity + quantity,
                    product.stock
                );
            } else {
                user.cart.push({
                    product: productId,
                    quantity: Math.min(quantity, product.stock)
                });
            }
        }

        await user.save();

        res.json({ message: 'Cart synced' });

    } catch (error) {
        res.status(500).json({ message: 'Cart sync failed' });
    }
};


const ProductDISPLAY = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('cart.product');

        if (!user) {
            return res.redirect('/login');
        }

        const items = user.cart.filter(item => item.product);

        let total = 0;

        for (const item of items) {
            total += item.product.price * item.quantity;
        }

        console.log('Cart Items:', items.length);
        console.log('Cart Total:', total);

        res.render('cart', {
            user,
            items,
            total
        });

    } catch (error) {
        console.log('Cart Error:', error.message);
        res.status(500).send('Could not load cart');
    }
};


const ProductUPDATE = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (!mongoose.isValidObjectId(productId) ||
            !Number.isInteger(quantity) ||
            quantity < 0 || quantity > 100) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        const user = await User.findById(req.user._id);

        const index = user.cart.findIndex(item =>
            item.product.toString() === productId
        );

        if (index === -1) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (quantity === 0) {
            user.cart.splice(index, 1);
        } else {
            const product = await Product.findById(productId);

            if (!product || product.stock < quantity) {
                return res.status(400).json({ message: 'Not enough stock' });
            }

            user.cart[index].quantity = quantity;
        }

        await user.save();

        res.json({ message: 'Cart updated' });

    } catch (error) {
        res.status(500).json({ message: 'Could not update cart' });
    }
};

module.exports = { ProductsADD, ProductsMERGE, ProductDISPLAY, ProductUPDATE };