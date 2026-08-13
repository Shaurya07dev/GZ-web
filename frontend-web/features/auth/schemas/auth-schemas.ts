import { z } from "zod";

// Shared across Login/Register/dashboards-to-come: the three account roles
// this platform supports. Customer has no dashboard yet in this phase (see
// Global Constraints) but still registers/logs in like any other role.
export const roleSchema = z.enum(["artist", "aggregator", "customer"]);
export type Role = z.infer<typeof roleSchema>;

const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "At least one letter")
  .regex(/[0-9]/, "At least one number");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Single schema for all three roles (rather than a discriminated union) so
// the form can switch role without swapping resolvers mid-flight — the
// aggregator-only fields are simply optional at the type level and their
// presence is enforced by the second .refine() below.
export const registerBaseSchema = z
  .object({
    role: roleSchema,
    name: z.string().min(2, "Name is too short"),
    email: z.string().email(),
    phone: z.string().min(10, "Enter a valid phone number"),
    password: passwordRule,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, { message: "You must accept the Terms" }),
    companyName: z.string().optional(),
    contactPerson: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) =>
      data.role !== "aggregator" ||
      (!!data.companyName && !!data.contactPerson),
    {
      message: "Company name and contact person are required",
      path: ["companyName"],
    },
  );
export type RegisterInput = z.infer<typeof registerBaseSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
