# CARTFORGE - Simple E-commerce Authentication Project

Uses Express.js, EJS, MongoDB/Mongoose, bcrypt, Nodemailer, JWT and Tailwind CSS CDN.

## Run
1. Run `npm install` (Node.js 20+).
2. Copy `.env.example` to `.env`. Fill MONGO_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASSWORD (Gmail App Password), and BASE_URL.
3. Make sure MongoDB is running.
4. Run `npm start` and visit http://localhost:8000/signup.

## Easy workflow for mentor
1. Signup: check username/email/password -> hash password with bcrypt -> save in PendingUser -> email a verification JWT (15 minutes).
2. Verification: check signed JWT -> find pending user -> create User -> remove pending record -> create login JWT in HTTP-only cookie -> dashboard.
3. Login: find User by email -> compare password with bcrypt -> set JWT cookie -> dashboard.
4. Protected routes: middleware reads token cookie -> jwt.verify -> look up user -> show page.
5. Forgot password: email a password-reset JWT (15 minutes); reset page verifies it, hashes the new password and increases tokenVersion. This stops old tokens from working.
6. Logout: clear JWT cookie. JWT expires after 1 day.

### Why two models?
PendingUser stores signup info **before** email verification. User stores actual accounts **after** verification. Passwords in both are hashed, never plain text.

### What is intentionally NOT added?
No access/refresh token rotation, queues, Socket.IO, external auth libraries or complicated design. Products are loaded from MongoDB. Cart and checkout are not implemented.

### Security limitations
This is a teaching/demo project. Before public deployment, add rate limits, CSRF protection for cookie-authenticated POST requests, robust input validation, email-delivery recovery and careful production HTTPS settings. Verification JWTs are 15-minute signed links; pending records also expire logically after 15 minutes (database cleanup is optional).

## Show existing MongoDB products
- The Product model is in `Models/Product.js`. Mongoose uses the `products` collection by default.
- The protected `/products` route runs `Product.find()` and sends the result to `views/products.ejs`.
- The page uses the existing reusable header and Tailwind CSS.
- **Important:** In MongoDB Atlas your demo products are in the `test` database. Ensure `MONGO_URI` connects to the **same database** (for example, the URI ends in `/test`). Otherwise you may see no products.
- Add to Cart is clearly marked as not yet implemented.

## Demo gaming products

Run `npm run seed:gaming` once after configuring `.env` and MongoDB. It adds eight gaming demo products to the same database and skips products that already have the same name. It does not delete existing products. Images are local SVG files in `Public/images/gaming`. Then run `npm start` and open `/products` after logging in.

The Add to Cart button is a placeholder; cart backend not implemented.
