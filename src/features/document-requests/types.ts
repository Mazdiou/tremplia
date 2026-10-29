// Pièce demandée telle que la voit le candidat dans son espace. Acceptée :
// par un membre, ou document verrouillé par le patron (il ne peut plus la
// changer dans les deux cas).
export type StudentRequestItem = {
  id: string;
  label: string;
  status: "pending" | "sent" | "accepted";
  document: { fileName: string; sizeLabel: string; dateLabel: string } | null;
};

// Pièce demandée telle que l'affiche l'onglet Documents de l'agence

export type RequestStatus = "pending" | "received" | "accepted";

export type RequestItem = {
  id: string;
  label: string;
  folderId: string | null;
  status: RequestStatus;
  // Document reçu (null : en attente)
  document: {
    id: string;
    fileName: string;
    sizeLabel: string;
    dateLabel: string;
    // Verrouillé par le patron : le candidat n'y touche plus non plus
    locked: boolean;
  } | null;
};
