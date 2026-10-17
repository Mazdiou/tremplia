import { z } from "zod";
import { phoneSchema, requiredText } from "@/lib/validation";

// Règles partagées par les pages d'inscription et de mot de passe et par
// leurs routes. 72 caractères : limite de bcrypt, utilisé par Supabase Auth.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const PASSWORD_TOO_SHORT = `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum)`;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT)
  .max(MAX_PASSWORD_LENGTH, `Mot de passe trop long (${MAX_PASSWORD_LENGTH} caractères maximum)`);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("E-mail invalide")
  .max(254, "E-mail trop long");

export const registerSchema = z.object({
  agencyName: requiredText(100, "Saisissez le nom de l'agence"),
  city: requiredText(100, "Saisissez la ville"),
  phone: phoneSchema,
  firstName: requiredText(100, "Saisissez votre prénom"),
  lastName: requiredText(100, "Saisissez votre nom"),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({ password: passwordSchema });
