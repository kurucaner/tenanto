import { useCallback, useEffect, useState } from "react";

import { OTP_COOLDOWN_SECONDS } from "@/packages/shared";

export function useOtpResendCooldown() {
  const [secondsRemaining, setSecondsRemaining] = useState(OTP_COOLDOWN_SECONDS);

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
    setSecondsRemaining(OTP_COOLDOWN_SECONDS);
  }, []);

  return {
    canResend: secondsRemaining === 0,
    secondsRemaining,
    startCooldown,
  };
}
