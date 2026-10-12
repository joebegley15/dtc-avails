// The text admins copy and send alongside a sign-in link. Client-safe: no
// server imports. The template is edited on /admin/users/bulk-links and kept
// in the admin's own browser (localStorage), so it's a convenience only.

export const INVITE_MESSAGE_STORAGE_KEY = "dtc-avails:invite-message";

export const DEFAULT_INVITE_MESSAGE = `Hey {first_name}! You're invited to Texahoma Avails, where you let us know which dates you're available to perform.

Here's your personal link. It signs you straight in, so please don't share it:
{link}`;

/** Fills {name}, {first_name} and {link} in the template. */
export function fillInviteMessage(template: string, name: string, link: string): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  return template
    .replaceAll("{first_name}", firstName)
    .replaceAll("{name}", name.trim())
    .replaceAll("{link}", link);
}

/** The admin's saved template, or the default. Storage can be missing or throw. */
export function loadInviteTemplate(): string {
  try {
    return window.localStorage.getItem(INVITE_MESSAGE_STORAGE_KEY) || DEFAULT_INVITE_MESSAGE;
  } catch {
    return DEFAULT_INVITE_MESSAGE;
  }
}

export function saveInviteTemplate(template: string): void {
  try {
    if (template === DEFAULT_INVITE_MESSAGE) {
      window.localStorage.removeItem(INVITE_MESSAGE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(INVITE_MESSAGE_STORAGE_KEY, template);
    }
  } catch {
    // Not saved; the edited text still works for this visit.
  }
}

/** Splits pasted names on commas and new lines, dropping blanks. */
export function splitNames(text: string): string[] {
  return text
    .split(/[,\n\r]+/)
    .map((n) => n.trim())
    .filter((n) => n !== "");
}
