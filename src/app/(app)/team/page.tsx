import { redirect } from "next/navigation";
import { PageContainer, PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { DeleteEmployeeButton } from "@/features/team/components/delete-employee-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/require-member";
import { initialsOf } from "@/lib/names";
import { AddEmployeeForm } from "@/features/team/components/add-employee-form";
import { ToggleActiveButton } from "@/features/team/components/toggle-active-button";
import { SubscriptionPanel } from "@/features/subscription/components/subscription-panel";
import { getSubscription, listPlatformPayments } from "@/features/subscription/server/subscription";

export default async function TeamPage() {
  const caller = await requireOwner();
  if (!caller) redirect("/dashboard");

  // Lecture via le RLS : uniquement les profils de l'agence du patron
  const supabase = await createClient();
  // Paiements de l'abonnement : demandés dès maintenant pour l'encart
  // Abonnement (même lecture, mise en cache)
  void listPlatformPayments();
  const [{ data: members }, subscription] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, role, is_active").order("created_at"),
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

  const list = members ?? [];
  // Abonnement expiré : l'équipe se consulte, mais ne se modifie plus
  const readOnly = subscription.state === "expired";

  return (
    <PageContainer>
      <PageHeader
        title="Équipe"
        subtitle={`${list.length} membre${list.length > 1 ? "s" : ""} · seul le patron gère l'équipe`}
      />

      <div className="space-y-5">
        <SubscriptionPanel agencyId={caller.agencyId} />

        <Panel
          title="Membres"
          description="Un employé qui a créé des dossiers, documents ou notes se désactive : il ne peut plus être supprimé."
        >
          <ul>
            {list.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                >
                  {initialsOf(m.first_name, m.last_name)}
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {emails.get(m.id) ?? ""}
                  </p>
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
                  {m.id !== caller.userId && !readOnly && (
                    <>
                      {m.role === "employee" && !m.is_active && (
                        <DeleteEmployeeButton
                          id={m.id}
                          name={`${m.first_name} ${m.last_name}`}
                        />
                      )}
                      <ToggleActiveButton id={m.id} isActive={m.is_active} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {!readOnly && (
          <Panel
            title="Ajouter un employé"
            description="Un mot de passe temporaire est créé : l'employé le remplace à sa première connexion."
          >
            <AddEmployeeForm />
          </Panel>
        )}
      </div>
    </PageContainer>
  );
}
