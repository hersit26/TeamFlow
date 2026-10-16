
const express = require("express");
const db = require("../database");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Check whether the logged-in user belongs to a project
function checkProjectMembership(projectId, userId, callback) {
    db.get(
        `SELECT project_id
         FROM project_members
         WHERE project_id = ? AND user_id = ?`,
        [projectId, userId],
        (err, membership) => {
            if (err) return callback(err, false);
            callback(null, Boolean(membership));
        }
    );
}

// Create a task
router.post("/", authenticateToken, (req, res) => {
    const {
        title,
        description = "",
        project_id,
        assigned_to = null,
        priority = "medium",
        due_date = null
    } = req.body;

    const projectId = Number(project_id);
    const assigneeId =
        assigned_to === null || assigned_to === ""
            ? null
            : Number(assigned_to);

    if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150 ||
        typeof description !== "string" ||
        description.length > 2000 ||
        !Number.isSafeInteger(projectId) ||
        projectId < 1 ||
        !["low", "medium", "high"].includes(priority) ||
        (assigneeId !== null &&
            (!Number.isSafeInteger(assigneeId) || assigneeId < 1)) ||
        (due_date !== null &&
            (typeof due_date !== "string" ||
             !/^\d{4}-\d{2}-\d{2}$/.test(due_date)))
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid task details"
        });
    }

    checkProjectMembership(projectId, req.user.id, (err, isMember) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({
                success: false,
                message: "Could not verify project membership"
            });
        }

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You must be a project member to create tasks"
            });
        }

        const saveTask = () => {
            db.run(
                `INSERT INTO tasks
                 (title, description, project_id, assigned_to,
                  created_by, priority, due_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    title.trim(),
                    description.trim(),
                    projectId,
                    assigneeId,
                    req.user.id,
                    priority,
                    due_date
                ],
                function (insertError) {
                    if (insertError) {
                        console.error(insertError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not create task"
                        });
                    }

                    const taskId = this.lastID;

                    if (assigneeId !== null) {
                        db.run(
                            `INSERT INTO notifications
                             (user_id, message, project_id, task_id)
                             VALUES (?, ?, ?, ?)`,
                            [
                                assigneeId,
                                `You have been assigned a task: ${title.trim()}`,
                                projectId,
                                taskId
                            ],
                            (notificationError) => {
                                if (notificationError) {
                                    console.error(notificationError.message);
                                }
                            }
                        );
                    }

                    res.status(201).json({
                        success: true,
                        message: "Task created successfully",
                        task: {
                            id: taskId,
                            title: title.trim(),
                            description: description.trim(),
                            project_id: projectId,
                            assigned_to: assigneeId,
                            created_by: req.user.id,
                            priority,
                            status: "todo",
                            due_date
                        }
                    });
                }
            );
        };

        if (assigneeId === null) {
            return saveTask();
        }

        db.get(
            `SELECT user_id
             FROM project_members
             WHERE project_id = ? AND user_id = ?`,
            [projectId, assigneeId],
            (memberError, assignee) => {
                if (memberError) {
                    console.error(memberError.message);
                    return res.status(500).json({
                        success: false,
                        message: "Could not verify assignee"
                    });
                }

                if (!assignee) {
                    return res.status(400).json({
                        success: false,
                        message: "Assignee must be a member of this project"
                    });
                }

                saveTask();
            }
        );
    });
});

// List tasks in a project
router.get("/project/:projectId", authenticateToken, (req, res) => {
    const projectId = Number(req.params.projectId);

    if (!Number.isSafeInteger(projectId) || projectId < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid project ID"
        });
    }

    checkProjectMembership(projectId, req.user.id, (err, isMember) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Could not verify project membership"
            });
        }

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this project"
            });
        }

        db.all(
            `SELECT t.*, u.name AS assignee_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assigned_to
             WHERE t.project_id = ?
             ORDER BY t.id DESC`,
            [projectId],
            (taskError, tasks) => {
                if (taskError) {
                    console.error(taskError.message);
                    return res.status(500).json({
                        success: false,
                        message: "Could not fetch tasks"
                    });
                }

                res.json({
                    success: true,
                    tasks
                });
            }
        );
    });
});

// Update task status
router.patch("/:id/status", authenticateToken, (req, res) => {
    const taskId = Number(req.params.id);
    const { status } = req.body;

    if (
        !Number.isSafeInteger(taskId) ||
        taskId < 1 ||
        !["todo", "in_progress", "done"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID or status"
        });
    }

    db.get(
        `SELECT project_id FROM tasks WHERE id = ?`,
        [taskId],
        (err, task) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database error"
                });
            }

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found"
                });
            }

            checkProjectMembership(
                task.project_id,
                req.user.id,
                (membershipError, isMember) => {
                    if (membershipError) {
                        return res.status(500).json({
                            success: false,
                            message: "Could not verify project membership"
                        });
                    }

                    if (!isMember) {
                        return res.status(403).json({
                            success: false,
                            message: "You are not a member of this project"
                        });
                    }

                    db.run(
                        "UPDATE tasks SET status = ? WHERE id = ?",
                        [status, taskId],
                        function (updateError) {
                            if (updateError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Could not update task"
                                });
                            }

                            res.json({
                                success: true,
                                message: "Task status updated",
                                task_id: taskId,
                                status
                            });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;
