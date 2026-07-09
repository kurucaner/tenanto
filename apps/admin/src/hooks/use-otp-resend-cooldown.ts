import { useCallback, useEffect, useState } from "react";

// Matches OTP_COOLDOWN_SECONDS in apps/server/src/routes/auth/auth-routes.ts
const COOLDOWN_SECONDS = 60;

export function useOtpResendCooldown() {
  const [secondsRemaining, setSecondsRemaining] = useState(COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  const startCooldown = useCallback(() => {
    setSecondsRemaining(COOLDOWN_SECONDS);
  }, []);

  return {
    canResend: secondsRemaining === 0,
    secondsRemaining,
    startCooldown,
  };
}
