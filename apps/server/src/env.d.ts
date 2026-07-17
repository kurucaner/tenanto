declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Base URL for the API (e.g. https://api.propertyos.app) - used for unsubscribe links and Lambda forwards */
      API_PUBLIC_URL: string;
      /** AWS credentials */
      AWS_ACCESS_KEY_ID: string;
      /** Shared secret for internal callbacks (Lambda S3 notifications, unsubscribe tokens) */
      AWS_INTERNAL_SECRET: string;
      AWS_REGION: string;
      AWS_SECRET_ACCESS_KEY: string;
      /** Database credentials */
      DB_HOST: string;
      DB_NAME: string;
      DB_PASSWORD: string;
      DB_PORT: string;
      DB_USER: string;
      /** Discord webhook URL for support requests. Create via Server Settings > Integrations > Webhooks */
      DISCORD_SUPPORT_WEBHOOK_URL: string;
      /** Optional Discord webhook for tenant rent payment disputes */
      DISCORD_TENANT_PAYMENTS_WEBHOOK_URL?: string;
      /** Google Credentials */
      GOOGLE_ANDROID_CLIENT_ID: string;
      GOOGLE_IOS_CLIENT_ID: string;
      GOOGLE_WEB_CLIENT_ID: string;
      HOST_ENV: string;
      JWT_SECRET: string;
      /** MinIO / S3-compatible object storage credentials */
      MINIO_ACCESS_KEY: string;
      MINIO_BUCKET: string;
      MINIO_ENDPOINT: string;
      MINIO_REGION: string;
      MINIO_SECRET_KEY: string;
      NODE_ENV: string;
      /** OpenAI API key for expense CSV import */
      OPENAI_API_KEY?: string;
      /** Base URL for the admin app (e.g. https://admin.propertyos.app) - used for magic links in emails */
      PLATFORM_APP_URL: string;
      PORT: string;
      /** Optional default 10DLC / toll-free origination number (E.164) for outbound SMS */
      SNS_SMS_ORIGINATION_NUMBER?: string;
      /** Optional SNS SMS sender ID shown on supported carriers */
      SNS_SMS_SENDER_ID?: string;
      /** Stripe Connect OAuth client id (optional for Express Account Links) */
      STRIPE_CONNECT_CLIENT_ID?: string;
      /** Stripe publishable key (pk_…) — documented for ops; Checkout hosted page may not need it server-side */
      STRIPE_PUBLISHABLE_KEY?: string;
      /** Stripe secret key (sk_…) — required when rent payments / Connect is enabled */
      STRIPE_SECRET_KEY?: string;
      /** Stripe webhook signing secret (whsec_…) */
      STRIPE_WEBHOOK_SECRET?: string;
      /** Base URL for the tenant portal app (e.g. https://tenant.propertyos.app) - used for portal invite links */
      TENANT_APP_URL: string;
      /** Optional — enables tenant lease/rent/portal-invite transactional emails */
      TENANT_EMAIL_NOTIFICATIONS_ENABLED?: string;
      /** Base URL for the web app (e.g. https://propertyos.app) - used for magic links in emails */
      WEB_APP_URL: string;
    }
  }
}

export {};
