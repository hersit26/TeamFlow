# TeamFlow — Project Management Tool

TeamFlow is a full-stack project management application designed to help users organize projects, manage tasks, and collaborate efficiently.

## Features

- **User Authentication:** Register and log in securely.
- **Project Management:** Create and manage projects.
- **Task Management:** Organize tasks and track their progress.
- **Comments:** Communicate through task-related comments.
- **Notifications:** Keep track of application updates.
- **Responsive Frontend:** React-based user interface.
- **REST API:** Backend built with Node.js and Express.
- **Database:** SQLite for local data storage.

## Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS

**Backend**
- Node.js
- Express.js
- REST API
- JSON Web Tokens (JWT)
- bcryptjs

**Database & Real-Time**
- SQLite
- Socket.IO

## Project Structure

```text
TeamFlow/
├── client/             # React frontend
├── middleware/         # Authentication middleware
├── routes/             # API routes
├── database.js         # Database configuration
├── server.js           # Express server
├── package.json        # Backend dependencies
├── package-lock.json
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install Node.js and npm before running the application.

### 1. Clone the repository

```bash
git clone https://github.com/hersit26/TeamFlow.git
cd TeamFlow
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root. Add the environment variables required by your backend, including a strong, private JWT secret.

Do not upload `.env` or real secrets to GitHub.

### 4. Start the backend

```bash
node server.js
```

### 5. Start the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed by Vite in your terminal.

## Security

- Keep environment variables and JWT secrets private.
- Do not commit local database files or credentials.
- Use a strong, unique secret for your own environment.

## Future Improvements

- Team invitations and role-based access
- Drag-and-drop task boards
- Enhanced real-time collaboration
- Automated testing and deployment

## Author

**Hersit Kumar Singh**

- GitHub: [@hersit26](https://github.com/hersit26)

---

This project was built to practise full-stack web development and project management application design.