// Affiché tout de suite au clic, le temps que le serveur réponde : la
// navigation semble immédiate et rien ne saute à l'arrivée du contenu.
export function LoadingPlaceholder({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <div role="status" aria-label="Chargement" className="animate-pulse">
      {withHeader && (
        <div className="border-b">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-5 md:px-8">
            <div className="h-7 w-56 rounded-lg bg-muted" />
            <div className="h-4 w-80 max-w-full rounded bg-muted" />
            <div className="h-8 w-full max-w-md rounded-lg bg-muted" />
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
