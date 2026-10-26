const mongoose = require('mongoose');
const Product = require('../Models/Product');
const isAuthenticated = require('../middleware/isAuthenticated');
const PAGE_SIZE = 6;

async function getPage(cursor) {
    const filter = cursor ? { _id: { $lt: cursor } } : {};
    const results = await Product.find(filter).sort({ _id: -1 }).limit(PAGE_SIZE + 1);
    const products = results.slice(0, PAGE_SIZE);
    const nextCursor = results.length > PAGE_SIZE ? String(products[products.length - 1]._id) : null;
    return { products, nextCursor };
}

const dashboard = async (req, res) => {
    // console.log('User:', req.user ? req.user: 'Guest');
    try {
        await isAuthenticated(req, res, async () => {
            const page = await getPage();
            res.render('dashboard', { page: 'dashboard', user: req.user, ...page });
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const products = async (req, res) => {
    try {
        isAuthenticated(req, res, async () => {
            const page = await getPage();
            res.render('products', { user: req.user, ...page });
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const moreProducts = async (req, res) => {
    try {
        const cursor = req.query.cursor;
        if (!mongoose.isValidObjectId(cursor)) {
            return res.status(400).json({ message: 'Invalid cursor' });
        }
        const page = await getPage(cursor);
        res.render('partials/product-cards', { products: page.products }, (error, html) => {
            if (error) return res.status(500).json({ message: 'Failed to load products' });
            res.json({ html, nextCursor: page.nextCursor });
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load products' });
    }
};

const productDetails = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send('Product not found');
        }
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.render('product-details', { user: req.user, product });
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const profile = (req, res) => {
    isAuthenticated(req, res, () => {
       try {
            res.render('dashboard', { page: 'profile', user: req.user, products: [], nextCursor: null });
        } catch (error) {
            res.status(500).send('Server Error');
        }
    });

}

const logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
};

module.exports = { dashboard, products, moreProducts, productDetails, profile, logout };
