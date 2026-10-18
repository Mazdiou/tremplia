import { cn } from "@/lib/utils";

// Symbole de l'application : un cairn de quatre pierres (24 × 24), le même
// partout — écrans, icônes (src/features/pwa/app-icon.tsx), page hors ligne.
export const CAIRN_SHAPES =
  '<ellipse cx="12" cy="19.3" rx="8.4" ry="2.5"/>' +
  '<ellipse cx="11.3" cy="14.1" rx="6.4" ry="2.2"/>' +
  '<ellipse cx="12.5" cy="9.3" rx="4.6" ry="2"/>' +
  '<ellipse cx="11.8" cy="5" rx="2.8" ry="1.7"/>';

// Le symbole en SVG autonome, blanc, pour les pages et images hors React
export function cairnSvg(size?: number) {
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${dims} fill="#ffffff">${CAIRN_SHAPES}</svg>`;
}

// Le symbole sur son carré bleu, à côté du nom de l'application
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-[64%]"
        dangerouslySetInnerHTML={{ __html: CAIRN_SHAPES }}
      />
    </span>
  );
}
