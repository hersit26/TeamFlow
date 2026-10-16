
import { useEffect, useState } from "react";
import "./index.css";

const API = "/api";

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function listFrom(data, key) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (mode === "register") {
        await request("/auth/register", null, {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
      }

      const data = await request("/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.token) throw new Error("Login token was not returned.");

      localStorage.setItem("teamflow_token", data.token);
      localStorage.removeItem("Teamflow_token");
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand-mark">T</div>
        <p className="eyebrow">WORK BETTER TOGETHER</p>
        <h1>Big ideas.<br />Better teamwork.</h1>
        <p className="auth-description">
          Bring your projects, tasks and people together in one organized workspace.
        </p>
        <div className="art-board">
          <div className="art-line" />
          <div className="art-line short" />
          <div className="art-cards"><div /><div /><div /></div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="mobile-brand"><span>T</span> TeamFlow</div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
          <h2>{mode === "login" ? "Sign in to TeamFlow" : "Create your account"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Your team workspace is waiting for you."
              : "Create an account to organize your team's work."}
          </p>

          <form onSubmit={submit} className="auth-form">
            {mode === "register" && (
              <label>
                Full name
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name" required />
              </label>
            )}
            <label>
              Email address
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
            </label>
            <label>
              Password
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" required minLength={6} />
            </label>

            {error && <div className="error-message">{error}</div>}
            <button className="primary-button full-button" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in →" : "Create account →"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New to TeamFlow?" : "Already have an account?"}{" "}
            <button onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}>
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="auth-footer">TEAMFLOW · YOUR WORK, IN SYNC</p>
      </div>
    </main>
  );
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("teamflow_token") ||
      localStorage.getItem("Teamflow_token") || ""
  );

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [search, setSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const [activeView, setActiveView] = useState("overview");
  const [members, setMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberBusy, setMemberBusy] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberMessageType, setMemberMessageType] = useState("");

  async function loadProjects(currentToken = token) {
    const data = await request("/projects", currentToken);
    const items = listFrom(data, "projects");
    setProjects(items);
    setSelectedProject(current => {
      if (current && items.some(p => String(p.id) === String(current.id))) {
        return items.find(p => String(p.id) === String(current.id));
      }
      return items[0] || null;
    });
  }

  async function loadMembers(projectId, currentToken = token) {
    if (!projectId || !currentToken) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);
    try {
      const data = await request(`/projects/${projectId}/members`, currentToken);
      setMembers(listFrom(data, "members"));
    } catch (err) {
      setMembers([]);
      setMemberMessage(err.message);
      setMemberMessageType("error");
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadInvitations(currentToken = token) {
    if (!currentToken) return;
    try {
      const data = await request("/projects/invitations/pending", currentToken);
      setInvitations(listFrom(data, "invitations"));
    } catch (err) {
      setMemberMessage(err.message);
      setMemberMessageType("error");
    }
  }

  async function loadNotifications(currentToken = token) {
    try {
      const data = await request("/notifications", currentToken);
      setNotifications(listFrom(data, "notifications"));
    } catch {
      setNotifications([]);
    }
  }

  async function loadTasks(projectId, currentToken = token) {
    if (!projectId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await request(`/tasks/project/${projectId}`, currentToken);
      setTasks(listFrom(data, "tasks"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      await Promise.all([
        loadProjects(),
        loadNotifications(),
        loadInvitations(),
      ]);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  useEffect(() => {
    if (token && selectedProject?.id) loadTasks(selectedProject.id);
    else setTasks([]);
  }, [token, selectedProject?.id]);

  useEffect(() => {
    if (token && activeView === "team" && selectedProject?.id) {
      loadMembers(selectedProject.id);
    } else if (activeView !== "team") {
      setMembers([]);
    }
  }, [token, activeView, selectedProject?.id]);

  function login(newToken) {
    localStorage.setItem("teamflow_token", newToken);
    localStorage.removeItem("Teamflow_token");
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem("teamflow_token");
    localStorage.removeItem("Teamflow_token");
    setToken("");
    setProjects([]);
    setTasks([]);
    setNotifications([]);
    setInvitations([]);
    setSelectedProject(null);
    setMembers([]);
    setActiveView("overview");
  }

  async function createProject(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await request("/projects", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      setModal("");
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    if (!selectedProject) return;

    const form = new FormData(event.currentTarget);
    try {
      await request("/tasks", token, {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          project_id: selectedProject.id,
          priority: form.get("priority"),
        }),
      });
      setModal("");
      await loadTasks(selectedProject.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function inviteMember(event) {
    event.preventDefault();
    if (!selectedProject || !memberEmail.trim()) return;

    setMemberBusy(true);
    setMemberMessage("");
    setMemberMessageType("");

    try {
      const data = await request(
        `/projects/${selectedProject.id}/invitations`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ email: memberEmail.trim() }),
        }
      );

      setMemberEmail("");
      setMemberMessage(data.message || "Invitation created successfully.");
      setMemberMessageType("success");
      await loadInvitations();
      await loadNotifications();
    } catch (err) {
      setMemberMessage(err.message);
      setMemberMessageType("error");
    } finally {
      setMemberBusy(false);
    }
  }

  async function respondToInvitation(invitation, action) {
    setRespondingId(invitation.id);
    setMemberMessage("");
    setMemberMessageType("");

    try {
      const data = await request(
        `/projects/invitations/${invitation.id}/respond`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        }
      );

      setMemberMessage(data.message);
      setMemberMessageType("success");

      await Promise.all([
        loadInvitations(),
        loadProjects(),
        loadNotifications(),
      ]);

      if (action === "accept") {
        setActiveView("team");
        setSelectedProject({
          id: invitation.project_id,
          name: invitation.project_name,
        });
      }
    } catch (err) {
      setMemberMessage(err.message);
      setMemberMessageType("error");
    } finally {
      setRespondingId(null);
    }
  }

  async function updateStatus(task, status) {
    try {
      await request(`/tasks/${task.id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadTasks(selectedProject.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openTask(task) {
    setSelectedTask(task);
    setCommentText("");
    setComments([]);
    setModal("comments");

    try {
      const data = await request(`/comments/task/${task.id}`, token);
      setComments(listFrom(data, "comments"));
    } catch (err) {
      setComments([]);
      setError(err.message);
    }
  }

  async function addComment(event) {
    event.preventDefault();
    if (!commentText.trim() || !selectedTask) return;

    try {
      await request("/comments", token, {
        method: "POST",
        body: JSON.stringify({
          task_id: selectedTask.id,
          content: commentText.trim(),
        }),
      });
      setCommentText("");
      const data = await request(`/comments/task/${selectedTask.id}`, token);
      setComments(listFrom(data, "comments"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function markRead(notification) {
    try {
      await request(`/notifications/${notification.id}/read`, token, {
        method: "PATCH",
      });
      await loadNotifications();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) return <AuthScreen onLogin={login} />;

  const columns = [
    { id: "todo", title: "To do", color: "violet", subtitle: "Ready to get started" },
    { id: "in_progress", title: "In progress", color: "blue", subtitle: "Work in motion" },
    { id: "done", title: "Done", color: "green", subtitle: "Nicely completed" },
  ];

  const filteredTasks = tasks.filter(task =>
    `${task.title || ""} ${task.description || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const doneCount = tasks.filter(t => t.status === "done").length;
  const activeCount = tasks.filter(t => t.status === "in_progress").length;
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const avatarColors = [
    "member-avatar-purple",
    "member-avatar-blue",
    "member-avatar-green",
    "member-avatar-orange",
    "member-avatar-pink",
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-icon">T</span>
          <span className="brand-text">TeamFlow<small>WORKSPACE</small></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch">
          <span className="workspace-avatar">H</span>
          <span className="workspace-info"><strong>My Workspace</strong><small>Free plan</small></span>
          <span className="chevron">⌄</span>
        </button>

        <div className="nav-label">MENU</div>
        <button className={`nav-item ${activeView === "overview" ? "active" : ""}`}
          onClick={() => setActiveView("overview")}>
          <span>▦</span> Overview
        </button>
        <button className={`nav-item ${activeView === "team" ? "active" : ""}`}
          onClick={() => setActiveView("team")}>
          <span>♙</span> Team
          {members.length > 0 && <span className="team-nav-count">{members.length}</span>}
        </button>
        <button className="nav-item" onClick={() => setModal("task")}>
          <span>＋</span> Add a task
        </button>

        <div className="projects-heading">
          <span>YOUR PROJECTS</span>
          <button title="Create project" onClick={() => setModal("project")}>＋</button>
        </div>

        <div className="project-list">
          {projects.map((project, index) => (
            <button key={project.id}
              className={`project-item ${selectedProject?.id === project.id ? "selected" : ""}`}
              onClick={() => setSelectedProject(project)}>
              <span className={`project-dot dot-${index % 4}`} />
              <span className="project-name">{project.name}</span>
              <span className="project-count">
                {tasks.filter(t => t.project_id === project.id).length || ""}
              </span>
            </button>
          ))}
          {projects.length === 0 && <p className="sidebar-empty">No projects yet</p>}
        </div>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">✦</span>
            <strong>Make progress daily</strong>
            <p>Small steps make big things happen.</p>
          </div>
          <button className="profile-button" onClick={logout}>
            <span className="profile-avatar">H</span>
            <span><strong>My account</strong><small>Sign out</small></span>
            <span className="logout-icon">↗</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> Projects <span>/</span>
            <strong>{activeView === "team" ? "Team" : selectedProject?.name || "Overview"}</strong>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <span>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." />
              <kbd>⌘ K</kbd>
            </label>

            <div className="notification-wrap">
              <button className="icon-button" title="Notifications"
                onClick={() => setShowNotifications(v => !v)}>
                ♧{unreadCount > 0 && <span className="notification-dot" />}
              </button>

              {showNotifications && (
                <div className="notification-panel">
                  <div className="notification-title">Notifications <span>{unreadCount} new</span></div>
                  {notifications.length === 0 && <p className="muted">You're all caught up.</p>}
                  {notifications.map(item => (
                    <button className={`notification-item ${item.is_read ? "read" : ""}`}
                      key={item.id} onClick={() => markRead(item)}>
                      <span className="notification-bullet">●</span>
                      <span>{item.message}<small>{item.created_at || "Recent notification"}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="top-avatar" title="Sign out" onClick={logout}>H</button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{activeView === "team" ? "PEOPLE & COLLABORATION" : "YOUR WORKSPACE ✦"}</p>
              <h1>{activeView === "team" ? <>Meet your <span>team.</span></> : <>Let’s make it happen<span>.</span></>}</h1>
              <p className="muted">
                {activeView === "team"
                  ? "Bring the right people together and make great work happen."
                  : "Plan your work, focus on what matters, and move forward together."}
              </p>
            </div>
            {activeView === "overview" && (
              <button className="primary-button" onClick={() => setModal("task")}>＋ New task</button>
            )}
          </section>

          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}

          {activeView === "team" && (
            <section className="team-view">
              <div className="team-summary-row">
                <div>
                  <p className="eyebrow">PROJECT COLLABORATION</p>
                  <h2>{selectedProject?.name || "Your team"}</h2>
                  <p className="muted">People and invitations for your workspace.</p>
                </div>
                <div className="team-total-card">
                  <span className="team-total-icon">♙</span>
                  <div><strong>{members.length}</strong><span>Team members</span></div>
                </div>
              </div>

              {memberMessage && (
                <div className={`team-message ${memberMessageType}`} role="status">
                  <span>{memberMessage}</span>
                  <button onClick={() => setMemberMessage("")} aria-label="Dismiss message">×</button>
                </div>
              )}

              <section className="invitations-section" style={{ marginBottom: 28 }}>
                <div className="team-section-heading">
                  <div>
                    <h3>Invitations for you</h3>
                    <p className="muted">Accept an invitation to join another project.</p>
                  </div>
                  <button className="secondary-button" onClick={() => loadInvitations()} disabled={respondingId !== null}>
                    ↻ Refresh
                  </button>
                </div>

                {invitations.length === 0 ? (
                  <div className="team-empty compact">
                    <div className="team-empty-icon">✉</div>
                    <h3>No pending invitations</h3>
                    <p>New project invitations will appear here.</p>
                  </div>
                ) : (
                  <div className="team-grid">
                    {invitations.map(invitation => (
                      <article className="member-card" key={invitation.id}>
                        <div className="member-card-top">
                          <span className="member-avatar member-avatar-purple">✉</span>
                          <span className="member-role">Pending</span>
                        </div>
                        <h3>{invitation.project_name}</h3>
                        <p className="member-email">
                          Invited by {invitation.invited_by_name || invitation.invited_by_email || "Project owner"}
                        </p>
                        <p className="muted" style={{ marginTop: 8 }}>
                          {invitation.project_description || "Join this project to collaborate with the team."}
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button className="primary-button"
                            disabled={respondingId === invitation.id}
                            onClick={() => respondToInvitation(invitation, "accept")}>
                            {respondingId === invitation.id ? "Please wait..." : "✓ Accept"}
                          </button>
                          <button className="secondary-button"
                            disabled={respondingId === invitation.id}
                            onClick={() => respondToInvitation(invitation, "decline")}>
                            Decline
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {!selectedProject ? (
                <div className="team-empty">
                  <div className="team-empty-icon">♙</div>
                  <h3>Start with a project</h3>
                  <p>Create a project first to build your team.</p>
                  <button className="primary-button" onClick={() => setModal("project")}>＋ Create project</button>
                </div>
              ) : (
                <>
                  <div className="team-section-heading">
                    <div><h3>People in this project</h3><p className="muted">Your collaborators, all in one place.</p></div>
                    <button className="secondary-button" onClick={() => loadMembers(selectedProject.id)} disabled={membersLoading}>
                      ↻ {membersLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {membersLoading && members.length === 0 ? (
                    <div className="team-loading">Loading team members...</div>
                  ) : members.length === 0 ? (
                    <div className="team-empty compact">
                      <div className="team-empty-icon">♙</div>
                      <h3>No members found</h3>
                      <p>Members will appear here once they join the project.</p>
                    </div>
                  ) : (
                    <div className="team-grid">
                      {members.map((member, index) => {
                        const displayName = member.name || member.username || "Team member";
                        const initials = displayName.trim().split(/\s+/).slice(0, 2)
                          .map(part => part[0]).join("").toUpperCase();
                        const role = String(member.role || "member");
                        const owner = role.toLowerCase() === "owner";

                        return (
                          <article className="member-card" key={member.id}>
                            <div className="member-card-top">
                              <span className={`member-avatar ${avatarColors[index % avatarColors.length]}`}>{initials}</span>
                              <span className={`member-role ${owner ? "owner" : ""}`}>{role}</span>
                            </div>
                            <h3>{displayName}</h3>
                            <p className="member-email">{member.email || "Email not available"}</p>
                            <div className="member-card-footer">
                              <span className="member-status-dot" />
                              <span>{owner ? "Project owner" : "Project member"}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="add-member-panel">
                    <div className="add-member-copy">
                      <span className="add-member-icon">＋</span>
                      <div>
                        <h3>Invite a team member</h3>
                        <p>Send an in-app invitation to a registered TeamFlow user.</p>
                      </div>
                    </div>
                    <form className="team-form" onSubmit={inviteMember}>
                      <input type="email" value={memberEmail}
                        onChange={e => setMemberEmail(e.target.value)}
                        placeholder="teammate@example.com" aria-label="Team member email" required />
                      <button className="primary-button" disabled={memberBusy || !memberEmail.trim()}>
                        {memberBusy ? "Sending..." : "✉ Send invitation"}
                      </button>
                    </form>
                    <p className="team-form-note">
                      Only the project owner can invite members. The person must have a registered account.
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {activeView === "overview" && (
            <>
              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top"><span>Total tasks</span><span className="stat-icon lavender">▤</span></div>
                  <div className="stat-number">{tasks.length}<span className="stat-note"> in this project</span></div>
                  <div className="stat-foot">All your tasks in one place</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>In progress</span><span className="stat-icon sky">◷</span></div>
                  <div className="stat-number">{activeCount}</div>
                  <div className="stat-foot">Keep the momentum going</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Completed</span><span className="stat-icon mint">✓</span></div>
                  <div className="stat-number">{doneCount}</div>
                  <div className="stat-foot">{tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}% of current tasks</div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Projects</span><span className="stat-icon peach">◈</span></div>
                  <div className="stat-number">{projects.length}</div>
                  <div className="stat-foot">Ideas becoming reality</div>
                </article>
              </section>

              <section className="board-section">
                <div className="board-heading">
                  <div>
                    <div className="board-title-row">
                      <h2>{selectedProject?.name || "Your task board"}</h2>
                      <span className="task-total">{tasks.length} tasks</span>
                    </div>
                    <p className="muted">{selectedProject?.description || "Here's what's happening with your project today."}</p>
                  </div>
                  <div className="board-actions">
                    <button className="secondary-button" onClick={refresh}>↻ Refresh</button>
                    <button className="primary-button" onClick={() => setModal("task")}>＋ Add task</button>
                  </div>
                </div>

                {loading && <div className="loading-state">Loading your tasks...</div>}

                {!selectedProject && !loading && (
                  <div className="empty-state">
                    <div className="empty-illustration">▦</div>
                    <h3>Your workspace starts here</h3>
                    <p>Create your first project to start organizing tasks.</p>
                    <button className="primary-button" onClick={() => setModal("project")}>＋ Create project</button>
                  </div>
                )}

                {selectedProject && !loading && (
                  <div className="kanban-board">
                    {columns.map(column => {
                      const columnTasks = filteredTasks.filter(t => (t.status || "todo") === column.id);
                      return (
                        <section className="kanban-column" key={column.id}>
                          <div className="column-heading">
                            <div className={`column-indicator ${column.color}`} />
                            <h3>{column.title}</h3>
                            <span className="column-count">{columnTasks.length}</span>
                            <button className="column-add" title={`Add task to ${column.title}`} onClick={() => setModal("task")}>＋</button>
                          </div>
                          <p className="column-subtitle">{column.subtitle}</p>
                          <div className="task-stack">
                            {columnTasks.map(task => (
                              <article className="task-card" key={task.id} onClick={() => openTask(task)}>
                                <div className="task-card-top">
                                  <span className={`priority-tag ${(task.priority || "medium").toLowerCase()}`}><span>●</span> {task.priority || "Medium"}</span>
                                  <button className="task-menu" onClick={e => { e.stopPropagation(); openTask(task); }}>···</button>
                                </div>
                                <h4>{task.title}</h4>
                                {task.description && <p className="task-description">{task.description}</p>}
                                <div className="task-card-footer">
                                  <span className="task-id">TF-{String(task.id).padStart(3, "0")}</span>
                                  <div className="task-card-right">
                                    <button className="comment-count" onClick={e => { e.stopPropagation(); openTask(task); }}>☷</button>
                                    <span className="task-avatar">{String(task.title || "T").charAt(0).toUpperCase()}</span>
                                  </div>
                                </div>
                                <select className="status-select" value={task.status || "todo"}
                                  aria-label="Change task status"
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateStatus(task, e.target.value)}>
                                  <option value="todo">Move to To do</option>
                                  <option value="in_progress">Move to In progress</option>
                                  <option value="done">Move to Done</option>
                                </select>
                              </article>
                            ))}
                            {columnTasks.length === 0 && <div className="column-empty">No tasks here yet</div>}
                          </div>
                          <button className="add-task-inline" onClick={() => setModal("task")}>＋ Add a task</button>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="page-footer"><span>TEAMFLOW</span> Made for teams that make things happen.</footer>
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(""); }}>
          <section className="modal-card">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{modal === "project" ? "WORKSPACE" : modal === "task" ? "TASK MANAGEMENT" : "DISCUSSION"}</p>
                <h2>{modal === "project" ? "Create a project" : modal === "task" ? "Create a new task" : selectedTask?.title || "Task comments"}</h2>
              </div>
              <button className="modal-close" onClick={() => setModal("")}>×</button>
            </div>

            {modal === "project" && (
              <form className="modal-form" onSubmit={createProject}>
                <label>Project name<input name="name" placeholder="e.g. Website Redesign" required /></label>
                <label>Description<textarea name="description" placeholder="What is this project about?" rows="3" /></label>
                <button className="primary-button full-button">Create project</button>
              </form>
            )}

            {modal === "task" && (
              <form className="modal-form" onSubmit={createTask}>
                <label>Task title<input name="title" placeholder="e.g. Design the homepage" required /></label>
                <label>Description<textarea name="description" placeholder="Add some details..." rows="3" /></label>
                <label>Priority<select name="priority" defaultValue="medium">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select></label>
                <button className="primary-button full-button" disabled={!selectedProject}>Create task</button>
                {!selectedProject && <p className="muted">Create a project before adding tasks.</p>}
              </form>
            )}

            {modal === "comments" && (
              <div className="comments-area">
                <div className="comment-list">
                  {comments.length === 0 && <p className="muted">No comments yet. Start the conversation.</p>}
                  {comments.map(comment => (
                    <div className="comment-item" key={comment.id}>
                      <span className="comment-avatar">{String(comment.username || comment.name || "T").charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{comment.username || comment.name || "Team member"}</strong>
                        <p>{comment.content || comment.text}</p>
                        <small>{comment.created_at || ""}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="comment-form" onSubmit={addComment}>
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Write a comment..." required />
                  <button className="primary-button">Send</button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
