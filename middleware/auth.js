const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please login again. Authentication token is missing.",
    });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is empty.",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    console.error("JWT_SECRET is missing or too short.");
    return res.status(500).json({
      success: false,
      message: "Server authentication configuration error.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    const userId = decoded.id || decoded.userId || decoded.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    req.user = {
      ...decoded,
      id: userId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Your session has expired. Please login again."
          : "Invalid authentication token. Please login again.",
    });
  }
}

module.exports = auth;