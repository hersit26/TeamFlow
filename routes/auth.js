const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            password.length < 8 ||
            password.length > 128
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, email and password (8-128 characters)"
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length > 100 || cleanEmail.length > 254) {
            return res.status(400).json({
                success: false,
                message: "Name or email is too long"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        db.run(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [cleanName, cleanEmail, hashedPassword],
            function (err) {
                if (err) {
                    if (err.code === "SQLITE_CONSTRAINT") {
                        return res.status(409).json({
                            success: false,
                            message: "Email is already registered"
                        });
                    }

                    console.error(err.message);
                    return res.status(500).json({
                        success: false,
                        message: "Registration failed"
                    });
                }

                res.status(201).json({
                    success: true,
                    message: "Registration successful",
                    user: {
                        id: this.lastID,
                        name: cleanName,
                        email: cleanEmail
                    }
                });
            }
        );
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        password.length > 128
    ) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    db.get(
        "SELECT id, name, email, password FROM users WHERE email = ?",
        [email.trim().toLowerCase()],
        async (err, user) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Login failed"
                });
            }

            const valid = user
                ? await bcrypt.compare(password, user.password)
                : false;

            if (!valid) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: "2h" }
            );

            res.json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        }
    );
});

module.exports = router;