import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  cf_turnstile_response: z.string().optional(),
});

export const registerSchema = z
  .object({
    username: z.string().min(1).max(150),
    email: z.string().email().max(254),
    password: z.string().min(8),
    confirm_password: z.string().min(1),
    terms_accepted: z.literal(true),
    website: z.literal(""),
    cf_turnstile_response: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_password"],
        message: "Senhas não coincidem",
      });
    }
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8),
    confirm_password: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.new_password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_password"],
        message: "Senhas não coincidem",
      });
    }
  });

export const updateProfileSchema = z.object({
  username: z.string().min(1).max(150),
  email: z.string().email().max(254),
  display_name: z.string().max(150).optional(),
  nickname: z.string().max(80).optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
