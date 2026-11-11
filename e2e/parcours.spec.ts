import { createHash } from "node:crypto";
import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { emailLink } from "./mailpit";

// Parcours principal d'une agence, de l'inscription à l'échange avec le
// candidat. Les étapes s'enchaînent : chacune part de ce que la précédente a
// créé (agence, campagne, dossier, code d'accès).
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const owner = {
  email: `patron-${run}@e2e.test`,
  password: "E2e-mot-de-passe-1",
};
const candidate = { firstName: "Amine", lastName: `Madiou${run}` };

let page: Page;
let caseUrl = "";
let campaignUrl = "";
let studentCode = "";

// Un PDF minimal : le serveur vérifie seulement la signature « %PDF- »
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test("un visiteur non connecté est renvoyé vers la connexion", async () => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login$/);
});

test("une adresse inconnue répond « Page introuvable » (404), sans renvoyer vers la connexion", async () => {
  const response = await page.goto("/page-qui-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/page-qui-n-existe-pas$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Page introuvable");
});

test("les pages de connexion tiennent sans barre de défilement sur un portable", async ({ browser }) => {
  // Portable 1366 × 768, une fois retirées les barres du navigateur et de Windows
  const laptop = await browser.newPage({ viewport: { width: 1366, height: 657 } });
  // Hauteur qui dépasse de la colonne du formulaire (0 : pas de barre)
  const overflow = () =>
    laptop.evaluate(() => {
      const main = document.querySelector("main")!;
      return main.scrollHeight - main.clientHeight;
    });

  for (const path of ["/login", "/student/login", "/forgot-password", "/register"]) {
    await laptop.goto(path);
    await expect(laptop.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await overflow(), path).toBe(0);
  }
  // Seconde étape de l'inscription, la plus longue
  await laptop.getByLabel("Nom de l'agence").fill("Agence");
  await laptop.getByLabel("Ville").fill("Alger");
  await laptop.getByLabel("Téléphone de l'agence").fill("0550 00 00 00");
  await laptop.getByRole("button", { name: "Continuer" }).click();
  await expect(laptop.getByLabel("Prénom")).toBeVisible();
  expect(await overflow(), "/register, étape 2").toBe(0);
  await laptop.close();
});

test("inscription d'une agence puis connexion du patron", async () => {
  await page.goto("/register");
  await page.getByLabel("Nom de l'agence").fill(`Agence E2E ${run}`);
  await page.getByLabel("Ville").fill("Alger");
  await page.getByLabel("Téléphone de l'agence").fill("0550 00 00 00");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("Prénom").fill("Patron");
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  await page.getByLabel("Adresse e-mail").fill(owner.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(owner.password);
  await page.getByLabel(/J'accepte les conditions générales/).check();
  await page.getByRole("button", { name: "Démarrer l'essai gratuit" }).click();
  await expect(page.getByRole("heading", { name: "Confirmez votre adresse e-mail" })).toBeVisible();
  await expect(page.getByText(/Un e-mail vient de partir/)).toBeVisible();

  // Adresse pas encore confirmée : connexion refusée, avec un nouvel e-mail
  // proposé
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(owner.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/Confirmez d'abord votre adresse/)).toBeVisible();
  await page.getByRole("button", { name: "Renvoyer l'e-mail de confirmation" }).click();
  await expect(page.getByText("Nouvel e-mail envoyé", { exact: false })).toBeVisible();

  // Le lien reçu confirme l'adresse et ouvre la session
  await page.goto(await emailLink(owner.email, "Confirmez votre adresse"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("mot de bienvenue puis guide de démarrage", async () => {
  const welcome = page.getByRole("dialog", { name: /Bienvenue/ });
  await expect(welcome).toBeVisible();
  // « Vu » est enregistré en arrière-plan : on attend la réponse avant de
  // recharger, sinon la page rechargée peut arriver avant l'enregistrement
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/onboarding/welcome"));
  await welcome.getByRole("button", { name: "C'est parti" }).click();
  await expect(welcome).toBeHidden();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("progressbar", { name: "Avancement" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );

  // Vu une fois : il ne revient pas
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bien démarrer" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Bienvenue/ })).toBeHidden();
});

test("import du modèle Campus France", async () => {
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Importer ce modèle" }).first().click();
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]{36}$/);
  campaignUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Campus France");
});

test("création d'un dossier avec un premier paiement", async () => {
  await page.goto("/cases/new");
  const campaign = page.locator("#campaignId");
  if ((await campaign.inputValue()) === "") {
    await campaign.selectOption({ index: 1 });
  }
  await page.locator("#lastName").fill(candidate.lastName);
  await page.locator("#firstName").fill(candidate.firstName);
  await page.locator("#birthDate").fill("2005-03-14");
  await page.locator("#phone").fill("0555 12 34 56");
  await page.locator("#educationLevel").selectOption({ index: 1 });
  await page.locator("#agreedAmount").fill("150000");
  await page.locator("#paidToday").fill("50000");
  await page.locator("#paidMethod").selectOption("cash");
  await page.getByRole("button", { name: "Créer le dossier" }).click();

  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  caseUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toContainText(candidate.firstName);

  await page.goto(`${caseUrl}/payments`);
  await expect(page.getByText("Espèces").first()).toBeVisible();
});

test("envoi d'un PDF dans les documents", async () => {
  await page.goto(`${caseUrl}/documents`);
  // Par le bouton, qui ne répond qu'une fois la page interactive : un
  // fichier posé plus tôt dans le champ serait ignoré
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choisir des fichiers" }).click();
  await (await chooser).setFiles({
    name: "passeport.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await expect(page.getByRole("button", { name: "Ouvrir passeport" })).toBeVisible();
});

test("copie des documents sur l'ordinateur", async () => {
  // Le navigateur de test ne sait pas répondre à la fenêtre de choix d'un
  // dossier : elle est remplacée par un dossier privé du navigateur (OPFS),
  // qui s'écrit avec la même API
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker =
      async () => (await navigator.storage.getDirectory()).getDirectoryHandle("Copie", { create: true });
  });
  await page.goto("/settings");
  const section = page.locator("#ordinateur");
  await section.getByRole("button", { name: "Choisir le dossier" }).click();
  await expect(section.getByText("Copie à jour : 1 document copié.")).toBeVisible();

  const files = await page.evaluate(async () => {
    const out: string[] = [];
    async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === "directory") await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
        else out.push(`${prefix}${name}`);
      }
    }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle("Copie"), "");
    return out;
  });
  // Campagne / groupe (ou « Non classés ») / NOM Prénom / document
  const folder = `${candidate.lastName.toLocaleUpperCase("fr")} ${candidate.firstName}`;
  expect(files.some((f) => /^[^/]+\/[^/]+\//.test(f) && f.endsWith(`/${folder}/passeport.pdf`))).toBe(true);
});

test("photos assemblées en un PDF de plusieurs pages", async () => {
  await page.goto(`${caseUrl}/documents`);
  // Deux photos (portrait puis paysage) dessinées par le navigateur
  const photo = (width: number, height: number, color: string) =>
    page.evaluate(
      ({ width, height, color }) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#000";
        ctx.font = "80px sans-serif";
        ctx.fillText("Relevé de notes", 40, 200);
        return c.toDataURL("image/png").split(",")[1];
      },
      { width, height, color },
    );
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choisir des fichiers" }).click();
  await (await chooser).setFiles([
    { name: "IMG_0001.png", mimeType: "image/png", buffer: Buffer.from(await photo(1500, 2000, "#fde68a"), "base64") },
    { name: "IMG_0002.png", mimeType: "image/png", buffer: Buffer.from(await photo(2000, 1500, "#bfdbfe"), "base64") },
  ]);

  const composer = page.getByRole("region", { name: "Photos à transformer en PDF" });
  await expect(composer.getByText("2 photos à transformer en PDF")).toBeVisible();
  // La deuxième photo passe en premier, puis revient
  await composer.getByRole("button", { name: "Avancer la page 2" }).click();
  await expect(composer.getByRole("img").first()).toHaveAttribute("alt", "Page 1 : IMG_0002.png");
  await composer.getByRole("button", { name: "Reculer la page 1" }).click();
  await expect(composer.getByRole("img").first()).toHaveAttribute("alt", "Page 1 : IMG_0001.png");

  await composer.getByLabel("Nom du document").fill("Relevé de notes");
  await composer.getByRole("button", { name: "Créer le PDF" }).click();
  await expect(page.getByRole("button", { name: "Ouvrir Relevé de notes" })).toBeVisible();
  await expect(composer).toBeHidden();

  // Le fichier enregistré est un PDF de deux pages contenant les photos en JPEG
  // (lien signé lu dans la réponse : le navigateur de test n'affiche pas les PDF)
  const opened = page.waitForResponse((r) => /\/documents\/[0-9a-f-]{36}\/open$/.test(r.url()));
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Ouvrir Relevé de notes" }).click();
  const { url } = (await (await opened).json()) as { url: string };
  await (await popup).close();
  const res = await page.request.get(url);
  const pdf = (await res.body()).toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect(pdf).toContain("/Count 2");
  expect(pdf.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
});

test("ouverture de l'espace candidat", async () => {
  await page.goto(caseUrl);
  await page.getByRole("button", { name: "Ouvrir l'accès" }).click();
  const code = page.locator("code").filter({ hasText: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/ });
  await expect(code).toBeVisible();
  studentCode = (await code.textContent())!.trim();
});

test("adresse Outlook préparée par l'assistant, puis comptes remis au candidat", async () => {
  await page.goto(caseUrl);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Adresse Outlook (assistant)" }).click();

  const assistant = page.getByRole("dialog", { name: /Créer une adresse Outlook/ });
  const local = `amine.${candidate.lastName.toLowerCase()}`;
  await expect(assistant.getByLabel("Adresse", { exact: true })).toHaveValue(local);
  // Deuxième proposition : avec l'année de naissance
  await assistant.getByRole("button", { name: `${local}2005`, exact: true }).click();
  await expect(assistant.getByLabel("Adresse", { exact: true })).toHaveValue(`${local}2005`);
  const password = await assistant.getByRole("textbox", { name: "Mot de passe" }).inputValue();
  expect(password).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  await expect(assistant.getByRole("link", { name: /inscription Microsoft/ })).toHaveAttribute(
    "href",
    "https://signup.live.com/",
  );
  await expect(assistant.getByText("14 mars 2005")).toBeVisible();

  // Refermée puis rouverte : mêmes valeurs
  await assistant.getByRole("button", { name: "Fermer" }).click();
  await expect(assistant).toBeHidden();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Adresse Outlook (assistant)" }).click();
  await expect(assistant.getByRole("textbox", { name: "Mot de passe" })).toHaveValue(password);

  await assistant.getByRole("button", { name: "Compte créé : enregistrer", exact: true }).click();
  await expect(assistant).toBeHidden();
  const address = `${local}2005@outlook.com`;
  // Le compte est une pastille : sa fiche montre l'identifiant
  const chip = page.getByRole("button", { name: "Compte Outlook", exact: true });
  await chip.click();
  const details = page.getByRole("dialog", { name: "Compte Outlook", exact: true });
  await expect(details.getByText(address)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(chip).toBeFocused();
  // Un compte Outlook existe : « Ajouter » ouvre directement le formulaire
  await expect(page.getByRole("button", { name: "Ajouter", exact: true })).not.toHaveAttribute(
    "aria-haspopup",
  );

  await page.getByRole("button", { name: "Autres actions sur les comptes" }).click();
  await page.getByRole("menuitem", { name: "Remettre au candidat" }).click();
  const handover = page.getByRole("dialog", { name: "Remettre les comptes au candidat" });
  const message = handover.getByLabel("Message (modifiable)");
  await expect(message).toHaveValue(new RegExp(`Identifiant : ${address.replace(/\./g, "\\.")}`));
  await expect(message).toHaveValue(new RegExp(`Mot de passe : ${password}`));
  await expect(handover.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/213555123456\?text=Bonjour%20Amine/,
  );
  await handover.getByRole("button", { name: "Fermer" }).click();
  await expect(handover).toBeHidden();

  await page.goto(`${caseUrl}/history`);
  await expect(page.getByText("a affiché les comptes à remettre au candidat")).toHaveCount(1);
  await expect(page.getByText("a enregistré un compte externe")).toHaveCount(1);
});

test("le guide coche les étapes faites", async () => {
  await page.goto("/dashboard");
  // Campagne, dossier, document et espace candidat
  await expect(page.getByRole("progressbar", { name: "Avancement" })).toHaveAttribute(
    "aria-valuenow",
    "4",
  );
  // Prochaine étape : la page d'inscription en ligne, qui mène aux réglages
  await expect(
    page.getByRole("button", { name: /Ouvrir votre page d'inscription en ligne/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Ouvrir ma page" })).toHaveAttribute(
    "href",
    "/settings#inscription",
  );
});

test("tableau de bord personnalisé puis remis à la disposition de départ", async () => {
  await page.goto("/dashboard");
  const results = page.getByRole("heading", { name: "Réponses des établissements" });
  await expect(results).toBeVisible();

  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("button", { name: "Masquer Réponses des établissements" }).click();
  await expect(page.getByRole("button", { name: "Masquer Réponses des établissements" })).toHaveCount(0);
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/dashboard/layout"));
  await page.getByRole("button", { name: "Enregistrer" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mes tâches" })).toBeVisible();
  await expect(results).toBeHidden();

  // Ajout depuis le panneau : le widget arrive en tête
  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("button", { name: /Ajouter un widget/ }).click();
  const panel = page.getByRole("dialog", { name: "Ajouter un widget" });
  await panel.getByRole("button", { name: "Ajouter Réponses des établissements" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Monter Réponses des établissements" })).toBeDisabled();
  await page.getByRole("button", { name: "Annuler" }).click();

  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("button", { name: "Disposition de départ" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeHidden();
  await expect(results).toBeVisible();
});

test("disposition proposée à l'équipe puis retirée par le patron", async () => {
  await page.goto("/dashboard");
  const results = page.getByRole("heading", { name: "Réponses des établissements" });
  // Éditeur fermé (pendant l'envoi, « Enregistrer » devient « Enregistrement… »)
  const editor = page.getByRole("heading", { name: "Personnaliser" });
  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("button", { name: "Masquer Réponses des établissements" }).click();
  await page.getByLabel(/Proposer aussi à toute l'équipe/).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(editor).toBeHidden();
  await expect(results).toBeHidden();

  // Retrait après « Disposition de départ » : l'éditeur reste ouvert et la
  // disposition de départ devient celle de l'application
  await page.getByRole("button", { name: "Personnaliser" }).click();
  await page.getByRole("button", { name: "Disposition de départ" }).click();
  await page.getByRole("button", { name: "Retirer celle proposée à l'équipe" }).click();
  const removed = page.waitForResponse((r) => r.url().endsWith("/api/dashboard/layout/agency"));
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  expect((await removed).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Retirer celle proposée à l'équipe" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Masquer Réponses des établissements" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(editor).toBeHidden();
  await expect(results).toBeVisible();
});

test("le candidat se connecte et écrit à l'agence", async ({ browser }) => {
  const student = await browser.newPage();
  await student.goto("/student/login");
  await student.getByLabel("Code d'accès").fill(studentCode);
  await student.getByRole("button", { name: "Accéder à mon dossier" }).click();
  await expect(student).toHaveURL(/\/student$/);
  await expect(student.getByRole("heading", { level: 1 })).toContainText(candidate.firstName);

  await student.goto("/student/messages");
  await student.getByLabel("Votre message").fill("Bonjour, j'ai une question.");
  await student.getByRole("button", { name: "Envoyer" }).click();
  await expect(student.getByRole("list", { name: "Conversation" })).toContainText(
    "Bonjour, j'ai une question.",
  );
  await student.close();

  // L'agence voit le message dans l'onglet Messages du dossier
  await page.goto(`${caseUrl}/messages`);
  await expect(page.getByRole("list", { name: "Conversation" })).toContainText(
    "Bonjour, j'ai une question.",
  );
});

test("pièce demandée par l'agence, envoyée par le candidat, puis acceptée", async ({ browser }) => {
  // L'agence demande une pièce
  await page.goto(`${caseUrl}/documents`);
  const requests = page.getByRole("region", { name: "Pièces demandées au candidat" });
  await requests.getByRole("button", { name: "Demander une pièce" }).click();
  await requests.getByLabel("Nom de la pièce").fill("Relevé de notes");
  await requests.getByRole("button", { name: "Demander", exact: true }).click();
  const agencyRow = requests.getByRole("listitem").filter({ hasText: "Relevé de notes" });
  await expect(agencyRow.getByText("En attente")).toBeVisible();

  // Le candidat l'envoie depuis l'onglet « Pièces » de son espace
  const student = await browser.newPage();
  await student.goto("/student/login");
  await student.getByLabel("Code d'accès").fill(studentCode);
  await student.getByRole("button", { name: "Accéder à mon dossier" }).click();
  await expect(student).toHaveURL(/\/student$/);
  await student.getByRole("navigation", { name: "Sections de mon dossier" }).getByRole("link", { name: /Pièces/ }).click();
  const studentRow = student.getByRole("listitem", { name: "Relevé de notes" });
  await expect(studentRow.getByText("À envoyer")).toBeVisible();
  const chooser = student.waitForEvent("filechooser");
  await studentRow.getByRole("button", { name: "Envoyer" }).click();
  await (await chooser).setFiles({ name: "releve.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(studentRow.getByText(/Pièce envoyée/)).toBeVisible();
  await expect(studentRow.getByText("Envoyée", { exact: true })).toBeVisible();

  // L'agence la voit arriver, l'accepte ; le candidat ne peut plus la changer
  await page.reload();
  await expect(agencyRow.getByText("À vérifier")).toBeVisible();
  await agencyRow.getByRole("button", { name: "Accepter" }).click();
  await expect(agencyRow.getByText("Acceptée")).toBeVisible();

  await student.reload();
  await expect(studentRow.getByText("Acceptée", { exact: true })).toBeVisible();
  await expect(studentRow.getByRole("button", { name: /Remplacer|Retirer/ })).toHaveCount(0);
  await student.close();
});

test("un mauvais code d'accès est refusé", async ({ browser }) => {
  const student = await browser.newPage();
  await student.goto("/student/login");
  await student.getByLabel("Code d'accès").fill("ZZZZ-ZZZZ");
  await student.getByRole("button", { name: "Accéder à mon dossier" }).click();
  // Le message du formulaire, pas l'annonceur de navigation de Next (lui
  // aussi role="alert")
  await expect(student.getByRole("alert").filter({ hasText: "Code incorrect" })).toBeVisible();
  await expect(student).toHaveURL(/\/student\/login$/);
  await student.close();
});

test("inscription en ligne : page ouverte, demande acceptée en dossier, autre demande refusée", async ({
  browser,
}) => {
  // Page fermée : le patron découvre la fonction dans l'arbre et sur
  // « Nouveau dossier » (encadré qu'on peut masquer pour de bon)
  await page.goto("/cases/new");
  await expect(page.getByRole("link", { name: "Inscriptions en ligne (Fermée)" })).toBeVisible();
  const hint = page.getByRole("complementary", { name: "Inscription en ligne" });
  await expect(hint).toBeVisible();
  await hint.getByRole("button", { name: "Ne plus afficher" }).click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(page.locator("#lastName")).toBeVisible();
  await expect(hint).toBeHidden();

  // Le patron ouvre la page et propose la campagne importée
  await page.goto("/settings#inscription");
  const section = page.locator("#inscription");
  await section.getByLabel("Page d'inscription ouverte").check();
  await expect(section.getByLabel(/Adresse de la page/)).toHaveValue(`agence-e2e-${run}`);
  await section.getByText(/Campus France/).click();
  await section.getByRole("button", { name: "Enregistrer" }).click();
  await expect(section.getByRole("status")).toContainText("Modifications enregistrées");
  await expect(section.getByText("Votre page est en ligne")).toBeVisible();
  const signupPath = `/inscription/agence-e2e-${run}`;
  await expect(section.getByText(signupPath)).toBeVisible();

  // L'étape du guide est cochée, la ligne de l'arbre n'est plus « Fermée »
  await page.goto("/dashboard");
  await expect(page.getByRole("progressbar", { name: "Avancement" })).toHaveAttribute(
    "aria-valuenow",
    "5",
  );
  await page.goto("/cases");
  await expect(page.getByRole("link", { name: "Inscriptions en ligne", exact: true })).toBeVisible();

  // Un candidat, sans compte, s'inscrit en quatre étapes
  async function signUp(firstName: string, lastName: string, message = "") {
    const visitor = await browser.newPage();
    await visitor.goto(signupPath);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText(`Agence E2E ${run}`);
    await visitor.locator("#firstName").fill(firstName);
    await visitor.locator("#lastName").fill(lastName);
    await visitor.locator("#birthDate").fill("2006-01-20");
    await visitor.locator("#phone").fill("0661 22 33 44");
    await visitor.getByRole("button", { name: "Continuer" }).click();
    // Une seule campagne proposée : rien à choisir
    await expect(visitor.getByText(/Campagne : .*Campus France/)).toBeVisible();
    if (message) await visitor.getByLabel("Votre projet en quelques mots").fill(message);
    await visitor.getByRole("button", { name: "Continuer" }).click();
    // Étape vérifiée avant de passer à la suivante
    await visitor.getByRole("button", { name: "Continuer" }).click();
    await expect(visitor.getByText("Choisissez le niveau d'études")).toBeVisible();
    await visitor.locator("#educationLevel").selectOption("terminale");
    await visitor.getByRole("button", { name: "Continuer" }).click();
    await expect(visitor.getByRole("definition").filter({ hasText: `${firstName} ${lastName}` })).toBeVisible();
    await visitor.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(visitor.getByText("Cochez la case pour envoyer votre demande")).toBeVisible();
    await visitor.getByLabel(/J'accepte que ces informations soient transmises/).check();
    await visitor.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(visitor.getByRole("heading", { name: "Demande envoyée" })).toBeVisible();
    await visitor.close();
  }
  await signUp("Lina", `Haddad${run}`, "Je vise une licence d'informatique.");

  // L'agence la voit en haut de l'arbre, puis crée le dossier, prérempli
  await page.goto("/cases");
  await page.getByRole("link", { name: /Inscriptions en ligne/ }).click();
  await expect(page).toHaveURL(/\/cases\/inscriptions$/);
  const card = page.getByRole("listitem").filter({ hasText: `HADDAD${run.toUpperCase()} Lina` });
  await expect(card.getByText("Je vise une licence d'informatique.")).toBeVisible();
  await card.getByRole("link", { name: "Créer le dossier" }).click();
  await expect(page).toHaveURL(/\/cases\/new\?inscription=[0-9a-f-]{36}$/);
  const signupUrl = new URL(page.url()).pathname + new URL(page.url()).search;
  await expect(page.getByText(/Inscription en ligne reçue le/)).toBeVisible();
  await expect(page.locator("#lastName")).toHaveValue(`Haddad${run}`);
  await expect(page.locator("#initialNote")).toHaveValue("Je vise une licence d'informatique.");
  await page.getByRole("button", { name: "Créer le dossier" }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lina");

  // La demande a disparu ; son lien ne crée pas un second dossier
  await page.goto("/cases/inscriptions");
  await expect(page.getByText("Aucune demande en attente")).toBeVisible();
  await page.goto(signupUrl);
  await expect(page.getByText("Demande déjà traitée")).toBeVisible();

  // Une autre demande, refusée : elle est supprimée
  await signUp("Yanis", `Ouali${run}`);
  await page.goto("/cases/inscriptions");
  const other = page.getByRole("listitem").filter({ hasText: `OUALI${run.toUpperCase()} Yanis` });
  await other.getByRole("button", { name: "Refuser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Refuser la demande" }).click();
  await expect(page.getByText("Aucune demande en attente")).toBeVisible();
});

test("réglages : profil de l'agence et valeurs des nouvelles campagnes", async () => {
  await page.goto("/settings");
  const agency = page.locator("#agence");
  await agency.getByLabel("Nom de l'agence").fill(`Agence Réglée ${run}`);
  await agency.getByRole("button", { name: "Enregistrer" }).click();
  await expect(agency.getByRole("status")).toContainText("Modifications enregistrées");

  const defaults = page.locator("#campagnes");
  await defaults.getByLabel("Tarif par défaut").fill("120000");
  await defaults.getByLabel("Plateformes suggérées").fill("Pastel");
  await defaults.getByRole("button", { name: "Ajouter", exact: true }).click();
  await defaults.getByRole("button", { name: "Enregistrer" }).click();
  await expect(defaults.getByRole("status")).toContainText("Modifications enregistrées");

  // Une nouvelle campagne part de ces valeurs
  await page.goto("/campaigns/new");
  await expect(page.getByLabel("Tarif par défaut")).toHaveValue("120 000");
  await expect(page.getByRole("button", { name: "Retirer Pastel" })).toBeVisible();
});

test("réglages : choix des notifications, gardés pour ce membre", async () => {
  await page.goto("/settings#notifications");
  const section = page.locator("#notifications");
  const daily = section.getByRole("checkbox", { name: /Tâches du jour/ });
  // Par défaut : tout sauf le récapitulatif du matin
  await expect(section.getByRole("checkbox", { name: /Messages des candidats/ })).toBeChecked();
  await expect(daily).not.toBeChecked();
  await daily.check();
  await expect(section.getByRole("status").filter({ hasText: "Préférences enregistrées" })).toBeVisible();
  await page.reload();
  await expect(page.locator("#notifications").getByRole("checkbox", { name: /Tâches du jour/ })).toBeChecked();
});

test("réglages : changement du mot de passe", async () => {
  const newPassword = "E2e-nouveau-mdp-2";
  await page.goto("/settings");
  const form = page.locator("#mot-de-passe");

  await form.getByLabel("Mot de passe actuel", { exact: true }).fill("pas-le-bon-mdp");
  await form.getByLabel("Nouveau mot de passe", { exact: true }).fill(newPassword);
  await form.getByLabel("Confirmer le nouveau mot de passe", { exact: true }).fill(newPassword);
  await form.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(form.getByText("Mot de passe actuel incorrect")).toBeVisible();

  await form.getByLabel("Mot de passe actuel", { exact: true }).fill(owner.password);
  await form.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(form.getByRole("status")).toContainText("Mot de passe changé");

  // Déconnexion depuis les réglages, puis reconnexion avec le nouveau
  await page.locator("#connexion").getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Adresse e-mail").fill(owner.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("page Paiements : encaissements, restes à payer et export", async () => {
  const name = `${candidate.lastName.toLocaleUpperCase("fr")} ${candidate.firstName}`;
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Paiements" }).click();
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.getByRole("heading", { name: "Paiements", level: 1 })).toBeVisible();

  // Le paiement fait à la création du dossier (50 000 DA en espèces)
  const totals = page.getByRole("region", { name: "Totaux" });
  await expect(totals.getByText("50 000 DA").first()).toBeVisible();
  await expect(page.getByRole("link", { name })).toBeVisible();

  // Restes à payer : encaisser sans quitter la page
  await page.getByRole("link", { name: "Restes à payer" }).click();
  await expect(page).toHaveURL(/\/payments\?vue=restes$/);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name }) });
  await expect(row.getByText("Reste 100 000 DA")).toBeVisible();
  await row.getByRole("button", { name: `Encaisser un paiement de ${name}` }).click();
  await row.getByLabel("Montant payé").fill("30000");
  await row.getByLabel("Moyen de paiement").selectOption("ccp");
  await row.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Paiement de 30 000 DA enregistré" })).toBeVisible();
  await expect(row.getByText("Reste 70 000 DA")).toBeVisible();

  // Encaissements : total et répartition par moyen
  await page.getByRole("link", { name: "Encaissements" }).click();
  await expect(totals.getByText("80 000 DA")).toBeVisible();
  await expect(totals.getByText("30 000 DA")).toBeVisible();

  // Export Excel de la vue affichée
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en Excel" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^Encaissements - .+\.xlsx$/);
  const bytes = await (await import("node:fs/promises")).readFile((await file.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");

  // Autre période : rien
  await page.getByLabel("Période").selectOption("mois-dernier");
  await expect(page).toHaveURL(/periode=mois-dernier/);
  await expect(page.getByText("Aucun encaissement sur cette période")).toBeVisible();
});

test("permissions d'un employé : caisse et campagnes", async ({ browser }) => {
  const email = `employe-${run}@e2e.test`;
  const res = await page.request.post("/api/team/employees", {
    data: { firstName: "Sara", lastName: `Employee${run}`, email },
  });
  expect(res.status()).toBe(201);
  const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };

  const employee = await browser.newPage();
  await employee.goto("/login");
  await employee.getByLabel("Adresse e-mail").fill(email);
  await employee.getByLabel("Mot de passe", { exact: true }).fill(temporaryPassword);
  await employee.getByRole("button", { name: "Se connecter" }).click();
  await expect(employee).toHaveURL(/\/change-password$/);
  await employee.getByLabel("Nouveau mot de passe").fill("E2e-employe-mdp-1");
  await employee.getByRole("button", { name: "Enregistrer" }).click();
  await expect(employee).toHaveURL(/\/dashboard$/);

  // Sans permission : ni caisse, ni création de campagne
  const nav = employee.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Paiements" })).toHaveCount(0);
  await employee.goto("/payments");
  await expect(employee).toHaveURL(/\/dashboard$/);
  expect((await employee.request.get("/api/payments/export")).status()).toBe(403);
  await employee.goto("/campaigns");
  await expect(employee.getByRole("link", { name: "Créer une campagne" })).toHaveCount(0);

  // Le patron accorde « Voir les paiements » et « Gérer les campagnes »
  const name = `Sara Employee${run}`;
  await page.goto("/team");
  await page.getByRole("button", { name: `Modifier les permissions de ${name}` }).click();
  await page.getByRole("checkbox", { name: /Voir les paiements/ }).check();
  await page.getByRole("checkbox", { name: /Gérer les campagnes/ }).check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const granted = page.getByRole("list", { name: `Permissions de ${name}` });
  await expect(granted.getByText("Voir les paiements")).toBeVisible();
  await expect(granted.getByText("Gérer les campagnes")).toBeVisible();

  // (première visite : la fenêtre de bienvenue couvre le menu, on ne clique pas)
  await employee.goto("/dashboard");
  await expect(nav.getByRole("link", { name: "Paiements" })).toHaveCount(1);
  await employee.goto("/payments");
  await expect(employee).toHaveURL(/\/payments$/);
  await expect(employee.getByRole("heading", { name: "Paiements", level: 1 })).toBeVisible();
  expect((await employee.request.get("/api/payments/export")).status()).toBe(200);
  await employee.goto("/campaigns");
  await expect(employee.getByRole("link", { name: "Créer une campagne" })).toBeVisible();
  // … et en crée vraiment une, avec les valeurs par défaut de l'agence
  await employee.goto("/campaigns/new");
  await expect(employee.getByLabel("Tarif par défaut")).toHaveValue("120 000");
  await employee.getByLabel("Nom de la campagne").fill(`Campagne employé ${run}`);
  await employee.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(employee).toHaveURL(/\/campaigns\/[0-9a-f-]{36}$/);
  await expect(employee.getByRole("heading", { level: 1 })).toContainText(`Campagne employé ${run}`);

  // « Corriger les paiements » non accordée : pas d'annulation dans le dossier
  await employee.goto(`${caseUrl}/payments`);
  await expect(employee.getByText("Paiements reçus")).toBeVisible();
  await expect(employee.getByRole("button", { name: /^Annuler le paiement/ })).toHaveCount(0);
  await expect(employee.getByRole("button", { name: "Modifier le montant" })).toHaveCount(0);

  // Retrait : l'accès se ferme
  await page.getByRole("button", { name: `Modifier les permissions de ${name}` }).click();
  await page.getByRole("checkbox", { name: /Voir les paiements/ }).uncheck();
  await page.getByRole("checkbox", { name: /Gérer les campagnes/ }).uncheck();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Aucune permission en plus")).toBeVisible();
  await employee.goto("/payments");
  await expect(employee).toHaveURL(/\/dashboard$/);
  await employee.close();
});

test("une étape retirée se voit dans l'historique du dossier", async () => {
  const campaignId = campaignUrl.split("/").pop();
  const caseId = caseUrl.split("/").pop();
  const put = (stages: { id: string | null; name: string }[]) =>
    page.request.put(`/api/campaigns/${campaignId}/stages`, { data: { stages } });

  expect((await put([{ id: null, name: "Dépôt" }, { id: null, name: "Entretien" }])).ok()).toBe(true);
  await page.goto(caseUrl);
  const options = page.locator(`#stage-${caseId} option[value]:not([value=""])`);
  await expect(options).toHaveCount(2);
  const [first, second] = await options.evaluateAll((els) =>
    els.map((e) => ({ id: (e as HTMLOptionElement).value, name: e.textContent ?? "" })),
  );

  const moved = await page.request.patch(`/api/cases/${caseId}/stage`, {
    data: { stageId: second.id },
  });
  expect(moved.ok()).toBe(true);
  // « Entretien » retirée : le dossier recule à « Dépôt »
  const res = await put([first]);
  expect(await res.json()).toMatchObject({ moved: 1 });

  // Placé sur la 1re étape à sa création, avancé, puis reculé
  await page.goto(`${caseUrl}/history`);
  await expect(page.getByText("a changé l'étape du dossier")).toHaveCount(3);
});

test("un employé qui a un historique ne peut pas être supprimé", async ({ browser }) => {
  // Ses seules traces : le dossier clos puis rouvert, inscrits au journal
  // seulement.
  // Sans le contrôle du journal, la base le laisserait supprimer et son nom
  // disparaîtrait de l'historique.
  const email = `nadia-${run}@e2e.test`;
  const name = `Nadia Journal${run}`;
  const res = await page.request.post("/api/team/employees", {
    data: { firstName: "Nadia", lastName: `Journal${run}`, email },
  });
  expect(res.status()).toBe(201);
  const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };

  const employee = await browser.newPage();
  await employee.goto("/login");
  await employee.getByLabel("Adresse e-mail").fill(email);
  await employee.getByLabel("Mot de passe", { exact: true }).fill(temporaryPassword);
  await employee.getByRole("button", { name: "Se connecter" }).click();
  await employee.getByLabel("Nouveau mot de passe").fill("E2e-employe-mdp-2");
  await employee.getByRole("button", { name: "Enregistrer" }).click();
  await expect(employee).toHaveURL(/\/dashboard$/);
  const caseId = caseUrl.split("/").pop();
  for (const status of ["closed", "active"]) {
    const changed = await employee.request.patch(`/api/cases/${caseId}/status`, { data: { status } });
    expect(changed.ok()).toBe(true);
  }
  await employee.close();

  await page.goto("/team");
  const row = page.getByRole("listitem").filter({ hasText: name });

  // Mot de passe oublié : le patron lui en donne un temporaire
  await row.getByRole("button", { name: "Nouveau mot de passe" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Créer le mot de passe" }).click();
  const reset = (await row.getByRole("status").locator("code").textContent())!.trim();
  const again = await browser.newPage();
  await again.goto("/login");
  await again.getByLabel("Adresse e-mail").fill(email);
  await again.getByLabel("Mot de passe", { exact: true }).fill("E2e-employe-mdp-2");
  await again.getByRole("button", { name: "Se connecter" }).click();
  await expect(again.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await again.getByLabel("Mot de passe", { exact: true }).fill(reset);
  await again.getByRole("button", { name: "Se connecter" }).click();
  await expect(again).toHaveURL(/\/change-password$/);
  await again.close();

  await row.getByRole("button", { name: "Désactiver" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Désactiver" }).click();

  await page.getByText(/Anciens membres/).click();
  await row.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(dialog.getByText(/garder son historique/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).click();

  // Toujours là, parmi les anciens membres
  await page.reload();
  await page.getByText(/Anciens membres/).click();
  await expect(row.getByRole("button", { name: "Supprimer" })).toBeVisible();
});

test("mot de passe oublié : lien reçu par e-mail puis nouveau mot de passe", async ({ browser }) => {
  const newPassword = "E2e-oublie-mdp-3";
  const visitor = await browser.newPage();
  await visitor.goto("/login");
  await visitor.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  // Sinon l'adresse peut être tapée dans la page de connexion, pas encore quittée
  await expect(visitor.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();
  await visitor.getByLabel("Adresse e-mail").fill(owner.email);
  await visitor.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(visitor.getByRole("heading", { name: "Consultez vos e-mails" })).toBeVisible();

  // Une adresse inconnue reçoit exactement la même réponse
  await visitor.goto("/forgot-password");
  await visitor.getByLabel("Adresse e-mail").fill(`inconnu-${run}@e2e.test`);
  await visitor.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(visitor.getByRole("heading", { name: "Consultez vos e-mails" })).toBeVisible();

  const link = await emailLink(owner.email, "mot de passe");
  await visitor.goto(link);
  await visitor.getByRole("button", { name: "Continuer" }).click();
  await expect(visitor).toHaveURL(/\/reset-password$/);
  await visitor.getByLabel("Nouveau mot de passe").fill(newPassword);
  await visitor.getByRole("button", { name: "Enregistrer et me connecter" }).click();
  await expect(visitor).toHaveURL(/\/dashboard$/);

  // Le lien ne sert qu'une fois
  await visitor.goto(link);
  await visitor.getByRole("button", { name: "Continuer" }).click();
  await expect(visitor.getByRole("heading", { name: "Lien expiré ou déjà utilisé" })).toBeVisible();
  await visitor.close();
  owner.password = newPassword;
});

// Bouton de Google remplacé par un bouton qui renvoie un faux jeton
const GOOGLE_STUB = `window.google = { accounts: { id: {
  initialize(config) { window.__gsi = config; },
  renderButton(parent) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Continuer avec Google";
    button.onclick = () => window.__gsi.callback({ credential: "jeton-google-simule" });
    parent.replaceChildren(button);
  },
} } };`;

test("connexion avec Google (Google et Supabase simulés)", async ({ browser }) => {
  // Réponse de Supabase au jeton Google, choisie par chaque essai
  let answer: (route: Route) => Promise<void> = (route) => route.abort();
  const sent: { provider?: string; id_token?: string; nonce?: string }[] = [];

  async function openLogin(context: BrowserContext) {
    await context.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({ contentType: "text/javascript", body: GOOGLE_STUB }),
    );
    await context.route(
      (url) => url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "id_token",
      (route) => {
        sent.push(route.request().postDataJSON());
        return answer(route);
      },
    );
    const visitor = await context.newPage();
    await visitor.goto("/login");
    return visitor;
  }

  // Supabase refuse le jeton avec ce code
  const refuse = (status: number, code: string) => (route: Route) =>
    route.fulfill({
      status,
      // Supabase est sur une autre origine que la page
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "x-supabase-api-version",
        "x-supabase-api-version": "2024-01-01",
      },
      json: { code, message: code },
    });
  // Supabase accepte le jeton pour ce compte : vraie session, ouverte ici
  // avec son mot de passe
  const accept = (email: string, password: string) => async (route: Route) => {
    const response = await route.fetch({
      url: route.request().url().replace("grant_type=id_token", "grant_type=password"),
      postData: JSON.stringify({ email, password }),
    });
    await route.fulfill({ response });
  };

  const context = await browser.newContext();
  const visitor = await openLogin(context);
  // Build sans identifiant Google : pas de bouton, rien à essayer
  const google = visitor.getByRole("button", { name: "Continuer avec Google" });
  if ((await visitor.getByText("ou", { exact: true }).count()) === 0) {
    await context.close();
    test.skip(true, "build sans NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  }

  // Adresse Google sans compte : inscriptions fermées
  answer = refuse(422, "signup_disabled");
  await google.click();
  await expect(visitor.getByText(/Aucun compte n'utilise cette adresse Google/)).toBeVisible();

  // Employé désactivé
  answer = refuse(403, "user_banned");
  await google.click();
  await expect(visitor.getByText(/Ce compte est désactivé/)).toBeVisible();

  // Le patron : jeton et nonce transmis, nouveau nonce à chaque essai
  answer = accept(owner.email, owner.password);
  await google.click();
  await expect(visitor).toHaveURL(/\/dashboard$/);
  const last = sent.at(-1)!;
  expect(last.provider).toBe("google");
  expect(last.id_token).toBe("jeton-google-simule");
  expect(last.nonce).toBeTruthy();
  expect(new Set(sent.map((s) => s.nonce)).size).toBe(sent.length);
  // Google a reçu l'empreinte du nonce que Supabase vérifie
  const hashed = await visitor.evaluate(() => (window as unknown as { __gsi: { nonce: string } }).__gsi.nonce);
  expect(hashed).toBe(createHash("sha256").update(last.nonce!).digest("hex"));

  // Employé au mot de passe temporaire : il doit d'abord le changer
  const email = `employe-google-${run}@e2e.test`;
  const res = await visitor.request.post("/api/team/employees", {
    data: { firstName: "Nadia", lastName: `Google${run}`, email },
  });
  expect(res.status()).toBe(201);
  const { temporaryPassword } = (await res.json()) as { temporaryPassword: string };
  const employeeContext = await browser.newContext();
  const employee = await openLogin(employeeContext);
  answer = accept(email, temporaryPassword);
  await employee.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(employee).toHaveURL(/\/change-password$/);
  await employeeContext.close();

  // Session ouverte mais aucun profil lisible : déconnecté, avec un message
  const orphanContext = await browser.newContext();
  const orphan = await openLogin(orphanContext);
  await orphanContext.route(
    (url) => url.pathname.endsWith("/rest/v1/profiles"),
    (route) => route.fulfill({ json: [] }),
  );
  answer = accept(owner.email, owner.password);
  await orphan.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(orphan.getByText(/Aucun compte n'utilise cette adresse Google/)).toBeVisible();
  await orphan.goto("/dashboard");
  await expect(orphan).toHaveURL(/\/login$/);
  await orphanContext.close();

  await context.close();
});
