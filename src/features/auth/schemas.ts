import { z } from "zod";
import { phoneSchema, requiredText } from "@/lib/validation";

// Règles partagées par les pages d'inscription et de mot de passe et par
// leurs routes. 72 caractères : limite de bcrypt, utilisé par Supabase Auth.
const passwordSchema = z
  .string()
  .min(8, "Mot de passe trop court (8 caractères minimum)")
  .max(72, "Mot de passe trop long (72 caractères maximum)");

const emailSchema = z
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

export const changePasswordSchema = z.object({ password: passwordSchema });

export const newEmployeeSchema = z.object({
  firstName: requiredText(100, "Saisissez le prénom"),
  lastName: requiredText(100, "Saisissez le nom"),
  email: emailSchema,
});
