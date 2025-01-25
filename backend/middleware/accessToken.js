const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    console.log("Token in cookies:", token); 

    if (!token) {
        console.log("No token found, unauthorized access");
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY || 'token');
        req.user = decoded;
        console.log("Decoded user from token:", req.user); 
        next()
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(403).json({ message: 'Forbidden' }); 
    }
};

module.exports = { authenticateToken };
