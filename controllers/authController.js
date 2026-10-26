const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../Models/User');
const { mailer, createLoginCookie } = require('../services/authService');

const home = (req, res) => res.redirect('/dashboard');

const showSignup = (req, res) => {
    res.render('signup', { message: '' });
};

const showLogin = (req, res) => {
    res.render('login', { message: '' });
};

const showForgotPassword = (req, res) => {
    res.render('forgot-password', { message: '' });
};

const signup = async (req, res) => {
    try {
        const { username, password } = req.body;
        const email = (req.body.email || '').trim().toLowerCase();

        if (!username || username.trim().length < 2 || !password || password.length < 8 || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.render('signup', { message: 'Enter valid details. Password must contain at least 8 characters.' });
        }

        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.render('signup', { message: 'Email already registered' });
        }

        if (user) {
            const matches = await bcrypt.compare(password, user.password);
            if (!matches) {
                return res.render('signup', { message: 'This email already has a signup request. Use the original password to resend verification.' });
            }
        } else {
            user = await User.create({
                username: username.trim(),
                email,
                password: await bcrypt.hash(password, 10),
                isVerified: false
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, version: user.tokenVersion, purpose: 'verify' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const link = `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`}/verify-email/${token}`;

        await mailer.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify CARTFORGE Account',
            text: `Click here to verify your email: ${link}`
        });

        res.render('signup', { message: 'Verification email sent. Check your inbox.' });

    } catch (error) {
        console.log(error);
        res.render('signup', { message: 'Signup failed. Please try again.' });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const data = jwt.verify(req.params.token, process.env.JWT_SECRET);

        if (data.purpose !== 'verify') {
            return res.render('login', { message: 'Invalid verification link' });
        }

        const user = await User.findById(data.id);

        if (!user || user.email !== data.email || user.isVerified || user.tokenVersion !== data.version) {
            return res.render('login', { message: 'Invalid or already used verification link' });
        }

        user.isVerified = true;
        user.tokenVersion += 1; // Make the verification link single-use.
        await user.save();

        createLoginCookie(res, user);
        res.redirect('/dashboard');

    } catch (error) {
        console.log(error);
        res.render('login', { message: 'Invalid or expired verification link' });
    }
};

const login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password || '';

        const user = await User.findOne({ email });

        if (!user) {
            return res.render('login', { message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render('login', { message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.render('login', { message: 'Verify your email before logging in. You can resend verification from signup.' });
        }

        createLoginCookie(res, user);
        res.redirect('/dashboard');

    } catch (error) {
        console.log(error);
        res.render('login', { message: 'Login failed' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const user = await User.findOne({ email });

        if (user && user.isVerified) {
            const token = jwt.sign(
                { id: user.id, version: user.tokenVersion, purpose: 'reset' },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            const link = `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 7000}`}/reset-password/${token}`;

            await mailer.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Reset CARTFORGE Password',
                text: `Click here to reset your password: ${link}`
            });
        }

        res.render('forgot-password', {
            message: 'If your email exists, a reset link has been sent.'
        });

    } catch (error) {
        console.log(error);
        res.render('forgot-password', { message: 'Could not send reset email' });
    }
};

const showResetPassword = async (req, res) => {
    try {
        const data = jwt.verify(req.params.token, process.env.JWT_SECRET);

        if (data.purpose !== 'reset') {
            return res.render('login', { message: 'Invalid reset link' });
        }

        const user = await User.findById(data.id);

        if (!user || user.tokenVersion !== data.version) {
            return res.render('login', { message: 'Invalid reset link' });
        }

        res.render('reset-password', {
            token: req.params.token,
            message: ''
        });

    } catch (error) {
        res.render('login', { message: 'Invalid or expired reset link' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const data = jwt.verify(req.params.token, process.env.JWT_SECRET);

        if (data.purpose !== 'reset') {
            return res.render('login', { message: 'Invalid reset link' });
        }

        const user = await User.findById(data.id);

        if (!user || user.tokenVersion !== data.version) {
            return res.render('login', { message: 'Reset link expired or already used' });
        }

        const { password, confirmPassword } = req.body;

        if (!password || password.length < 8 || password !== confirmPassword) {
            return res.render('reset-password', {
                token: req.params.token,
                message: 'Passwords must match and contain at least 8 characters'
            });
        }

        user.password = await bcrypt.hash(password, 10);
        user.tokenVersion += 1;

        await user.save();

        res.clearCookie('token');
        res.render('login', { message: 'Password updated successfully. Please login.' });

    } catch (error) {
        console.log(error);
        res.render('login', { message: 'Invalid or expired reset link' });
    }
};

module.exports = { home, showSignup, showLogin, showForgotPassword, signup, verifyEmail, login, forgotPassword, showResetPassword, resetPassword };
