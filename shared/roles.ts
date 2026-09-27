/** Admin roles. "owner" is the merchant's principal; "staff" are people they add to help run the catalogue. */
export const ADMIN_ROLES = ['owner', 'staff'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Display name for a stored role. Accounts created before roles were simplified keep their old title as-is. */
export const roleLabel = (role: string) => (role === 'owner' ? 'Owner' : role === 'staff' ? 'Staff' : role);
