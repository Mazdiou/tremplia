// Assistant « Adresse Outlook » et remise des comptes au candidat. Microsoft
// ne permet pas de créer le compte à la place de l'agence (CAPTCHA,
// vérification) : on lui prépare tout ce qu'elle doit saisir, puis le compte
// est enregistré parmi les comptes externes du dossier.

export const OUTLOOK_PLATFORM = "Outlook";
export const OUTLOOK_SIGNUP_URL = "https://signup.live.com/";
export const OUTLOOK_URL = "https://outlook.live.com/";
export const OUTLOOK_DOMAINS = ["outlook.com", "hotmail.com"] as const;
export type OutlookDomain = (typeof OUTLOOK_DOMAINS)[number];

// Compte Microsoft déjà prévu sous un autre nom : « Hotmail », « outlook.fr »…
export function isOutlookPlatform(platform: string) {
  return /^(outlook|hotmail|live|microsoft)(\.(com|fr))?$/i.test(platform.trim());
}

// Règles de Microsoft pour la partie avant « @ » : lettres, chiffres, « . »,
// « _ » et « - », une lettre au début, pas de point à la fin ni deux points
// de suite, 64 caractères au plus.
export function isValidOutlookLocalPart(value: string) {
  return (
    /^[a-z][a-z0-9._-]{0,63}$/i.test(value) && !value.endsWith(".") && !value.includes("..")
  );
}

// « Mohamed-Amine » → « mohamedamine », « N'Diaye » → « ndiaye » : un nom
// écrit dans un autre alphabet donne une chaîne vide
function slug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Adresses proposées, de la plus simple à la plus particulière : si
// Microsoft dit que la première est prise, l'agence essaie la suivante.
export function outlookAddressSuggestions(
  firstName: string,
  lastName: string,
  birthDate: string | null,
) {
  const f = slug(firstName);
  const l = slug(lastName);
  if (!f || !l) return [];
  const year = /^\d{4}-/.test(birthDate ?? "") ? birthDate!.slice(0, 4) : "";
  const candidates = [
    `${f}.${l}`,
    year && `${f}.${l}${year}`,
    `${l}.${f}`,
    year && `${f}.${l}${year.slice(2)}`,
    year && `${f}${l}${year}`,
    year && `${f[0]}.${l}${year}`,
    `${f}.${l}.etudes`,
  ];
  return [...new Set(candidates.filter((c): c is string => !!c && isValidOutlookLocalPart(c)))];
}

// Mots simples, sans accent, faciles à dicter au candidat
export const PASSWORD_WORDS = [
  "Abeille", "Abricot", "Agneau", "Aigle", "Album", "Amande", "Ananas", "Ancre",
  "Arbre", "Argent", "Atlas", "Avion", "Badge", "Balcon", "Bambou", "Banane",
  "Bateau", "Biche", "Biscuit", "Bison", "Bonbon", "Bougie", "Boussole", "Bouton",
  "Brioche", "Cabane", "Cactus", "Cadeau", "Camion", "Canal", "Canard", "Caramel",
  "Carotte", "Carte", "Castor", "Cerise", "Chalet", "Chameau", "Chapeau", "Chemin",
  "Cheval", "Citron", "Clavier", "Cloche", "Cobalt", "Colibri", "Corail", "Coton",
  "Crayon", "Cristal", "Cygne", "Dauphin", "Delta", "Domino", "Dragon", "Dune",
  "Faucon", "Ferme", "Ficelle", "Figue", "Flamme", "Fleur", "Flocon", "Fraise",
  "Galaxie", "Galet", "Gazelle", "Girafe", "Glace", "Gomme", "Granit", "Grenade",
  "Grotte", "Guitare", "Hamac", "Harpe", "Hibou", "Horizon", "Igloo", "Indigo",
  "Jaguar", "Jardin", "Jasmin", "Jonquille", "Jungle", "Kayak", "Kiwi", "Koala",
  "Lagon", "Lampe", "Lanterne", "Lapin", "Laurier", "Lavande", "Lettre", "Lilas",
  "Lion", "Livre", "Lotus", "Loup", "Lune", "Lynx", "Mangue", "Marbre",
  "Marin", "Marmotte", "Melon", "Menthe", "Miel", "Miroir", "Montagne", "Mouette",
  "Moulin", "Mouton", "Muguet", "Navire", "Neige", "Noisette", "Nuage", "Oasis",
  "Olive", "Orage", "Orange", "Orque", "Ours", "Palmier", "Panda", "Paon",
  "Papaye", "Papier", "Perle", "Phare", "Piano", "Pinceau", "Plage", "Plume",
  "Poire", "Poivre", "Pomme", "Pommier", "Pont", "Prairie", "Prune", "Puzzle",
  "Quartz", "Radis", "Radio", "Raisin", "Rayon", "Renard", "Requin", "Rivage",
  "Robot", "Rocher", "Rose", "Rubis", "Ruisseau", "Sable", "Safran", "Salade",
  "Sapin", "Saphir", "Satin", "Sauge", "Silex", "Sirop", "Soleil", "Sommet",
  "Source", "Tambour", "Tango", "Tapis", "Tigre", "Tilleul", "Tomate", "Topaze",
  "Tortue", "Toucan", "Train", "Truite", "Tulipe", "Vague", "Valise", "Vanille",
  "Velours", "Verger", "Violon", "Voile", "Volcan", "Wagon", "Yaourt", "Zephyr",
  "Balise", "Bocal", "Cascade", "Fanfare", "Gaufre", "Hangar", "Pivoine", "Tonneau",
];

// Entier au hasard dans [0, max), sans biais (tirages rejetés au-delà du
// dernier multiple de max)
function randomBelow(max: number, random: (buffer: Uint32Array) => Uint32Array) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    const n = random(buffer)[0];
    if (n < limit) return n % max;
  }
}

// « Soleil-Cactus-Plume-4827 » : trois mots et quatre chiffres (environ
// 36 bits), avec majuscules, minuscules, chiffres et symbole comme Microsoft
// le demande. `random` : générateur à remplacer dans les tests.
export function generateAccountPassword(
  random: (buffer: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b),
) {
  const words = Array.from(
    { length: 3 },
    () => PASSWORD_WORDS[randomBelow(PASSWORD_WORDS.length, random)],
  );
  const digits = String(randomBelow(10_000, random)).padStart(4, "0");
  return [...words, digits].join("-");
}

export type HandoverAccount = {
  platform: string;
  url: string | null;
  login: string | null;
  password: string | null;
};

// Message de remise des comptes au candidat, à copier ou à envoyer par
// WhatsApp (modifiable avant l'envoi)
export function handoverMessage({
  candidate,
  agencyName,
  accounts,
}: {
  // Prénom du candidat
  candidate: string;
  agencyName: string;
  accounts: HandoverAccount[];
}) {
  const blocks = accounts.map((a) =>
    [
      a.platform,
      a.login && `Identifiant : ${a.login}`,
      a.password && `Mot de passe : ${a.password}`,
      a.url && `Site : ${a.url}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `Bonjour ${candidate},`,
    accounts.length > 1
      ? "Voici les comptes créés pour votre dossier :"
      : "Voici le compte créé pour votre dossier :",
    ...blocks,
    "Gardez ce message en lieu sûr et ne le transmettez à personne.",
    agencyName,
  ]
    .filter(Boolean)
    .join("\n\n");
}
