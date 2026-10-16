import { useEffect, useRef } from "react";

// <dialog> natif (Échap, focus piégé, fond grisé) affiché en fenêtre modale
// tant que `open` est vrai. Renvoie la référence à poser sur le <dialog>.
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}
