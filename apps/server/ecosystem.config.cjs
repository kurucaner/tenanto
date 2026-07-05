/**
 * PM2 config for server container (cluster mode).
 * Used by pm2-runtime inside the Docker container.
 */
module.exports = {
  apps: [
    {
      name: "server",
      script: "apps/server/dist/apps/server/src/server.js",
      interpreter: "node",
      instances: "max",
      exec_mode: "cluster",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
