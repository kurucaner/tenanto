import { memo } from "react";

export interface IAuthTermsNoticeProps {
  webAppUrl: string;
}

function normalizeWebAppUrl(webAppUrl: string): string {
  return webAppUrl.replace(/\/$/, "");
}

export const AuthTermsNotice = memo(({ webAppUrl }: IAuthTermsNoticeProps) => {
  const baseUrl = normalizeWebAppUrl(webAppUrl);
  const linkClassName = "font-medium text-primary hover:underline";

  return (
    <p className="text-center text-xs text-muted-foreground">
      By continuing, you agree to our{" "}
      <a
        className={linkClassName}
        href={`${baseUrl}/terms-of-service`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Terms of Service
      </a>{" "}
      and{" "}
      <a
        className={linkClassName}
        href={`${baseUrl}/privacy-policy`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Privacy Policy
      </a>
      .
    </p>
  );
});
AuthTermsNotice.displayName = "AuthTermsNotice";
