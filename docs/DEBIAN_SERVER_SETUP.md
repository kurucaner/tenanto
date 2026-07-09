# Debian Server Setup Guide

Complete first-time setup for a Locklet production server on Debian 12. Covers system packages, runtime stack, services, and boot persistence.

## Overview

1. System update and helper packages
2. Security basics (firewall, fail2ban)
3. Docker (includes Docker Compose)
4. PostgreSQL
5. MinIO
6. Nginx Proxy Manager
7. Enable services on boot
8. Project directory and SSH

---

## Step 1: System Update and Helper Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Essential utilities

```bash
sudo apt install -y curl wget ca-certificates gnupg lsb-release build-essential
```

| Package         | Purpose                              |
| --------------- | ------------------------------------ |
| curl, wget      | HTTP requests, script downloads      |
| git             | Version control                      |
| vim             | Text editor                          |
| htop            | Process monitor                      |
| jq              | JSON parsing                         |
| build-essential | Compilers, make (for native modules) |
| ca-certificates | SSL/TLS certificates                 |
| gnupg           | Package signing verification         |

### Optional helpers

```bash
sudo apt install -y vim htop jq
```

---

## Step 2: Security Basics

### Firewall (UFW)

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Nginx Proxy Manager admin UI
sudo ufw allow 81/tcp
# MinIO API (if exposed)
sudo ufw allow 9000/tcp
# MinIO Console (if exposed)
sudo ufw allow 9001/tcp
sudo ufw --force enable
sudo ufw status
```

### Fail2ban (brute-force protection)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Step 3: Docker

Locklet runs in Docker containers. Install Docker and Docker Compose:

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

Add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

Log out and back in (or run `newgrp docker`). Verify:

```bash
docker --version
docker compose version
```

---

## Step 4: PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

PostgreSQL is enabled on boot by default. Verify:

```bash
sudo systemctl status postgresql
```

### Create database and user

```bash
sudo -u postgres psql
```

In the PostgreSQL shell:

```sql
CREATE USER postscrypt WITH PASSWORD 'your_secure_password';
CREATE DATABASE postscrypt OWNER postscrypt;
GRANT ALL PRIVILEGES ON DATABASE postscrypt TO postscrypt;
\q
```

Use these credentials in your `.env` (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST=localhost`, `DB_PORT=5432`). The Locklet server container connects via `host.docker.internal`; the compose file sets `DB_HOST=host.docker.internal` for the container.

---

## Step 5: MinIO

### Download and install binary

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

### Create MinIO user and data directory

```bash
sudo useradd -r minio-user -s /sbin/nologin
sudo mkdir -p /var/lib/minio/data
sudo chown -R minio-user:minio-user /var/lib/minio
```

### Environment file

```bash
sudo tee /etc/default/minio << 'EOF'
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=your_secure_minio_password
MINIO_VOLUMES="/var/lib/minio/data"
MINIO_OPTS="--console-address :9001"
EOF
```

Replace `minio_admin` and `your_secure_minio_password` with your values. Use these in `.env` as `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ENDPOINT=http://localhost:9000`. The Locklet server container uses `http://host.docker.internal:9000` (set in docker-compose).

### Systemd service

```bash
sudo tee /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/usr/local/bin/minio
AssertFileNotEmpty=/etc/default/minio

[Service]
Type=notify
WorkingDirectory=/usr/local
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=1048576
TasksMax=infinity

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and start MinIO

```bash
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
sudo systemctl status minio
```

MinIO API: `http://localhost:9000`, Console: `http://localhost:9001`.

---

## Step 6: Nginx Proxy Manager

Nginx Proxy Manager (NPM) provides a web UI for reverse proxy, SSL, and domain routing. It runs in Docker.

### Run Nginx Proxy Manager

```bash
mkdir -p ~/nginx-proxy-manager/data ~/nginx-proxy-manager/letsencrypt
cd ~/nginx-proxy-manager
```

Create `docker-compose.yml`:

```yaml
services:
  app:
    image: jc21/nginx-proxy-manager:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

```bash
docker compose up -d
```

### Access the admin UI

Open `http://YOUR_SERVER_IP:81`

- Default login: `admin@example.com` / `changeme`
- Change the password on first login

### Locklet proxy hosts

In the NPM UI, add **Proxy Hosts** for each domain:

| Domain                                     | Forward to              | SSL                       |
| ------------------------------------------ | ----------------------- | ------------------------- |
| `api.postscrypt.app` (or your API domain)  | `http://127.0.0.1:3001` | Request new Let's Encrypt |
| `postscrypt.app` (or your web domain)      | `http://127.0.0.1:3000` | Request new Let's Encrypt |
| `proxy.propertyos.app` (Datadog RUM proxy) | `http://127.0.0.1:8082` | Request new Let's Encrypt |

For each proxy host:

1. **Hosts** → **Add Proxy Host**
2. **Domain Names**: your domain (e.g. `api.postscrypt.app`)
3. **Forward Hostname / IP**: `127.0.0.1`
4. **Forward Port**: `3001` (API), `3000` (web), or `8082` (Datadog proxy)
5. **SSL** tab: Enable, request a new certificate (Let's Encrypt)
6. Save

Point your DNS A records for the domains to the server IP. NPM will handle SSL and proxy traffic to the Locklet containers.

---

## Step 7: Services on Boot Summary

| Service             | How it starts on boot                                        |
| ------------------- | ------------------------------------------------------------ |
| Docker              | `systemctl enable docker`                                    |
| PostgreSQL          | `systemctl enable postgresql` (default)                      |
| MinIO               | `systemctl enable minio`                                     |
| Nginx Proxy Manager | Docker `restart: unless-stopped` (starts when Docker starts) |
| Locklet             | Docker Compose `restart: unless-stopped` per service         |

---

## Step 8: Project Directory and First Deploy

### Create project directory

```bash
sudo mkdir -p /root/postscrypt
sudo chown -R $USER:$USER /root/postscrypt
```

### Configure SSH for GitHub Actions

GitHub Actions uses SSH to rsync files to the server. You need a key pair: the **public** key on the server, the **private** key in GitHub secrets.

#### 1. Generate an SSH key pair (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/locklet_deploy -N ""
```

This creates:

- `~/.ssh/locklet_deploy` (private key) → goes to GitHub
- `~/.ssh/locklet_deploy.pub` (public key) → goes to the server

#### 2. Add the public key to the server

Copy the public key to the server (replace `user` and `your-server-ip`):

```bash
ssh-copy-id -i ~/.ssh/locklet_deploy.pub user@your-server-ip
```

Or manually: append the contents of `~/.ssh/locklet_deploy.pub` to `~/.ssh/authorized_keys` on the server:

```bash
# On the server, as the deploy user
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

#### 3. Add secrets to GitHub

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret name        | Value                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `SSH_PRIVATE_KEY`  | Contents of `~/.ssh/locklet_deploy` (the entire file, including `-----BEGIN` and `-----END` lines) |
| `PROD_SERVER_IP`   | Your server's IP or hostname                                                                       |
| `PROD_SERVER_USER` | SSH username (e.g. `root` or your deploy user)                                                     |

**Note:** Paste the private key exactly as-is. Do not add or remove line breaks. The `PROD_SERVER_USER` must be the same user whose `~/.ssh/authorized_keys` contains the public key, and that user must have write access to `/root/postscrypt` and be in the `docker` group.

#### 4. Test the connection

From your local machine:

```bash
ssh -i ~/.ssh/locklet_deploy PROD_SERVER_USER@PROD_SERVER_IP "echo OK"
```

If you see `OK`, the key works. GitHub Actions will use the same key (from secrets) during deploy.

### First deploy

**Deploy the server first** so `.env` is created. The web and proxy workflows also need `.env` (via `env_file` in docker-compose).

Push to `main` or run the deploy workflow manually. The workflow will:

- Rsync source to `/root/postscrypt`
- Create `.env` from GitHub secrets (server workflow only)
- Run `docker compose build <service> && docker compose up -d <service>`

Containers use `restart: unless-stopped`, so they will come back after a reboot when Docker starts.

---

## Verification Checklist

```bash
# Services
sudo systemctl status postgresql
sudo systemctl status minio
sudo systemctl status docker
docker ps  # Nginx Proxy Manager, Locklet containers

# Docker Compose (after first deploy)
cd /root/postscrypt && docker compose ps
```

---

## Port Reference

| Service             | Port                |
| ------------------- | ------------------- |
| PostgreSQL          | 5432                |
| MinIO API           | 9000                |
| MinIO Console       | 9001                |
| Locklet Server      | 3001                |
| Locklet Web         | 3000                |
| Locklet Proxy       | 8082                |
| Nginx Proxy Manager | 80, 443, 81 (admin) |

Nginx Proxy Manager listens on 80/443 and forwards to the Locklet containers on localhost. Backend ports (3001, 3000, 8082) stay internal and do not need firewall rules.
