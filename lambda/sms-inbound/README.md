# SMS Inbound Lambda

Forwards inbound two-way SMS events from an SNS topic to the PropertyOS API `POST /webhooks/sms/inbound` endpoint.

Used for tenant STOP / HELP keyword handling (Phase 3b).

## Environment variables

| Variable              | Required | Description                                                          |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `API_PUBLIC_URL`      | Yes      | API base URL without trailing slash (e.g. `https://api.example.com`) |
| `AWS_INTERNAL_SECRET` | Yes      | Must match `AWS_INTERNAL_SECRET` on the API server                   |

## AWS setup (us-east-1)

1. Create a **standard** SNS topic (e.g. `propertyos-sms-inbound`).
2. Enable **two-way SMS** on the PropertyOS 10DLC origination number.
3. Set the number's inbound destination to that SNS topic.
4. Deploy this Lambda and subscribe the topic to it (protocol: AWS Lambda).

## Deploy (manual)

1. Create a Lambda function (Node.js 20.x+, no dependencies).
2. Paste `index.mjs` as the handler (`index.handler`).
3. Set the environment variables above.
4. Execution role: CloudWatch Logs only (this function only calls your public API).
5. SNS topic → **Create subscription** → AWS Lambda → select this function.
6. Confirm the subscription (AWS adds invoke permission on the Lambda automatically).

## Payload shape

SNS invokes Lambda with:

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"originationNumber\":\"+15551234567\",\"messageBody\":\"STOP\",\"messageKeyword\":\"STOP\"}"
      }
    }
  ]
}
```

The handler unwraps `Records[0].Sns.Message` and POSTs `{ "Message": "<json string>" }` to the API, which matches the Phase 3a inbound parser.

## Test

1. Subscribe a tenant to SMS in staging (Settings opt-in + OTP).
2. From a sandbox-verified handset, text **STOP** or **HELP** to the PropertyOS origination number.
3. Check CloudWatch Logs for this Lambda and API logs for `/webhooks/sms/inbound`.
4. Confirm `tenant_sms_keyword_events` has a row and the handset receives the stop/help reply.

## Local development

Test the API handler directly without Lambda:

```bash
curl -X POST http://localhost:3001/webhooks/sms/inbound \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $AWS_INTERNAL_SECRET" \
  -d '{"phoneNumber":"+15551234567","message":"STOP"}'
```

See [`docs/TENANT_SMS_OPT_IN_PHASES.md`](../../docs/TENANT_SMS_OPT_IN_PHASES.md) Phase 3a/3b.
