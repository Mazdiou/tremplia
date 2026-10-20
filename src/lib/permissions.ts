// Permissions qu'un patron accorde à un employé de confiance (page Équipe),
// en plus de ce que tout membre peut faire. Le patron les a toutes. La base
// impose la même liste (migration employee_permissions) et revérifie chaque
// action ; l'appli s'en sert pour afficher ou masquer.

export const PERMISSIONS = ["payments_view", "payments_manage", "campaigns_manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string }> = {
  payments_view: {
    label: "Voir la caisse",
    description: "Page Paiements (encaissements, restes à payer, export Excel) et chiffres de paiement du tableau de bord.",
  },
  payments_manage: {
    label: "Corriger les paiements",
    description: "Annuler un paiement, avec un motif, et modifier un montant convenu déjà fixé.",
  },
  campaigns_manage: {
    label: "Gérer les campagnes",
    description: "Créer, modifier, archiver ou supprimer une campagne vide, ses étapes, importer un modèle, exporter en Excel.",
  },
};

// Liste lue en base : seules les permissions connues, dans l'ordre de PERMISSIONS
export function parsePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return PERMISSIONS.filter((p) => value.includes(p));
}

export type PermissionHolder = { isOwner: boolean; permissions: readonly Permission[] };

export function can(member: PermissionHolder, permission: Permission): boolean {
  return member.isOwner || member.permissions.includes(permission);
}

// Toutes les permissions effectives (le patron : toutes)
export function effectivePermissions(member: PermissionHolder): Permission[] {
  return PERMISSIONS.filter((p) => can(member, p));
}
