import { getPersonNameValidationError, normalizePersonName } from "@/packages/shared";
import { z } from "zod";

export const authEmailSchema = z.email("Enter a valid email");

export function createPersonNameSchema(options?: { requiredMessage?: string }) {
  const requiredMessage = options?.requiredMessage ?? "Name is required";

  return z.string().transform(normalizePersonName).superRefine((name, ctx) => {
    const error = getPersonNameValidationError(name);
    if (!error) return;

    ctx.addIssue({
      code: "custom",
      message: error === "Name is required" ? requiredMessage : error,
    });
  });
}

export const personNameSchema = createPersonNameSchema();
export const authNameSchema = personNameSchema;

export const authPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
    "Password must contain at least one letter and one number"
  );

export const authOtpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const loginSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  email: authEmailSchema,
  name: authNameSchema,
  password: authPasswordSchema,
});

export const verifyOtpSchema = z.object({
  otp: authOtpSchema,
});

export const forgotPasswordSchema = z.object({
  email: authEmailSchema,
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your password"),
    newPassword: authPasswordSchema,
    otp: authOtpSchema,
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type TLoginFormValues = z.infer<typeof loginSchema>;
export type TSignUpFormValues = z.infer<typeof signUpSchema>;
export type TVerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;
export type TForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type TResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
