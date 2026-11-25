// The one flow for creating a single account, shared by the admin's "Add
// user" form and the Lead Producer's "Create user" form. Server code only.
// Callers must check the creator's role first (requireAdmin /
// requireLeadProducer); this then limits which roles they may create.
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { matchCity } from "./cities";
import { creatableRoles, isRole, roleLabel, type Role } from "./roles";
import { parsePassLevel, type PassLevel } from "./pass-level";
import type { CurrentUser } from "./session";
import { ensureCityCoords } from "./city-coords";

export const MIN_PASSWORD_LENGTH = 6;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;

export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}

export type CreateUserState = { error?: string; success?: string };

export type NewUserFields = {
  name: string;
  email: string;
  password: string;
  role: Role;
  homeMarket: string | null;
  isAllStar: boolean;
  passLevel: PassLevel;
};

/**
 * Checks a single-user form against what this creator may do. Pure, so the
 * rules can be tested without a database.
 *  - Name, email, starting password and role are required.
 *  - The role must be one the creator may create (see creatableRoles): Lead
 *    Producers only comics and producers; nobody creates admins here.
 *  - Comics need a home market, since what they see depends on it.
 *  - Pass level only applies to comics; everyone else is "full".
 *  - All-star is only set by admins.
 */
export function validateNewUser(
  creatorRole: Role,
  formData: FormData
): { fields: NewUserFields } | { error: string } {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const homeMarketRaw = String(formData.get("homeMarket") ?? "").trim();
  const passLevelRaw = String(formData.get("passLevel") ?? "");

  if (!name || !email || !password || !roleRaw) {
    return { error: "Name, email, password, and role are required." };
  }
  if (name.length > 100) return { error: "Keep the name under 100 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  const pwError = passwordError(password);
  if (pwError) return { error: pwError };

  const allowed = creatableRoles(creatorRole);
  if (!isRole(roleRaw) || !allowed.includes(roleRaw)) {
    return {
      error:
        isRole(roleRaw) && allowed.length > 0
          ? `You can't create ${roleLabel(roleRaw)} accounts.`
          : "Invalid role.",
    };
  }
  const role = roleRaw;

  const homeMarket = homeMarketRaw ? matchCity(homeMarketRaw) : null;
  if (homeMarketRaw && !homeMarket) return { error: "Enter a US city, like Austin, TX." };
  if (role === "comic" && !homeMarket) return { error: "Comics need a home market." };

  const passLevel = parsePassLevel(passLevelRaw);
  if (passLevel === "bad") return { error: "Pass level must be full or local." };

  return {
    fields: {
      name,
      email,
      password,
      role,
      homeMarket,
      isAllStar: creatorRole === "admin" && formData.get("isAllStar") === "on",
      passLevel: role === "comic" ? (passLevel ?? "full") : "full",
    },
  };
}

/** Validates and inserts one account, recording who created it. */
export async function createSingleUser(
  creator: CurrentUser,
  formData: FormData
): Promise<CreateUserState> {
  const result = validateNewUser(creator.role, formData);
  if ("error" in result) return result;
  const user = result.fields;

  const passwordHash = await bcrypt.hash(user.password, 10);
  try {
    await sql`
      insert into users
        (name, email, password_hash, role, home_market, is_all_star, pass_level, created_by)
      values
        (${user.name}, ${user.email}, ${passwordHash}, ${user.role}, ${user.homeMarket},
         ${user.isAllStar}, ${user.passLevel}, ${creator.id})
    `;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return { error: "That email is already in use." };
    }
    throw err;
  }
  // Local passes measure from it.
  if (user.homeMarket) await ensureCityCoords([user.homeMarket]);
  return { success: `Added ${user.name} (${roleLabel(user.role)}).` };
}
