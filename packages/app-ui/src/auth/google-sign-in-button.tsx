import { type CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { memo, useEffect, useRef, useState } from "react";

import { useResolvedDark } from "../components/use-resolved-dark";

export interface IGoogleSignInButtonProps {
  clientId: string | undefined;
  onCredential: (idToken: string) => void | Promise<void>;
  onError?: () => void;
  text?: "continue_with" | "signin_with" | "signup_with";
}

export const GoogleSignInButton = memo(
  ({ clientId, onCredential, onError, text = "signin_with" }: IGoogleSignInButtonProps) => {
    const [submitting, setSubmitting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [buttonWidth, setButtonWidth] = useState<number>();
    const resolvedDark = useResolvedDark();

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateWidth = () => {
        setButtonWidth(container.offsetWidth);
      };

      updateWidth();
      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    const handleSuccess = async (response: CredentialResponse) => {
      const idToken = response.credential;
      if (!idToken) {
        onError?.();
        return;
      }

      setSubmitting(true);
      try {
        await onCredential(idToken);
      } finally {
        setSubmitting(false);
      }
    };

    if (!clientId) {
      return null;
    }

    return (
      <div
        aria-busy={submitting}
        className={submitting ? "pointer-events-none opacity-60" : ""}
        ref={containerRef}
      >
        {buttonWidth ? (
          <GoogleLogin
            key={`${resolvedDark ? "dark" : "light"}-${buttonWidth}`}
            logo_alignment="left"
            onError={() => onError?.()}
            onSuccess={handleSuccess}
            shape="pill"
            size="medium"
            text={text}
            theme={resolvedDark ? "filled_black" : "outline"}
            width={buttonWidth}
            containerProps={{
              className: "bg-transparent",
            }}
          />
        ) : null}
      </div>
    );
  }
);
GoogleSignInButton.displayName = "GoogleSignInButton";
