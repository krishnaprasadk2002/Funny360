
const jwt = require("jsonwebtoken");
require('dotenv').config()

module.exports = (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            'msg': 'Authorization token is missing!',
            'success': 0
        });
    }


    jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {

        if (err) {
            return res.status(403).json({
                msg: 'Not Authorized',
                success: 0
            })
        }
        res.locals.user = decoded;
        req.decoded = decoded;
        next();
    });
}