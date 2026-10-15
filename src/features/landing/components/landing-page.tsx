import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  NotebookPen,
  Phone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppPreview } from "@/components/auth/auth-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

// Page d'accueil publique. Aucune affirmation inventée : pas de témoignage,
// de chiffre client ni de prix (les tarifs ne sont pas encore fixés).

export type LandingContact = { phone: string; whatsappUrl: string | null } | null;

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Dossiers par campagne",
    text: "Chaque candidat dans sa campagne et ses groupes, avec ses échéances et un compte à rebours.",
  },
  {
    icon: FileText,
    title: "Documents rangés",
    text: "Les pièces de chaque dossier classées dans des dossiers, verrouillables par le patron.",
  },
  {
    icon: GraduationCap,
    title: "Formations et réponses",
    text: "Les formations visées par ordre de préférence, et la réponse de chaque établissement.",
  },
  {
    icon: NotebookPen,
    title: "Lettres de motivation",
    text: "Rédigées dans le dossier, relues et validées par le candidat depuis son espace.",
  },
  {
    icon: Wallet,
    title: "Paiements suivis",
    text: "Montant convenu, paiements reçus, reste à payer : vous savez qui vous doit quoi.",
  },
  {
    icon: MessageCircle,
    title: "Candidats joignables",
    text: "Messagerie intégrée, et WhatsApp en un clic avec un message déjà rédigé.",
  },
];

const STEPS = [
  { title: "Créez votre agence", text: "Inscription en deux minutes, sans carte bancaire." },
  { title: "Ajoutez vos campagnes", text: "Partez d'un modèle prêt à l'emploi, puis créez vos dossiers." },
  { title: "Invitez l'équipe", text: "Chaque employé a son compte ; chaque candidat, son code d'accès." },
];

const FAQ = [
  {
    q: "Comment se passe l'essai gratuit ?",
    a: "Vous créez votre agence et utilisez toutes les fonctionnalités pendant 7 jours, sans carte bancaire et sans engagement.",
  },
  {
    q: "Que se passe-t-il à la fin de l'essai ?",
    a: "Rien n'est supprimé. Sans abonnement, votre agence passe en lecture seule : vos dossiers restent consultables, mais plus rien ne peut être ajouté ni modifié tant que l'abonnement n'est pas réglé.",
  },
  {
    q: "Comment payer l'abonnement ?",
    a: "En espèces, par CCP ou par BaridiMob, au mois ou à l'année. Contactez-nous pour connaître le tarif adapté à votre agence.",
  },
  {
    q: "Peut-on l'utiliser sur téléphone ?",
    a: "Oui : l'application s'utilise dans le navigateur, sur ordinateur comme sur téléphone, sans rien installer.",
  },
  {
    q: "Mes candidats doivent-ils créer un compte ?",
    a: "Non. Vous ouvrez leur accès depuis leur dossier : ils se connectent avec un simple code, que vous pouvez leur envoyer par WhatsApp.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Les données de chaque agence sont isolées des autres, et les mots de passe des comptes externes de vos candidats sont chiffrés. Le patron décide de qui fait partie de l'équipe.",
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
    <section id={id} className={cn("scroll-mt-20 px-5 py-20 sm:px-8 md:py-28", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow && (
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
          )}
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro && <p className="mt-4 text-lg text-pretty text-muted-foreground">{intro}</p>}
        </div>
        <div className="mt-14">{children}</div>
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
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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

function ContactButtons({ contact, onDark = false }: { contact: LandingContact; onDark?: boolean }) {
  if (!contact) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {contact.whatsappUrl && (
        <a
          href={contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            onDark && "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
          )}
        >
          <MessageCircle /> WhatsApp
        </a>
      )}
      <a
        href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          onDark && "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
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
      {/* En-tête et accroche, sur le même fond que la page de connexion */}
      <div className="relative overflow-hidden bg-[oklch(0.18_0.035_265)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 left-1/2 size-[56rem] -translate-x-1/2 rounded-full bg-[oklch(0.55_0.22_262)] opacity-25 blur-[140px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <GraduationCap className="size-5" strokeWidth={1.8} />
            </span>
            <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
          </Link>
          {/* Liens par le routeur (Link) : avec un simple <a href="#…">, le retour
              arrière depuis une autre page changerait l'adresse sans la page */}
          <nav aria-label="Sections" className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <Link href="#fonctionnalites" className="transition-colors hover:text-white">Fonctionnalités</Link>
            <Link href="#candidats" className="transition-colors hover:text-white">Espace candidat</Link>
            <Link href="#tarifs" className="transition-colors hover:text-white">Tarifs</Link>
            <Link href="#faq" className="transition-colors hover:text-white">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9 rounded-xl text-white/70 hover:bg-white/10 hover:text-white" />
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:block"
            >
              Se connecter
            </Link>
            <Link href="/register" className={buttonVariants()}>
              Essai gratuit
            </Link>
          </div>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-12 pb-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {BRAND.tagline}
            </p>
            <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Tous vos dossiers étudiants, au même endroit.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-white/65">
              Candidats, pièces, lettres, formations, paiements et échéances : toute
              l&apos;équipe travaille sur les mêmes dossiers, et chaque candidat suit le sien.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Essayer gratuitement 7 jours <ArrowRight />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
                )}
              >
                Se connecter
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/50">
              <span>Sans carte bancaire</span>
              <span>Prêt en 2 minutes</span>
              <span>Sur ordinateur et téléphone</span>
            </p>
          </div>
          {/* Trop étroit sur téléphone : masqué, comme sur la page de connexion */}
          <div className="mx-auto hidden w-full max-w-md sm:block lg:max-w-none">
            <AppPreview />
          </div>
        </section>
      </div>

      <main>
        {/* Le problème */}
        <div className="border-b px-5 py-14 text-center sm:px-8">
          <p className="mx-auto max-w-3xl text-xl font-medium text-balance sm:text-2xl">
            Fini les dossiers éparpillés entre WhatsApp, Excel et les classeurs.{" "}
            <span className="text-muted-foreground">
              Une seule application pour suivre chaque candidat, du premier rendez-vous à
              la réponse des établissements.
            </span>
          </p>
        </div>

        <Section
          id="fonctionnalites"
          eyebrow="Fonctionnalités"
          title="Tout ce qu'il faut pour suivre vos candidats"
          intro="Pensé pour les agences qui accompagnent des étudiants vers les études à l'étranger, Campus France compris."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Équipe */}
        <section className="border-y bg-muted/40 px-5 py-20 sm:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">Pour toute l&apos;équipe</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Chacun ses dossiers, le patron voit tout.
              </h2>
              <CheckList
                items={[
                  "Le patron ajoute ses employés, attribue les dossiers et garde la main sur l'équipe.",
                  "Chaque employé retrouve ses dossiers, ses messages non lus et ses échéances.",
                  "L'historique garde la trace de chaque action : qui a fait quoi, et quand.",
                ]}
              />
            </div>
            <TeamMock />
          </div>
        </section>

        {/* Espace candidat */}
        <section id="candidats" className="scroll-mt-20 px-5 py-20 sm:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2">
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">Espace candidat</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Vos candidats suivent leur dossier, sans vous appeler.
              </h2>
              <CheckList
                items={[
                  "Un code d'accès suffit : pas de compte à créer pour le candidat.",
                  "Il relit sa lettre et ses formations, puis valide en un clic ou demande une modification.",
                  "Il voit la réponse de chaque établissement et vous écrit depuis son espace.",
                ]}
              />
            </div>
            <div className="lg:order-1">
              <StudentMock />
            </div>
          </div>
        </section>

        {/* Démarrer */}
        <Section eyebrow="Démarrer" title="Opérationnel en trois étapes" className="border-t bg-muted/40">
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border bg-card p-6">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Tarifs */}
        <Section
          id="tarifs"
          eyebrow="Tarifs"
          title="Essayez d'abord, payez ensuite"
          intro="Un abonnement simple pour toute l'agence, au mois ou à l'année."
        >
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-8">
              <p className="font-semibold">Essai gratuit</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">7 jours</p>
              <p className="mt-1 text-sm text-muted-foreground">Toutes les fonctionnalités, sans engagement.</p>
              <CheckList
                items={[
                  "Sans carte bancaire",
                  "Équipe et espace candidat compris",
                  "Vos données restent consultables après l'essai",
                ]}
              />
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}>
                Créer mon agence
              </Link>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/10">
              <p className="font-semibold">Abonnement</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">Sur devis</p>
              <p className="mt-1 text-sm text-muted-foreground">Au mois ou à l&apos;année, selon votre agence.</p>
              <CheckList
                items={[
                  "Paiement en espèces, par CCP ou BaridiMob",
                  "Toutes les fonctionnalités, pour toute l'agence",
                  "Renouvellement simple, sans prélèvement automatique",
                ]}
              />
              <div className="mt-8">
                {contact ? (
                  <ContactButtons contact={contact} />
                ) : (
                  <Link href="/register" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}>
                    Commencer par l&apos;essai
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
              { icon: ShieldCheck, title: "Données isolées", text: "Chaque agence ne voit que ses propres dossiers, jamais ceux des autres." },
              { icon: LockKeyhole, title: "Mots de passe chiffrés", text: "Les identifiants des comptes externes de vos candidats sont chiffrés." },
              { icon: KeyRound, title: "Accès maîtrisés", text: "Vous ouvrez, fermez ou renouvelez l'accès de chaque candidat à tout moment." },
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
          <div className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Appel final */}
        <section className="px-5 pb-20 sm:px-8 md:pb-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[oklch(0.18_0.035_265)] px-6 py-16 text-center text-white sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[oklch(0.55_0.22_262)] opacity-30 blur-[120px]"
            />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Prêt à mettre de l&apos;ordre dans vos dossiers ?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/65">
                Créez votre agence et essayez {BRAND.name} gratuitement pendant 7 jours.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/register" className={buttonVariants({ size: "lg" })}>
                  Créer mon agence <ArrowRight />
                </Link>
              </div>
              {contact && (
                <div className="mt-6">
                  <p className="mb-3 text-sm text-white/50">Une question ? Parlons-en.</p>
                  <ContactButtons contact={contact} onDark />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4" strokeWidth={1.8} />
            </span>
            © {year} {BRAND.name}
          </span>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/login" className="hover:text-foreground">Se connecter</Link>
            <Link href="/register" className="hover:text-foreground">Créer une agence</Link>
            <Link href="/student/login" className="hover:text-foreground">Espace candidat</Link>
            <Link href="#faq" className="hover:text-foreground">FAQ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
