import { EMAIL_REGEX } from "../vaults/constants";

const EMAIL_MAX_LENGTH = 255;
const NAME_MAX_LENGTH = 255;
const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const OTP_REGEX = /^\d{6}$/;

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string") return "Email must be a string";
  const trimmed = email.trim();
  if (!trimmed) return "Email is required";
  if (trimmed.length > EMAIL_MAX_LENGTH) return "Email is too long";
  if (!EMAIL_REGEX.test(trimmed)) return "Invalid email format";
  return null;
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string") return "Name must be a string";
  const trimmed = name.trim();
  if (!trimmed) return "Name is required";
  if (trimmed.length > NAME_MAX_LENGTH) return "Name is too long";
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Password must be a string";
  if (password.length < PASSWORD_MIN_LENGTH) return "Password must be at least 8 characters";
  if (!PASSWORD_REGEX.test(password))
    return "Password must contain at least one letter and one number";
  return null;
}

export function validateOtp(otp: unknown): string | null {
  if (typeof otp !== "string") return "OTP must be a string";
  if (!OTP_REGEX.test(otp)) return "OTP must be 6 digits";
  return null;
}
