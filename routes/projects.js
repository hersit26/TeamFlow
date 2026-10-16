
const express = require("express");
const db = require("../database");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

function validProjectId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Create a project
router.post("/", authenticateToken, (req, res) => {
    const { name, description = "" } = req.body;

    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        typeof description !== "string" ||
        description.length > 1000
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid project name and description are required"
        });
    }

    db.run(
        `INSERT INTO projects (name, description, owner_id)
         VALUES (?, ?, ?)`,
        [name.trim(), description.trim(), req.user.id],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not create project"
                });
            }

            const projectId = this.lastID;

            db.run(
                `INSERT INTO project_members (project_id, user_id, role)
                 VALUES (?, ?, 'owner')`,
                [projectId, req.user.id],
                (memberError) => {
                    if (memberError) {
                        console.error(memberError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Project created, but membership setup failed"
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message: "Project created successfully",
                        project: {
                            id: projectId,
                            name: name.trim(),
                            description: description.trim(),
                            owner_id: req.user.id
                        }
                    });
                }
            );
        }
    );
});

// List projects accessible to the current user
router.get("/", authenticateToken, (req, res) => {
    db.all(
        `SELECT p.id, p.name, p.description, p.owner_id, p.created_at
         FROM projects p
         INNER JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = ?
         ORDER BY p.id DESC`,
        [req.user.id],
        (err, projects) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not fetch projects"
                });
            }

            res.json({ success: true, projects });
        }
    );
});

// Get project members
router.get("/:id/members", authenticateToken, (req, res) => {
    const projectId = validProjectId(req.params.id);

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: "Invalid project ID"
        });
    }

    db.get(
        `SELECT id FROM project_members
         WHERE project_id = ? AND user_id = ?`,
        [projectId, req.user.id],
        (accessError, membership) => {
            if (accessError) {
                console.error(accessError.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not verify project access"
                });
            }

            if (!membership) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this project"
                });
            }

            db.all(
                `SELECT u.id, u.name, u.email, pm.role
                 FROM project_members pm
                 JOIN users u ON u.id = pm.user_id
                 WHERE pm.project_id = ?
                 ORDER BY
                    CASE WHEN pm.role = 'owner' THEN 0 ELSE 1 END,
                    u.name COLLATE NOCASE`,
                [projectId],
                (err, members) => {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not fetch project members"
                        });
                    }

                    res.json({ success: true, members });
                }
            );
        }
    );
});

// List invitations received by the current user
router.get("/invitations/pending", authenticateToken, (req, res) => {
    db.all(
        `SELECT i.id, i.project_id, i.status, i.created_at,
                p.name AS project_name,
                p.description AS project_description,
                u.name AS invited_by_name,
                u.email AS invited_by_email
         FROM project_invitations i
         JOIN projects p ON p.id = i.project_id
         JOIN users u ON u.id = i.invited_by
         WHERE i.invited_user_id = ? AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
        [req.user.id],
        (err, invitations) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not fetch invitations"
                });
            }

            res.json({ success: true, invitations });
        }
    );
});

// Invite a registered user to join a project (owner only)
router.post("/:id/invitations", authenticateToken, (req, res) => {
    const projectId = validProjectId(req.params.id);
    const { email } = req.body;

    if (
        !projectId ||
        typeof email !== "string" ||
        !email.trim() ||
        email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return res.status(400).json({
            success: false,
            message: "A valid project ID and email are required"
        });
    }

    db.get(
        "SELECT id, name FROM projects WHERE id = ? AND owner_id = ?",
        [projectId, req.user.id],
        (projectError, project) => {
            if (projectError) {
                console.error(projectError.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not verify project ownership"
                });
            }

            if (!project) {
                return res.status(403).json({
                    success: false,
                    message: "Only the project owner can invite members"
                });
            }

            db.get(
                "SELECT id, name, email FROM users WHERE lower(email) = lower(?)",
                [email.trim()],
                (userError, invitedUser) => {
                    if (userError) {
                        console.error(userError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not find the user"
                        });
                    }

                    if (!invitedUser) {
                        return res.status(404).json({
                            success: false,
                            message: "User not found. Ask them to register first."
                        });
                    }

                    if (invitedUser.id === req.user.id) {
                        return res.status(400).json({
                            success: false,
                            message: "You are already the project owner"
                        });
                    }

                    db.get(
                        `SELECT id FROM project_members
                         WHERE project_id = ? AND user_id = ?`,
                        [projectId, invitedUser.id],
                        (memberError, membership) => {
                            if (memberError) {
                                console.error(memberError.message);
                                return res.status(500).json({
                                    success: false,
                                    message: "Could not check project membership"
                                });
                            }

                            if (membership) {
                                return res.status(409).json({
                                    success: false,
                                    message: "This user is already a project member"
                                });
                            }

                            db.run(
                                `INSERT INTO project_invitations
                                    (project_id, invited_user_id, invited_by, status,
                                     created_at, responded_at)
                                 VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, NULL)
                                 ON CONFLICT(project_id, invited_user_id)
                                 DO UPDATE SET
                                    invited_by = excluded.invited_by,
                                    status = 'pending',
                                    created_at = CURRENT_TIMESTAMP,
                                    responded_at = NULL
                                 WHERE project_invitations.status = 'declined'`,
                                [projectId, invitedUser.id, req.user.id],
                                function (inviteError) {
                                    if (inviteError) {
                                        console.error(inviteError.message);
                                        return res.status(500).json({
                                            success: false,
                                            message: "Could not create invitation"
                                        });
                                    }

                                    if (this.changes === 0) {
                                        return res.status(409).json({
                                            success: false,
                                            message: "An invitation is already pending or was already accepted"
                                        });
                                    }

                                    db.run(
                                        `INSERT INTO notifications
                                            (user_id, message, project_id)
                                         VALUES (?, ?, ?)`,
                                        [
                                            invitedUser.id,
                                            `You have been invited to join "${project.name}".`,
                                            projectId
                                        ],
                                        (notificationError) => {
                                            if (notificationError) {
                                                console.error(
                                                    "Invitation notification failed:",
                                                    notificationError.message
                                                );
                                            }

                                            res.status(201).json({
                                                success: true,
                                                message: `Invitation sent to ${invitedUser.email}`,
                                                invitation: {
                                                    project_id: projectId,
                                                    project_name: project.name,
                                                    invited_user_id: invitedUser.id,
                                                    email: invitedUser.email,
                                                    status: "pending"
                                                }
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Accept or decline an invitation
router.post("/invitations/:invitationId/respond", authenticateToken, (req, res) => {
    const invitationId = validProjectId(req.params.invitationId);
    const { action } = req.body;

    if (!invitationId || !["accept", "decline"].includes(action)) {
        return res.status(400).json({
            success: false,
            message: "A valid invitation ID and action (accept or decline) are required"
        });
    }

    db.get(
        `SELECT i.id, i.project_id, i.invited_by, i.status, p.name AS project_name
         FROM project_invitations i
         JOIN projects p ON p.id = i.project_id
         WHERE i.id = ? AND i.invited_user_id = ?`,
        [invitationId, req.user.id],
        (err, invitation) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Could not load invitation"
                });
            }

            if (!invitation) {
                return res.status(404).json({
                    success: false,
                    message: "Invitation not found"
                });
            }

            if (invitation.status !== "pending") {
                return res.status(409).json({
                    success: false,
                    message: `This invitation has already been ${invitation.status}`
                });
            }

            const finishResponse = () => {
                db.run(
                    `UPDATE project_invitations
                     SET status = ?, responded_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND invited_user_id = ? AND status = 'pending'`,
                    [
                        action === "accept" ? "accepted" : "declined",
                        invitationId,
                        req.user.id
                    ],
                    function (updateError) {
                        if (updateError) {
                            console.error(updateError.message);
                            return res.status(500).json({
                                success: false,
                                message: "Could not update invitation"
                            });
                        }

                        if (this.changes === 0) {
                            return res.status(409).json({
                                success: false,
                                message: "Invitation was already handled"
                            });
                        }

                        const message = action === "accept"
                            ? `${req.user.name || "A team member"} accepted the invitation to "${invitation.project_name}".`
                            : `${req.user.name || "A team member"} declined the invitation to "${invitation.project_name}".`;

                        db.run(
                            `INSERT INTO notifications (user_id, message, project_id)
                             VALUES (?, ?, ?)`,
                            [invitation.invited_by, message, invitation.project_id],
                            (notificationError) => {
                                if (notificationError) {
                                    console.error(
                                        "Response notification failed:",
                                        notificationError.message
                                    );
                                }

                                res.json({
                                    success: true,
                                    message: action === "accept"
                                        ? "Invitation accepted. You are now a project member."
                                        : "Invitation declined.",
                                    status: action === "accept" ? "accepted" : "declined"
                                });
                            }
                        );
                    }
                );
            };

            if (action === "decline") {
                return finishResponse();
            }

            db.run(
                `INSERT OR IGNORE INTO project_members (project_id, user_id, role)
                 VALUES (?, ?, 'member')`,
                [invitation.project_id, req.user.id],
                (memberError) => {
                    if (memberError) {
                        console.error(memberError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Could not add you to the project"
                        });
                    }

                    finishResponse();
                }
            );
        }
    );
});

// Legacy endpoint: add an existing user immediately (owner only).
// Kept for compatibility with the current frontend.
router.post("/:id/members", authenticateToken, (req, res) => {
    const projectId = validProjectId(req.params.id);
    const { email } = req.body;

    if (!projectId || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
            success: false,
            message: "Valid project ID and member email are required"
        });
    }

    db.get(
        "SELECT id, name FROM projects WHERE id = ? AND owner_id = ?",
        [projectId, req.user.id],
        (err, project) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Database error"
                });
            }

            if (!project) {
                return res.status(403).json({
                    success: false,
                    message: "Only the project owner can add members"
                });
            }

            db.get(
                "SELECT id, email FROM users WHERE lower(email) = lower(?)",
                [email.trim()],
                (userError, member) => {
                    if (userError) {
                        console.error(userError.message);
                        return res.status(500).json({
                            success: false,
                            message: "Database error"
                        });
                    }

                    if (!member) {
                        return res.status(404).json({
                            success: false,
                            message: "User not found. Ask them to register first."
                        });
                    }

                    if (member.id === req.user.id) {
                        return res.status(400).json({
                            success: false,
                            message: "You are already the project owner"
                        });
                    }

                    db.run(
                        `INSERT OR IGNORE INTO project_members
                         (project_id, user_id, role)
                         VALUES (?, ?, 'member')`,
                        [projectId, member.id],
                        function (insertError) {
                            if (insertError) {
                                console.error(insertError.message);
                                return res.status(500).json({
                                    success: false,
                                    message: "Could not add member"
                                });
                            }

                            res.status(this.changes ? 201 : 200).json({
                                success: true,
                                message: this.changes
                                    ? "Member added successfully"
                                    : "User is already a project member",
                                user_id: member.id
                            });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;
