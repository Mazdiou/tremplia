import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PageContainer, PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { DeleteEmployeeButton } from "@/features/team/components/delete-employee-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/require-member";
import { fullName, initialsOf } from "@/lib/names";
import { AddEmployeeForm } from "@/features/team/components/add-employee-form";
import { ToggleActiveButton } from "@/features/team/components/toggle-active-button";
import { EmployeePermissions } from "@/features/team/components/employee-permissions";
import { parsePermissions, type Permission } from "@/lib/permissions";
import { getSubscription } from "@/features/subscription/server/subscription";
import { plural } from "@/lib/plural";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Équipe" };

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  permissions: Permission[];
};

// Une ligne de la liste : identité, rôle, état et actions du patron ; pour
// un employé actif, ses permissions dessous
function MemberRow({
  member: m,
  email,
  canManage,
}: {
  member: TeamMember;
  email: string;
  canManage: boolean;
}) {
  const name = fullName(m.first_name, m.last_name);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3 last:border-b-0">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
      >
        {initialsOf(m.first_name, m.last_name)}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <span className="w-20 text-sm text-muted-foreground max-md:hidden">
        {m.role === "owner" ? "Patron" : "Employé"}
      </span>
      <span className="w-24">
        <StatusPill tone={m.is_active ? "ok" : "off"}>
          {m.is_active ? "Actif" : "Désactivé"}
        </StatusPill>
      </span>
      <div className="flex min-w-44 flex-wrap justify-end gap-2 max-md:w-full max-md:justify-start">
        {canManage && (
          <>
            {m.role === "employee" && !m.is_active && (
              <DeleteEmployeeButton id={m.id} name={name} />
            )}
            <ToggleActiveButton id={m.id} isActive={m.is_active} />
          </>
        )}
      </div>
      {m.role === "employee" && m.is_active && (
        // Sous le nom sur ordinateur (largeur de l'avatar + écart)
        <div className="basis-full md:pl-13">
          <EmployeePermissions id={m.id} name={name} permissions={m.permissions} canEdit={canManage} />
        </div>
      )}
    </li>
  );
}

export default async function TeamPage() {
  const caller = await requireOwner();
  if (!caller) redirect("/dashboard");

  // Lecture via le RLS : uniquement les profils de l'agence du patron
  const supabase = await createClient();
  const [{ data: members }, subscription] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, role, is_active, permissions")
      .order("created_at"),
    getSubscription(caller.agencyId),
  ]);

  // E-mails : lus côté serveur avec la clé admin, pour ces profils seulement
  const admin = createAdminClient();
  const emails = new Map<string, string>();
  await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.id);
      if (data.user?.email) emails.set(m.id, data.user.email);
    }),
  );

  const list = ((members ?? []) as (Omit<TeamMember, "permissions"> & { permissions: unknown })[]).map(
    (m) => ({ ...m, permissions: parsePermissions(m.permissions) }),
  );
  // Les anciens membres (désactivés) s'accumulent au fil des années : ils
  // sont rangés à part, dans une section repliée
  const active = list.filter((m) => m.is_active);
  const former = list.filter((m) => !m.is_active);
  // Abonnement expiré : l'équipe se consulte, mais ne se modifie plus
  const readOnly = subscription.state === "expired";
  const row = (m: TeamMember) => (
    <MemberRow
      key={m.id}
      member={m}
      email={emails.get(m.id) ?? ""}
      canManage={m.id !== caller.userId && !readOnly}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Équipe"
        subtitle={`${plural(active.length, "membre actif", "membres actifs")} · seul le patron gère l'équipe et les permissions`}
      />

      <div className="space-y-5">
        <Panel
          title="Membres"
          description="Un employé qui part se désactive : il ne peut plus se connecter, et tout ce qu'il a fait reste dans l'historique."
        >
          <ul>{active.map(row)}</ul>
        </Panel>

        {former.length > 0 && (
          <details className="group overflow-hidden rounded-2xl border bg-card [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Anciens membres ({former.length})
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Comptes désactivés. Seul un compte sans historique peut être supprimé.
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="border-t">{former.map(row)}</ul>
          </details>
        )}

        {!readOnly && (
          <Panel
            title="Ajouter un employé"
            description={
              active.length <= 1
                ? "Vous êtes seul pour l'instant. Chaque employé a son compte et travaille sur les mêmes dossiers ; un mot de passe temporaire est créé, qu'il remplace à sa première connexion."
                : "Un mot de passe temporaire est créé : l'employé le remplace à sa première connexion."
            }
            highlight={active.length <= 1}
          >
            <AddEmployeeForm />
          </Panel>
        )}
      </div>
    </PageContainer>
  );
}
