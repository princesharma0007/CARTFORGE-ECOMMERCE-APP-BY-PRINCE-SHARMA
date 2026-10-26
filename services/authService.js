const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

function createLoginCookie(res, user) {
    const token = jwt.sign(
        { id: user.id, version: user.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 86400000
    });
}

module.exports = { mailer, createLoginCookie };
