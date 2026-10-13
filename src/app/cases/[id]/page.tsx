import { notFound } from "next/navigation";
import {
  DIPLOMA_LABELS,
  LANGUAGE_TEST_LABELS,
  LEVEL_LABELS,
  SCOPE_LABELS,
  labelOf,
  procedureLabel,
} from "@/features/cases/labels";
import { KeyRow, Panel } from "@/components/page-ui";
import { getCase } from "@/features/cases/server/get-case";

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title}>
      <dl>{children}</dl>
    </Panel>
  );
}

const Row = KeyRow;

function listOrNone(values: string[], labels: Record<string, string>) {
  return values.length > 0
    ? values.map((v) => labels[v] ?? v).join(", ")
    : "Aucun";
}

export default async function CaseInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const { c, responsible } = data;

  const birthDate = new Date(`${c.birth_date}T00:00:00Z`).toLocaleDateString(
    "fr-FR",
    { timeZone: "UTC" },
  );
  const createdAt = new Date(c.created_at).toLocaleDateString("fr-FR");

  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      <div className="space-y-5">
      <Block title="Identité">
        <Row label="Date de naissance">{birthDate}</Row>
        <Row label="Téléphone">{c.phone}</Row>
        <Row label="E-mail">{c.email ?? "—"}</Row>
      </Block>

      <Block title="Dossier">
        <Row label="Prestation">{labelOf(SCOPE_LABELS, c.scope)}</Row>
        <Row label="Procédure">{procedureLabel(c.main_track, c.schools)}</Row>
        <Row label="Responsable">{responsible ?? "—"}</Row>
        <Row label="Créé le">{createdAt}</Row>
      </Block>
      </div>

      <Block title="Parcours">
        <Row label="Niveau d'études actuel">
          {labelOf(LEVEL_LABELS, c.education_level)}
        </Row>
        <Row label="Diplômes obtenus">
          {listOrNone(c.diplomas, DIPLOMA_LABELS)}
        </Row>
        <Row label="Tests de langue">
          {listOrNone(c.language_tests, LANGUAGE_TEST_LABELS)}
        </Row>
      </Block>

    </div>
  );
}
