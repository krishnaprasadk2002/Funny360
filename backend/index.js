require("dotenv").config();

const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const logger = require("morgan");
const path = require("path");
const debug = require("debug")("backend:server");
const http = require("http");
const cors = require("cors");
const createError = require("http-errors");

// Import Routes
const user = require("./routes/user");
const companyaccount = require("./routes/companyaccount");
const project = require("./routes/project");
const connectDB = require("./configs/db.config");

// Environment Variables
const PORT = process.env.PORT || 3000;

// Connect MongoDB
connectDB()

// Create HTTP Server
const server = http.createServer(app);



// Middleware
app.use(logger("dev"));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser()); 
// app.use(cors());

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:4200'
];


// Apply CORS configuration immediately after initializing the app
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Routes
app.use("/user", user);
app.use("/company", companyaccount);
app.use("/project", project);

// Handle 404 Errors
app.use((req, res, next) => {
  next(createError(404));
});

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

// Event Listeners for Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof PORT === "string" ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges.`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use.`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on("listening", () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
  console.log(`Listening on ${bind}`);
});

module.exports = app;
