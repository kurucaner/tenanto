export function getOtpResendButtonLabel(
  resending: boolean,
  canResend: boolean,
  secondsRemaining: number
): string {
  if (resending) {
    return "Sending…";
  }
  if (canResend) {
    return "Resend code";
  }
  return `Resend in ${secondsRemaining}s`;
}
