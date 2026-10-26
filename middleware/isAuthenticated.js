
const jwt = require('jsonwebtoken');
const User = require('../Models/User');

async function isAuthenticated(req, res, next) {
    try {
        const data = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const user = await User.findById(data.id);

        if (!user || !user.isVerified || data.version !== user.tokenVersion) {
            req.user = null;
            res.locals.user = null; 
            return res.redirect('/login');
        }
         

        req.user = user;
        res.locals.user = user;
        console.log('User:', req.user ? req.user.username : 'Guest');

        next();
    } catch (error) {
        return res.redirect('/login');
    }
    
}

module.exports = isAuthenticated;
