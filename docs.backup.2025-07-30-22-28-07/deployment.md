# Deployment Guide

This guide provides step-by-step instructions for deploying the Node.js application.

## 1. Prerequisites

Before you begin, ensure you have the following tools installed on your system:

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Git

If you don't have these tools, you can download and install them from their official websites:

- [Node.js and npm](https://nodejs.org/en/download/)
- [Git](https://git-scm.com/downloads)

## 2. Environment Setup

Clone the repository to your local machine:

```bash
git clone https://github.com/your-repo-url.git
```

Navigate to the project directory:

```bash
cd your-project-directory
```

Install the project dependencies:

```bash
npm install
```

Create a `.env` file in the root directory of the project and set the environment variables:

```bash
touch .env
```

Open the `.env` file and add the following lines:

```bash
# .env
NODE_ENV=production
PORT=8080
```

## 3. Build Process

To build the application, run the following command:

```bash
npm run build
```

This command compiles the TypeScript files to JavaScript and copies the `src/templates` directory to the `dist/` directory.

## 4. Deployment Steps

To start the application, run the following command:

```bash
npm start
```

This command starts the Node.js server.

## 5. Post-Deployment

After deploying the application, you can verify if it's running correctly by navigating to `http://localhost:8080` in your web browser.

To monitor the application, consider using a service like [PM2](https://pm2.keymetrics.io/) or [nodemon](https://nodemon.io/).

## 6. Troubleshooting

If you encounter any issues during the deployment process, consider the following steps:

- Check the Node.js and npm versions. This project requires Node.js v14.0.0 or later and npm v6.0.0 or later.
- Ensure all environment variables are set correctly in the `.env` file.
- If the `npm start` command fails, try deleting the `node_modules/` directory and the `package-lock.json` file, then run `npm install` again.

If you continue to experience issues, please submit a bug report on the project's GitHub page.