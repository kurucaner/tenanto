# Lambda Setup Guide: Release Vault

This guide walks you through creating the Lambda function and EventBridge Scheduler setup for vault releases. No prior Lambda experience required.

## Overview

1. Create a shared secret for internal API auth
2. Create the Lambda function
3. Create an IAM role for EventBridge Scheduler
4. Configure your server with the required env vars
5. Test the flow

---

## Step 1: Generate AWS_INTERNAL_SECRET

Generate a random secret (e.g. 32 chars):

```bash
openssl rand -hex 32
```

Save this. You'll use it in both the Lambda and your server `.env`.

---

## Step 2: Create the Lambda Function

### 2.1 Open AWS Lambda Console

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**

### 2.2 Configure the function

- **Author from scratch**
- **Function name**: `postscrypt-release-vault`
- **Runtime**: Node.js 18.x or 20.x
- **Architecture**: x86_64
- Click **Create function**

### 2.3 Add the code

1. In the **Code** tab, delete the default `index.mjs` content
2. Copy the contents of `lambda/release-vault/index.mjs` from this repo
3. Paste into the editor
4. Click **Deploy**

### 2.4 Configure environment variables

1. Go to **Configuration** → **Environment variables** → **Edit**
2. Add:
   - `API_PUBLIC_URL`: Your API base URL (e.g. `https://api.postscrypt.app` or `http://localhost:3000` for local testing)
   - `AWS_INTERNAL_SECRET`: The secret you generated in Step 1
3. Click **Save**

### 2.5 Note the Lambda ARN

1. Go to **Configuration** → **General configuration**
2. Copy the **Function ARN** (e.g. `arn:aws:lambda:us-east-1:123456789012:function:postscrypt-release-vault`)
3. Save it for Step 4

---

## Step 3: Create IAM Role for EventBridge Scheduler

EventBridge Scheduler needs an execution role to invoke your Lambda.

### 3.1 Create the policy first (easier than inline)

We need a policy that allows invoking the Lambda. Create it before the role:

1. Go to [IAM Console](https://console.aws.amazon.com/iam) → **Policies** → **Create policy**
2. **Policy editor** → **JSON** tab → Paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:postscrypt-release-vault"
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` with your 12-digit AWS account ID (find it: top-right of console → click your username, or copy from your Lambda function ARN). If you use a different region, replace `us-east-1` too.

3. Click **Next**
4. **Policy name**: `EventBridgeSchedulerInvokeLambdaPolicy`
5. Click **Create policy**

### 3.2 Create the role

1. Go to [IAM Console](https://console.aws.amazon.com/iam) → **Roles** → **Create role**
2. **Trusted entity type**: Custom trust policy
3. **Policy**: Paste this (no placeholders to replace – use as-is):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "scheduler.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

4. Click **Next**
5. **Add permissions**: Search for `EventBridgeSchedulerInvokeLambdaPolicy` and check it
6. Click **Next**
7. **Role name**: `EventBridgeSchedulerInvokeLambda`
8. Click **Create role**

### 3.3 Note the role ARN

1. Go to IAM → Roles → `EventBridgeSchedulerInvokeLambda`
2. Copy the **Role ARN** (e.g. `arn:aws:iam::123456789012:role/EventBridgeSchedulerInvokeLambda`)

---

## Step 4: Configure Your Server

Add to your server `.env`:

```env
# EventBridge Scheduler (vault release)
AWS_EVENTBRIDGE_SCHEDULER_LAMBDA_ARN=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:postscrypt-release-vault
AWS_EVENTBRIDGE_SCHEDULER_EXECUTION_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/EventBridgeSchedulerInvokeLambda
AWS_INTERNAL_SECRET=your-generated-secret-from-step-1
AWS_REGION=us-east-1
```

Restart your server.

---

## Step 5: EventBridge Scheduler Permissions (for your server)

Your server creates and deletes schedules when vaults are sealed or aborted. It uses the credentials from `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your `.env`. The **IAM User** that owns those credentials needs scheduler permissions.

### Where to attach

1. Go to [IAM Console](https://console.aws.amazon.com/iam) → **Users**
2. Click the **IAM User** that corresponds to your server's AWS credentials (the one whose access key is in your `.env`)
3. Go to the **Permissions** tab
4. Click **Add permissions** → **Attach policies directly**
5. Search for `AmazonEventBridgeSchedulerFullAccess`
6. Check it and click **Add permissions**

---

## Step 6: Test

### 6.1 Test the internal endpoint locally

```bash
curl -X POST http://localhost:3001/internal/release-vault \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: your-secret" \
  -d '{"vaultId":"some-vault-uuid"}'
```

(Use a real sealed vault ID from your DB. The vault should transition to `released`.)

### 6.2 Test the Lambda

1. Lambda Console → **Test** tab
2. Create a test event:
   ```json
   {
     "vaultId": "your-sealed-vault-id"
   }
   ```
3. Click **Test**
4. Check that the vault is released in your DB

### 6.3 End-to-end test

1. Create a vault and seal it with a scheduled release 2–3 minutes in the future
2. Wait for the scheduled time
3. Confirm the vault status changes to `released`

---

## Troubleshooting

| Issue                  | Check                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Lambda can't reach API | API_PUBLIC_URL must be reachable from Lambda (use public URL, not localhost)                   |
| 401 Unauthorized       | AWS_INTERNAL_SECRET must match in Lambda and server                                            |
| Schedule not created   | AWS_EVENTBRIDGE_SCHEDULER_LAMBDA_ARN and EXECUTION_ROLE_ARN must be set; check IAM permissions |
| Lambda not invoked     | Verify EventBridge Scheduler has permission to invoke Lambda; check CloudWatch Logs            |
