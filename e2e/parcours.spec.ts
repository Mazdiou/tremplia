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

test("ouverture de l'espace candidat", async () => {
  await page.goto(caseUrl);
  await page.getByRole("button", { name: "Ouvrir l'accès" }).click();
  const code = page.locator("code").filter({ hasText: /^[A-Z0-9]{4}-[A-Z0-9]{4}$/ });
  await expect(code).toBeVisible();
  studentCode = (await code.textContent())!.trim();
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
  await expect(student.getByRole("alert")).toBeVisible();
  await expect(student).toHaveURL(/\/student\/login$/);
  await student.close();
});
