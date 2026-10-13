import { notFound } from "next/navigation";
import { KeyRow, Panel } from "@/components/page-ui";
import {
  DIPLOMA_TYPE_LABELS,
  EDUCATION_LEVEL_LABELS,
  LANGUAGE_TEST_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { getCase } from "@/features/cases/server/get-case";

const Row = KeyRow;
const dash = (v: string | null) => v ?? "—";

function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
  });
}

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
    <div className="grid items-start gap-5 md:grid-cols-2">
      <div className="space-y-5">
        <Panel title="Identité">
          <dl>
            <Row label="Date de naissance">{formatDay(c.birth_date)}</Row>
            <Row label="Téléphone">{c.phone}</Row>
            <Row label="E-mail">{dash(c.email)}</Row>
            <Row label="Ville ou wilaya">{dash(c.city)}</Row>
            <Row label="Nationalité">{dash(c.nationality)}</Row>
            <Row label="Contact secondaire">
              {c.secondary_contact_name
                ? `${c.secondary_contact_name} · ${c.secondary_contact_phone}`
                : "—"}
            </Row>
          </dl>
        </Panel>

        <Panel title="Dossier">
          <dl>
            <Row label="Campagne">{campaign?.name ?? "—"}</Row>
            <Row label="Responsable">{responsible ?? "—"}</Row>
            <Row label="Créé le">{new Date(c.created_at).toLocaleDateString("fr-FR")}</Row>
          </dl>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Parcours">
          <dl>
            <Row label="Niveau d'études atteint">
              {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
            </Row>
            <Row label="Filière ou spécialité">{dash(c.current_field)}</Row>
            <Row label="Établissement actuel">{dash(c.current_institution)}</Row>
            <Row label="Diplômes">
              {c.diplomas.length === 0
                ? "Aucun"
                : c.diplomas
                    .map((d) =>
                      [labelOf(DIPLOMA_TYPE_LABELS, d.type), d.title, d.year]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(", ")}
            </Row>
            <Row label="Tests de langue">
              {c.language_tests.length === 0
                ? "Aucun"
                : c.language_tests
                    .map((t) =>
                      [
                        t.test === "other" ? t.other_name : labelOf(LANGUAGE_TEST_LABELS, t.test),
                        t.result,
                        t.date && formatDay(t.date),
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(", ")}
            </Row>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
