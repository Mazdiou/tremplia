import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { DeleteEmployeeButton } from "@/features/team/components/delete-employee-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/require-owner";
import { AddEmployeeForm } from "@/features/team/components/add-employee-form";
import { ToggleActiveButton } from "@/features/team/components/toggle-active-button";

export default async function TeamPage() {
  const caller = await requireOwner();
  if (!caller) redirect("/dashboard");

  // Lecture via le RLS : uniquement les profils de l'agence du patron
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, is_active")
    .order("created_at");

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

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <PageHeader
          title="Équipe"
          subtitle={`${list.length} membre${list.length > 1 ? "s" : ""}`}
        />

        <div className="space-y-5">
          <Panel title="Membres">
            <ul>
              {list.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-[18px] py-3 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  >
                    {`${m.first_name[0] ?? ""}${m.last_name[0] ?? ""}`.toUpperCase()}
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
                  <div className="flex min-w-44 justify-end gap-2 max-md:w-full max-md:justify-start">
                    {m.id !== caller.user.id && (
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

          <Panel title="Ajouter un employé">
            <AddEmployeeForm />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
