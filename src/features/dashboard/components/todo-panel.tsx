import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Globe,
  MessageSquareWarning,
  MessagesSquare,
  Send,
} from "lucide-react";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { Todo, TodoItem } from "../server/dashboard";
import { Initials, relativeDay } from "./dashboard-ui";
import { plural } from "@/lib/plural";
import { CountBadge } from "@/components/page-ui";

// « À traiter » : ce qui attend l'agence, avec un accès direct au bon onglet
// du dossier (ou à la demande d'inscription en ligne). Rien n'est à cocher :
// une ligne disparaît d'elle-même quand la situation est réglée (demande
// acceptée ou refusée, message lu, modification faite, candidature envoyée).

const SHOWN = 4;

const GROUPS = [
  {
    key: "signups",
    title: "Inscriptions en ligne",
    icon: Globe,
    tone: "text-primary",
    href: (id: string) => `/cases/inscriptions#${id}`,
  },
  {
    key: "changes",
    title: "Modifications demandées",
    icon: MessageSquareWarning,
    tone: "text-amber-700 dark:text-amber-300",
    href: (id: string) => `/cases/${id}/messages`,
  },
  {
    key: "unread",
    title: "Messages non lus",
    icon: MessagesSquare,
    tone: "text-primary",
    href: (id: string) => `/cases/${id}/messages`,
  },
  {
    key: "approved",
    title: "Candidatures à envoyer",
    icon: Send,
    tone: "text-success",
    href: (id: string) => `/cases/${id}/programs`,
  },
] as const;

function Row({ item, href }: { item: TodoItem; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
      >
        <Initials first={item.first_name} last={item.last_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {displayName(item.first_name, item.last_name)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
        </span>
        {item.when && (
          <span className="shrink-0 text-xs text-muted-foreground">{relativeDay(item.when)}</span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </Link>
    </li>
  );
}

export function TodoPanel({ todo }: { todo: Todo }) {
  const groups = GROUPS.map((g) => ({ ...g, items: todo[g.key] })).filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section
      aria-labelledby="todo-title"
      className={cn(
        "rounded-2xl border bg-card",
        total > 0 && "border-primary/30",
      )}
    >
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <h2 id="todo-title" className="text-sm font-semibold">
          À traiter
        </h2>
        {total > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          Rien en attente.
        </p>
      ) : (
        <div className="grid gap-x-8 gap-y-5 px-5 py-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {groups.map(({ key, title, icon: Icon, tone, href, items }) => (
            <div key={key} className="min-w-0">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Icon className={cn("size-4", tone)} aria-hidden />
                {title}
                <CountBadge count={items.length} />
              </h3>
              <ul className="mt-2">
                {items.slice(0, SHOWN).map((item) => (
                  <Row key={item.id} item={item} href={href(item.id)} />
                ))}
              </ul>
              {items.length > SHOWN && (
                <p className="mt-1 text-xs text-muted-foreground">
                  et {plural(items.length - SHOWN, "autre")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
