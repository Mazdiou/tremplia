import { KeyRow as Row, Panel } from "@/components/page-ui";
import {
  DIPLOMA_TYPE_LABELS,
  EDUCATION_LEVEL_LABELS,
  LANGUAGE_TEST_LABELS,
  labelOf,
} from "@/features/cases/labels";
import type { CaseFieldsRecord } from "@/features/cases/case-record";
import { formatShortDate } from "@/lib/dates";

// Blocs Identité et Parcours d'un dossier, partagés par la fiche de l'agence
// et l'espace du candidat.

const dash = (v: string | null) => v ?? "—";

export function IdentityPanel({ c }: { c: CaseFieldsRecord }) {
  return (
    <Panel title="Identité">
      <dl>
        <Row label="Date de naissance">{formatShortDate(c.birth_date)}</Row>
        <Row label="Téléphone">{c.phone}</Row>
        <Row label="E-mail">{dash(c.email)}</Row>
        <Row label="Ville ou wilaya">{dash(c.city)}</Row>
        <Row label="Nationalité">{dash(c.nationality)}</Row>
        <Row label="Contact secondaire">
          {c.secondary_contact_name ? (
            <>
              {c.secondary_contact_name},{" "}
              <span className="whitespace-nowrap">{c.secondary_contact_phone}</span>
            </>
          ) : (
            "—"
          )}
        </Row>
      </dl>
    </Panel>
  );
}

export function ParcoursPanel({ c }: { c: CaseFieldsRecord }) {
  return (
    <Panel title="Parcours">
      <dl>
        <Row label="Niveau d'études atteint">
          {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
        </Row>
        <Row label="Filière ou spécialité">{dash(c.current_field)}</Row>
        <Row label="Établissement actuel">{dash(c.current_institution)}</Row>
        <Row label="Diplômes">
          {c.diplomas.length === 0 ? (
            "Aucun"
          ) : (
            <ul className="space-y-0.5">
              {c.diplomas.map((d, i) => (
                <li key={i}>
                  {[labelOf(DIPLOMA_TYPE_LABELS, d.type), d.title].filter(Boolean).join(", ")}
                  {d.year && ` (${d.year})`}
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Tests de langue">
          {c.language_tests.length === 0 ? (
            "Aucun"
          ) : (
            <ul className="space-y-0.5">
              {c.language_tests.map((t, i) => (
                <li key={i}>
                  {[t.test === "other" ? t.other_name : labelOf(LANGUAGE_TEST_LABELS, t.test), t.result]
                    .filter(Boolean)
                    .join(", ")}
                  {t.date && ` (${formatShortDate(t.date)})`}
                </li>
              ))}
            </ul>
          )}
        </Row>
      </dl>
    </Panel>
  );
}
