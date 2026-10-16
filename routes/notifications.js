const express = require("express");
const db = require("../database");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Get notifications for the logged-in user
router.get("/", authenticateToken, (req, res) => {
    db.all(
        `SELECT id, message, project_id, task_id, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY id DESC`,
        [req.user.id],
        (err, notifications) => {
            if (err) {
                console.error("Notifications error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not fetch notifications"
                });
            }

            res.json({
                success: true,
                count: notifications.length,
                notifications
            });
        }
    );
});

// Mark a notification as read
router.patch("/:id/read", authenticateToken, (req, res) => {
    const notificationId = Number(req.params.id);

    if (!Number.isSafeInteger(notificationId) || notificationId < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid notification ID"
        });
    }

    db.run(
        `UPDATE notifications
         SET is_read = 1
         WHERE id = ? AND user_id = ?`,
        [notificationId, req.user.id],
        function (err) {
            if (err) {
                console.error("Notification update error:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not update notification"
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found"
                });
            }

            res.json({
                success: true,
                message: "Notification marked as read",
                notification_id: notificationId
            });
        }
    );
});

module.exports = router;