const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGO_URI;

// Database Connection
const connectDB = ()=>{
    mongoose
      .connect(MONGO_URI, {dbName:"comsec"})
      .then(() => console.log("Connected to MongoDB successfully!"))
      .catch((err) => console.error("Could not connect to MongoDB:", err));
}

module.exports = connectDB