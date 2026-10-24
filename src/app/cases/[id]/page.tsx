import { notFound } from "next/navigation";
import { KeyRow as Row, Panel } from "@/components/page-ui";
import { getCase } from "@/features/cases/server/get-case";
import { IdentityPanel, ParcoursPanel } from "@/features/cases/components/case-info-panels";
import { dayFormat } from "@/lib/dates";

export default async function CaseInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const { c, responsible, campaign } = data;

  return (
    <div className="grid items-start gap-5 @2xl:grid-cols-2">
      <div className="space-y-5">
        <IdentityPanel c={c} />

        <Panel title="Dossier">
          <dl>
            <Row label="Campagne">{campaign?.name ?? "—"}</Row>
            <Row label="Responsable">{responsible ?? "—"}</Row>
            <Row label="Créé le">{dayFormat.format(new Date(c.created_at))}</Row>
          </dl>
        </Panel>
      </div>

      <div className="space-y-5">
        <ParcoursPanel c={c} />
      </div>
    </div>
  );
}
