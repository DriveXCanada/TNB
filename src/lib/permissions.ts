import type { Role } from "@prisma/client";

/** Every permission the app checks, grouped in columns like the employee screen. */
export const PERMISSIONS = {
  manageJobs: "Manage Jobs",
  viewAllJobs: "View Everyone's Jobs",
  createAttempts: "Create & Update Attempts",
  deleteAttempts: "Delete Attempts",
  createAffidavits: "Create & Update Affidavits",
  deleteAffidavits: "Delete Affidavits",
  manageClients: "Manage Clients",
  manageEmployees: "Manage Employees",
  updateSettings: "Update Account Settings",
  viewDashboard: "Access Dashboard",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const PERMISSION_HELP: Record<Permission, string> = {
  manageJobs: "Create, edit, assign, archive and delete jobs; edit anyone's attempts; control client tracking links.",
  viewAllJobs: "See every job, not only the ones assigned to them.",
  createAttempts: "Log service attempts and edit their own attempts.",
  deleteAttempts: "Delete service attempts.",
  createAffidavits: "Create, edit and print affidavits.",
  deleteAffidavits: "Delete saved affidavits.",
  manageClients: "Add and edit clients and see their contact details.",
  manageEmployees: "Add and edit employees and their permissions.",
  updateSettings: "Change company, affidavit and tracking settings.",
  viewDashboard: "See the office dashboard.",
};

export const PERMISSION_COLUMNS: Permission[][] = [
  ["manageJobs", "viewAllJobs", "createAttempts", "deleteAttempts", "createAffidavits", "deleteAffidavits"],
  ["manageClients", "manageEmployees", "updateSettings", "viewDashboard"],
];

/** Owner = ADMIN, Admin = MANAGER, Limited = SERVER (database names kept from earlier versions). */
export const ROLE_INFO: Record<Role, { label: string; title: string; description: string }> = {
  ADMIN: { label: "Owner", title: "Full Access.", description: "Create & edit jobs, clients and affidavits. Create & edit employees and permissions. Update account settings." },
  MANAGER: { label: "Admin", title: "Power User.", description: "Create & edit jobs, clients and affidavits. Create & edit employees." },
  SERVER: { label: "Limited", title: "Limited Access.", description: "Only view jobs assigned to them. Record service attempts and create affidavits. Can NOT view clients or account settings." },
  CONTACT: { label: "Contact", title: "No Access.", description: "Prevents the employee from logging in or receiving automated emails." },
  CUSTOM: { label: "Custom", title: "Custom Permissions.", description: "Customize the permissions for this user." },
};

export const ROLE_ORDER: Role[] = ["ADMIN", "MANAGER", "SERVER", "CONTACT", "CUSTOM"];

export const ROLE_PRESETS: Record<Exclude<Role, "CUSTOM">, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS.filter((p) => p !== "updateSettings"),
  SERVER: ["createAttempts", "createAffidavits"],
  CONTACT: [],
};

/** The permissions a user actually has: the role's preset, or their own list for Custom. */
export function effectivePermissions(user: { role: Role; permissions: string[] }): Permission[] {
  if (user.role === "CUSTOM") return user.permissions.filter((p): p is Permission => p in PERMISSIONS);
  return ROLE_PRESETS[user.role];
}

export function can(user: { role: Role; permissions: string[] } | null | undefined, perm: Permission) {
  return Boolean(user) && effectivePermissions(user!).includes(perm);
}
