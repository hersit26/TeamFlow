
require("dotenv").config();

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Please configure a secure JWT_SECRET in .env");
}

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Make Socket.IO available to API routes for future real-time features.
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "TeamFlow API is running"
    });
});

// Authentication routes
app.use("/api/auth", require("./routes/auth"));

// Project routes
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/notifications", require("./routes/notifications"));
// Unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// General error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`TeamFlow server running at http://localhost:${PORT}`);
});
