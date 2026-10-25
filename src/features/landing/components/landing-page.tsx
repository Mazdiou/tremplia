import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_LINKS } from "@/config/legal";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Milestone,
  NotebookPen,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppPreview } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/utils";
import { DecorLayers } from "@/components/decor";
import { LandingHeader } from "./landing-header";
import { SectionLink } from "./section-link";
import { telHref } from "@/lib/phone";

// Page d'accueil publique. Aucune affirmation inventée : pas de témoignage,
// de chiffre client ni de prix (les tarifs ne sont pas encore fixés).

// Accroche : l'en-tête reste transparent tant qu'elle passe dessous
const HERO_ID = "accroche";

export type LandingContact = { phone: string; whatsappUrl: string | null } | null;

const FEATURES = [
  {
    icon: Milestone,
    title: "Campagnes et étapes",
    text: "Regroupez vos candidats par campagne et suivez l'étape de chaque dossier. Échéances proches et tâches en retard remontent d'elles-mêmes.",
  },
  {
    icon: FileText,
    title: "Documents en ordre",
    text: "Chaque pièce classée dans son dossier, verrouillable par le patron. Vos photos deviennent des PDF, le dossier complet part en un ZIP.",
  },
  {
    icon: GraduationCap,
    title: "Formations et réponses",
    text: "Les vœux du candidat classés par ordre de préférence, et la réponse de chaque établissement dès qu'elle arrive.",
  },
  {
    icon: NotebookPen,
    title: "Lettres de motivation",
    text: "Rédigées dans le dossier, puis relues et validées par le candidat depuis son espace, sans aller-retour par e-mail.",
  },
  {
    icon: Wallet,
    title: "Paiements à jour",
    text: "Montant convenu, sommes encaissées, reste à payer : vous savez à tout moment qui vous doit quoi.",
  },
  {
    icon: MessageCircle,
    title: "Candidats joignables",
    text: "Une messagerie par dossier, des notifications sur téléphone, et WhatsApp en un clic avec le message déjà rédigé.",
  },
];

const STEPS = [
  { title: "Créez votre agence", text: "Deux minutes suffisent, sans carte bancaire ni engagement." },
  { title: "Lancez vos campagnes", text: "Partez d'un modèle prêt à l'emploi, ajustez les étapes, puis ajoutez vos candidats." },
  { title: "Invitez votre équipe", text: "Un compte pour chaque employé, un code d'accès pour chaque candidat." },
];

const FAQ = [
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Créez votre agence et utilisez toutes les fonctionnalités pendant 7 jours, avec toute votre équipe. Aucune carte bancaire, aucun engagement.",
  },
  {
    q: "Que se passe-t-il à la fin de l'essai ?",
    a: "Rien n'est perdu. Sans abonnement, votre agence passe en lecture seule : vos dossiers restent consultables, et vous reprenez le travail là où vous l'aviez laissé dès que l'abonnement est réglé.",
  },
  {
    q: "Comment régler l'abonnement ?",
    a: "En espèces, par CCP ou par BaridiMob, pour 1, 3 ou 12 mois. Contactez-nous : nous vous proposons un tarif adapté à la taille de votre agence.",
  },
  {
    q: "Fonctionne-t-il sur téléphone ?",
    a: `Oui. ${BRAND.name} s'ouvre dans le navigateur, sur ordinateur, tablette ou téléphone, et s'installe sur l'écran d'accueil comme une application, notifications comprises.`,
  },
  {
    q: "Mes candidats doivent-ils créer un compte ?",
    a: "Non. Vous activez leur accès depuis leur dossier et leur envoyez un code, par WhatsApp par exemple. Ce code suffit pour se connecter.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Les données de chaque agence sont isolées des autres, les mots de passe des comptes externes de vos candidats sont chiffrés, et seul le patron décide de qui rejoint l'équipe.",
  },
];

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16 px-5 py-16 sm:px-8 md:py-28", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <p className="text-sm font-semibold tracking-wide text-link uppercase">{eyebrow}</p>
          )}
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro && <p className="mt-4 text-lg text-pretty text-muted-foreground">{intro}</p>}
        </div>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Aperçu de l'équipe (données fictives, décoratif)
function TeamMock() {
  const rows = [
    { initials: "AM", name: "Amine", role: "Patron", cases: 48 },
    { initials: "YK", name: "Yasmine", role: "Employée", cases: 21 },
    { initials: "RB", name: "Rayan", role: "Employé", cases: 17 },
  ];
  return (
    <div aria-hidden className="rounded-2xl border bg-card p-2 shadow-xl shadow-black/5 select-none">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3 rounded-xl px-3 py-3 odd:bg-muted/50">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {r.initials}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">{r.name}</span>
            <span className="block text-xs text-muted-foreground">{r.role}</span>
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{r.cases} dossiers</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Yasmine a ajouté un document · il y a 2 min
      </div>
    </div>
  );
}

// Aperçu de l'espace candidat (données fictives, décoratif)
function StudentMock() {
  const programs = [
    { title: "Licence Informatique", city: "Lyon", result: "Acceptée", tone: "bg-success-bg text-success" },
    {
      title: "Licence MIASHS",
      city: "Grenoble",
      result: "Liste d'attente",
      tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    },
    { title: "BUT Informatique", city: "Toulouse", result: "Candidature envoyée", tone: "bg-accent text-accent-foreground" },
  ];
  return (
    <div aria-hidden className="rounded-2xl border bg-card p-5 shadow-xl shadow-black/5 select-none">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Mes formations</p>
        <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
          Validé par le candidat
        </span>
      </div>
      <ol className="mt-4 space-y-2">
        {programs.map((p, i) => (
          <li key={p.title} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-link">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.title}</span>
              <span className="block text-xs text-muted-foreground">{p.city}</span>
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", p.tone)}>
              {p.result}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContactButtons({ contact, onDecor = false }: { contact: LandingContact; onDecor?: boolean }) {
  if (!contact) return null;
  return (
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
      {contact.whatsappUrl && (
        <a
          href={contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            onDecor && "border-decor-foreground/15 bg-card/80 text-decor-foreground hover:bg-card hover:text-decor-foreground dark:bg-decor-foreground/5 dark:hover:bg-decor-foreground/10",
          )}
        >
          <MessageCircle /> WhatsApp
        </a>
      )}
      <a
        href={telHref(contact.phone)}
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          onDecor && "border-decor-foreground/15 bg-card/80 text-decor-foreground hover:bg-card hover:text-decor-foreground dark:bg-decor-foreground/5 dark:hover:bg-decor-foreground/10",
        )}
      >
        <Phone /> {contact.phone}
      </a>
    </div>
  );
}

export function LandingPage({ contact }: { contact: LandingContact }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-dvh bg-background">
      <LandingHeader heroId={HERO_ID} />
      <main>
        {/* Accroche, sur le même fond que la page de connexion */}
        <div
          id={HERO_ID}
          className="relative overflow-hidden border-b bg-decor pt-16 text-decor-foreground dark:border-transparent"
        >
          <DecorLayers glowClassName="-top-80 size-[74rem]" />

          <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-10 pb-20 sm:px-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32">
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
              <p className="inline-flex items-center gap-2 rounded-full border border-decor-foreground/15 bg-decor-foreground/5 px-3 py-1 text-xs font-medium text-decor-muted">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {BRAND.tagline}
              </p>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Gérez votre agence, pas vos classeurs.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-pretty text-decor-muted">
                Pièces, lettres de motivation, formations, paiements et échéances réunis dans
                un seul outil. Votre équipe avance sur les mêmes dossiers, et chaque candidat suit le sien.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-12 sm:h-11")}>
                  Démarrer l&apos;essai gratuit <ArrowRight />
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 border-decor-foreground/15 bg-card/80 text-decor-foreground hover:bg-card hover:text-decor-foreground dark:bg-decor-foreground/5 dark:hover:bg-decor-foreground/10 sm:h-11",
                  )}
                >
                  Se connecter
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-decor-muted">
                {["7 jours gratuits", "Sans carte bancaire", "Sur ordinateur et téléphone"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* Trop étroit sur téléphone : masqué, comme sur la page de connexion */}
            <div className="mx-auto hidden w-full max-w-md sm:block lg:max-w-none">
              <AppPreview />
            </div>
          </section>
        </div>

        {/* Le problème */}
        <div className="border-b px-5 py-14 text-center sm:px-8">
          <p className="mx-auto max-w-3xl text-xl font-medium text-balance sm:text-2xl">
            Un passeport sur WhatsApp, un relevé de notes perdu dans une boîte mail, un reçu au fond d&apos;un classeur…{" "}
            <span className="text-muted-foreground">
              Avec {BRAND.name}, chaque pièce, chaque échéance et chaque paiement retrouve sa
              place dans le dossier du candidat.
            </span>
          </p>
        </div>

        <Section
          id="fonctionnalites"
          eyebrow="Fonctionnalités"
          title="Tout le suivi d'un dossier, dans un seul outil"
        >
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group flex gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg hover:shadow-black/5 sm:block sm:p-6"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="font-semibold sm:mt-5">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:mt-2">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Équipe */}
        <section className="border-y bg-muted/40 px-5 py-16 sm:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-wide text-link uppercase">Travail d&apos;équipe</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Chacun gère ses dossiers, le patron garde la vue d&apos;ensemble.
              </h2>
              <CheckList
                items={[
                  "Le patron invite ses employés, règle leurs permissions et répartit les dossiers.",
                  "Chacun retrouve sur son tableau de bord ses tâches, ses messages et les échéances à venir.",
                  "Chaque action est tracée dans l'historique, et chaque campagne s'exporte en Excel en un clic.",
                ]}
              />
            </div>
            <TeamMock />
          </div>
        </section>

        {/* Espace candidat */}
        <section id="candidats" className="scroll-mt-16 px-5 py-16 sm:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <p className="text-sm font-semibold tracking-wide text-link uppercase">Espace candidat</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Vos candidats suivent leur dossier, sans vous appeler.
              </h2>
              <CheckList
                items={[
                  "Un simple code d'accès, envoyé par WhatsApp : aucun compte à créer.",
                  "Il relit sa lettre et ses formations, puis valide en un clic ou demande une modification.",
                  "Il voit la réponse de chaque établissement, vous écrit depuis son espace et peut activer les notifications sur son téléphone.",
                ]}
              />
            </div>
            <div className="lg:order-1">
              <StudentMock />
            </div>
          </div>
        </section>

        {/* Démarrer */}
        <Section eyebrow="Démarrer" title="Prêt à l'emploi en trois étapes" className="border-t bg-muted/40">
          <ol className="grid gap-3 md:grid-cols-3 md:gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border bg-card p-5 md:block md:p-6">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold md:mt-5">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground md:mt-2">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Tarifs */}
        <Section
          id="tarifs"
          eyebrow="Tarifs"
          title="Essayez d'abord, payez ensuite"
          intro="Un abonnement unique pour toute l'agence, pour 1, 3 ou 12 mois."
        >
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-8">
              <p className="font-semibold">Essai gratuit</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">7 jours</p>
              <p className="mt-1 text-sm text-muted-foreground">Toutes les fonctionnalités, sans engagement.</p>
              <CheckList
                items={[
                  "Sans carte bancaire",
                  "Équipe et espace candidat inclus",
                  "Vos données conservées à la fin de l'essai",
                ]}
              />
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}>
                Démarrer l&apos;essai gratuit
              </Link>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/10">
              <p className="font-semibold">Abonnement</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">Sur devis</p>
              <p className="mt-1 text-sm text-muted-foreground">1, 3 ou 12 mois, au tarif adapté à votre agence.</p>
              <CheckList
                items={[
                  "Paiement en espèces, par CCP ou BaridiMob",
                  "Toutes les fonctionnalités, pour toute l'équipe",
                  "Aucun renouvellement automatique",
                ]}
              />
              <div className="mt-8">
                {contact ? (
                  <ContactButtons contact={contact} />
                ) : (
                  <Link href="/register" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}>
                    Démarrer l&apos;essai gratuit
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Sécurité */}
        <section className="border-y bg-muted/40 px-5 py-16 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Données isolées", text: "Chaque agence n'accède qu'à ses propres dossiers, jamais à ceux des autres." },
              { icon: LockKeyhole, title: "Identifiants chiffrés", text: "Les mots de passe des comptes externes de vos candidats (Campus France…) sont stockés chiffrés." },
              { icon: KeyRound, title: "Accès maîtrisés", text: "Vous ouvrez, coupez ou renouvelez l'accès de chaque candidat à tout moment." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary ring-1 ring-border">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <Section id="faq" eyebrow="FAQ" title="Questions fréquentes">
          <div className="mx-auto max-w-3xl divide-y overflow-hidden rounded-2xl border bg-card">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-medium hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-6">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="-mt-2 px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Appel final */}
        <section className="px-5 pb-20 sm:px-8 md:pb-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-decor px-6 py-16 text-center text-decor-foreground sm:px-12 dark:border-transparent">
            <DecorLayers glowClassName="-bottom-64 size-[52rem]" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Votre prochaine campagne mérite mieux qu&apos;un tableur.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-decor-muted">
                Créez votre agence en deux minutes et essayez {BRAND.name} gratuitement pendant 7 jours, sans carte bancaire.
              </p>
              <div className="mt-8 grid gap-3 sm:flex sm:justify-center">
                <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-12 sm:h-11")}>
                  Démarrer l&apos;essai gratuit <ArrowRight />
                </Link>
              </div>
              {contact && (
                <div className="mt-6">
                  <p className="mb-3 text-sm text-decor-subtle">Une question ? Écrivez-nous ou appelez-nous.</p>
                  <ContactButtons contact={contact} onDecor />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <LogoMark className="size-7 rounded-lg shadow-none" />
            © {year} {BRAND.name}
          </span>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-6">
            <Link href="/login" className="py-2 hover:text-foreground">Se connecter</Link>
            <Link href="/register" className="py-2 hover:text-foreground">Créer mon agence</Link>
            <Link href="/student/login" className="py-2 hover:text-foreground">Espace candidat</Link>
            <SectionLink href="#faq" className="py-2 hover:text-foreground">FAQ</SectionLink>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="py-2 hover:text-foreground">
                {l.label}
              </Link>
            ))}
            <a href={`mailto:${BRAND.email.contact}`} className="py-2 hover:text-foreground">
              {BRAND.email.contact}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
