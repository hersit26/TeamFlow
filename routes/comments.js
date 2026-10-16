
const express = require("express");
const db = require("../database");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Add a comment to a task
router.post("/", authenticateToken, (req, res) => {
    const { task_id, content } = req.body;
    const taskId = Number(task_id);

    if (
        !Number.isSafeInteger(taskId) ||
        taskId < 1 ||
        typeof content !== "string" ||
        !content.trim() ||
        content.trim().length > 2000
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid task ID and comment"
        });
    }

    db.get(
        `SELECT t.id, t.project_id
         FROM tasks t
         INNER JOIN project_members pm
             ON pm.project_id = t.project_id
         WHERE t.id = ? AND pm.user_id = ?`,
        [taskId, req.user.id],
        (err, task) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not verify task access"
                });
            }

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found or you are not a project member"
                });
            }

            db.run(
                `INSERT INTO comments (task_id, user_id, content)
                 VALUES (?, ?, ?)`,
                [taskId, req.user.id, content.trim()],
                function (insertError) {
                    if (insertError) {
                        console.error(insertError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not add comment"
                        });
                    }

                    const commentId = this.lastID;

                    // Notify the task creator and assignee.
                    db.all(
                        `SELECT DISTINCT user_id
                         FROM (
                             SELECT created_by AS user_id
                             FROM tasks WHERE id = ?
                             UNION
                             SELECT assigned_to AS user_id
                             FROM tasks WHERE id = ?
                         )
                         WHERE user_id IS NOT NULL AND user_id != ?`,
                        [taskId, taskId, req.user.id],
                        (notifyError, users) => {
                            if (notifyError) {
                                console.error(notifyError.message);
                            }

                            (users || []).forEach((user) => {
                                db.run(
                                    `INSERT INTO notifications
                                     (user_id, message, project_id, task_id)
                                     VALUES (?, ?, ?, ?)`,
                                    [
                                        user.user_id,
                                        `New comment on task: ${content.trim().slice(0, 100)}`,
                                        task.project_id,
                                        taskId
                                    ],
                                    (notificationError) => {
                                        if (notificationError) {
                                            console.error(notificationError.message);
                                        }
                                    }
                                );
                            });

                            res.status(201).json({
                                success: true,
                                message: "Comment added successfully",
                                comment: {
                                    id: commentId,
                                    task_id: taskId,
                                    user_id: req.user.id,
                                    content: content.trim()
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

// Get comments for a task
router.get("/task/:taskId", authenticateToken, (req, res) => {
    const taskId = Number(req.params.taskId);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID"
        });
    }

    db.get(
        `SELECT t.project_id
         FROM tasks t
         INNER JOIN project_members pm
             ON pm.project_id = t.project_id
         WHERE t.id = ? AND pm.user_id = ?`,
        [taskId, req.user.id],
        (err, task) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Could not verify task access"
                });
            }

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found or you are not a project member"
                });
            }

            db.all(
                `SELECT c.id, c.task_id, c.content, c.created_at,
                        u.id AS user_id, u.name AS user_name
                 FROM comments c
                 INNER JOIN users u ON u.id = c.user_id
                 WHERE c.task_id = ?
                 ORDER BY c.id ASC`,
                [taskId],
                (commentError, comments) => {
                    if (commentError) {
                        console.error(commentError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not fetch comments"
                        });
                    }

                    res.json({
                        success: true,
                        comments
                    });
                }
            );
        }
    );
});

module.exports = router;
