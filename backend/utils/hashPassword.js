const bcrypt = require("bcryptjs")

async function hashPassword(password){
    const saltRound = 10
    const hashedPassword = await bcrypt.hash(password,saltRound)
    return hashedPassword
}

exports.hashPassword = hashPassword