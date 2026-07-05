# 📝 MinIO + Node.js Webhook Notification Setup (macOS, No Docker)

Last updated: **2025-08-02**

---

## ✅ 1. Install MinIO (Server) on macOS

```bash
brew install minio/stable/minio
```

---

## ✅ 2. Create Data Directory for MinIO

```bash
mkdir -p ~/minio-data
```

---

## ✅ 3. Set MinIO Root Credentials

Temporarily:

```bash
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
```

Or permanently (in `~/.zshrc` or `~/.bash_profile`):

```bash
echo 'export MINIO_ROOT_USER=minioadmin' >> ~/.zshrc
echo 'export MINIO_ROOT_PASSWORD=minioadmin' >> ~/.zshrc
source ~/.zshrc
```

---

## ✅ 4. Start MinIO Server

```bash
minio server ~/minio-data --console-address ":9001"
```

- API: http://localhost:9000
- UI Console: http://localhost:9001
- Login: `minioadmin / minioadmin`

---

## ✅ 5. Install `mc` (MinIO Client)

```bash
brew install minio/stable/mc
```

Add alias:

```bash
mc alias set $ALIAS(myminio) http://localhost:9000 $ACCESS_TOKEN $SECRET_TOKEN
```

Test:

```bash
mc admin info local
```

---

## ✅ 6. Set Up Node.js Webhook Listener

Create project:

```bash
mkdir nodejs-webhook && cd nodejs-webhook
npm init -y
npm install express body-parser
```

Create `server.js`:

```js
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3001;

app.use(bodyParser.json());

app.post("/s3-notification", (req, res) => {
  console.log("🔔 Received MinIO Event:", JSON.stringify(req.body, null, 2));
  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`🚀 Webhook server running at http://localhost:${port}/s3-notification`);
});
```

Start server:

```bash
node server.js
```

---

## ✅ 7. Configure Webhook Notification in MinIO

```bash
mc admin config set $ALIAS notify_webhook:node1 \
  enable="on" \
  endpoint="http://localhost:3001/s3-notification" \
  auth_token="my-super-secret" \
  queue_limit="0" \
  queue_dir="/tmp" \
  comment="Webhook for Node.js"
```

Restart MinIO:

```bash
mc admin service restart $ALIAS
```

---

## ✅ 8. Enable Notifications on Bucket

Create bucket (if needed):

```bash
mc mb $ALIAS/$BUCKET_NAME
```

Attach events:

```bash
mc event add $ALIAS/$BUCKET_NAME arn:minio:sqs::node1:webhook --event put
```

Confirm:

```bash
mc event list $ALIAS/$BUCKET_NAME
```

---

## ✅ 9. Test It 🎉

Upload a file:

```bash
mc cp ./test-video.mp4 local/mybucket/
```

You should see the webhook receive an event in the Node.js terminal.
