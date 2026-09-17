import type { Role } from "./session";

export function roleHomePath(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin/shows";
    case "producer":
      return "/producer";
    case "comic":
      return "/avails";
  }
}
