import { z } from "zod";

const UserCreateSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(7).max(30),
    displayName: z.string().optional(),
  })
  .strict();

type UserCreate = z.infer<typeof UserCreateSchema>;

const UserLoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(7).max(30),
  })
  .strict();

type UserLogin = z.infer<typeof UserLoginSchema>;

const UserForgotPasswordSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

type UserForgotPassword = z.infer<typeof UserForgotPasswordSchema>;

const UserResetPasswordSchema = z
  .object({
    email: z.string().email(),
    key: z.string(),
    password: z.string().min(7).max(30),
  })
  .strict();

type UserResetPassword = z.infer<typeof UserResetPasswordSchema>;

export {
  UserCreateSchema,
  UserLoginSchema,
  UserForgotPasswordSchema,
  UserResetPasswordSchema,
  UserCreate,
  UserLogin,
  UserForgotPassword,
  UserResetPassword,
};
