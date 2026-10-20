import { expect, test, type Page } from "@playwright/test";

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
  await page.getByLabel("Confirmer le mot de passe").fill(owner.password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Votre agence est créée" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(owner.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
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

test("ouverture de l'espace candidat", async () => {
  await page.goto(caseUrl);
  await page.getByRole("button", { name: "Ouvrir l'accès" }).click();
  const code = page.locator("code").filter({ hasText: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/ });
  await expect(code).toBeVisible();
  studentCode = (await code.textContent())!.trim();
});

test("le guide coche les étapes faites", async () => {
  await page.goto("/dashboard");
  // Campagne, dossier, document et espace candidat
  await expect(page.getByRole("progressbar", { name: "Avancement" })).toHaveAttribute(
    "aria-valuenow",
    "4",
  );
  await expect(page.getByRole("button", { name: /Créer une tâche de relance/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
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
