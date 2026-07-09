declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Base URL for the admin app (e.g. https://admin.propertyos.app) - used for magic links in emails */
      ADMIN_APP_URL: string;
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
      /** Google Credentials */
      GOOGLE_ANDROID_CLIENT_ID: string;
      GOOGLE_IOS_CLIENT_ID: string;
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
      PORT: string;
      /** Base URL for the web app (e.g. https://propertyos.app) - used for magic links in emails */
      WEB_APP_URL: string;
    }
  }
}

export {};
