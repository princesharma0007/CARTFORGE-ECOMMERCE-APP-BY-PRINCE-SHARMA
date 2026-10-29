require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const razorpay = require('razorpay');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authroutes');
const productRoutes = require('./routes/productroutes');
const cartRoutes = require('./routes/cartRoutes');
const paymentRoutes = require('./routes/paymentroutes');
const checkoutRoutes = require('./routes/checkoutRoutes');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'Public')));
app.set('view engine', 'ejs');

app.use(authRoutes);
app.use(productRoutes);
app.use(cartRoutes);
app.use(checkoutRoutes);
app.use(paymentRoutes);

connectDB().then(() => app.listen(process.env.PORT || 7000, () => console.log('CARTFORGE started')))
  .catch(error => console.error('MongoDB connection failed:', error.message));
