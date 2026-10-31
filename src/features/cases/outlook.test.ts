import { describe, expect, it } from "vitest";
import {
  PASSWORD_WORDS,
  generateAccountPassword,
  handoverMessage,
  isOutlookPlatform,
  isValidOutlookLocalPart,
  outlookAddressSuggestions,
  splitOutlookAddress,
} from "./outlook";

describe("adresses Outlook proposées", () => {
  it("de la plus simple à la plus particulière, avec l'année de naissance", () => {
    expect(outlookAddressSuggestions("Amine", "Madiou", "2005-03-14")).toEqual([
      "amine.madiou",
      "amine.madiou2005",
      "madiou.amine",
      "amine.madiou05",
      "aminemadiou2005",
      "a.madiou2005",
      "amine.madiou.etudes",
    ]);
  });

  it("sans accent, espace, tiret ni apostrophe", () => {
    expect(outlookAddressSuggestions("Mohamed-Amine", "N'Diaye El Hadj", null)).toEqual([
      "mohamedamine.ndiayeelhadj",
      "ndiayeelhadj.mohamedamine",
      "mohamedamine.ndiayeelhadj.etudes",
    ]);
    expect(outlookAddressSuggestions("Éloïse", "Dupré", "")[0]).toBe("eloise.dupre");
  });

  it("aucune proposition pour un nom dans un autre alphabet", () => {
    expect(outlookAddressSuggestions("أمين", "Madiou", "2005-03-14")).toEqual([]);
  });

  it("toutes respectent les règles de Microsoft, même pour un nom très long", () => {
    const long = "a".repeat(40);
    const list = outlookAddressSuggestions(long, long, "2005-03-14");
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) expect(isValidOutlookLocalPart(s)).toBe(true);
  });

  it("un prénom qui commence par un chiffre n'est pas proposé en tête d'adresse", () => {
    for (const s of outlookAddressSuggestions("2Pac", "Shakur", "2005-03-14")) {
      expect(s).toMatch(/^[a-z]/);
    }
  });
});

describe("règles de Microsoft pour l'adresse", () => {
  it.each(["amine.madiou", "a_m-2005", "A.Madiou"])("accepte %s", (s) => {
    expect(isValidOutlookLocalPart(s)).toBe(true);
  });
  it.each(["", "2amine", ".amine", "amine.", "amine..madiou", "amine madiou", "amine@x", "é", "a".repeat(65)])(
    "refuse « %s »",
    (s) => {
      expect(isValidOutlookLocalPart(s)).toBe(false);
    },
  );
});

describe("adresse déjà notée sur la ligne « à créer »", () => {
  it("reprend une adresse Outlook ou Hotmail", () => {
    expect(splitOutlookAddress(" amine.madiou@Outlook.com ")).toEqual({
      local: "amine.madiou",
      domain: "outlook.com",
    });
    expect(splitOutlookAddress("a_m@hotmail.com")).toEqual({ local: "a_m", domain: "hotmail.com" });
  });
  it.each([null, "", "amine", "amine@gmail.com", "amine@outlook.fr", "2amine@outlook.com", "a@b@outlook.com"])(
    "ignore « %s »",
    (v) => {
      expect(splitOutlookAddress(v)).toBeNull();
    },
  );
});

describe("plateforme Outlook", () => {
  it.each(["Outlook", "outlook.com", " Hotmail ", "hotmail.fr", "Live", "Microsoft"])(
    "reconnaît %s",
    (p) => {
      expect(isOutlookPlatform(p)).toBe(true);
    },
  );
  it.each(["Pastel", "Gmail", "Outlook pro", "Campus France"])("ignore %s", (p) => {
    expect(isOutlookPlatform(p)).toBe(false);
  });
});

describe("mot de passe proposé", () => {
  it("trois mots et quatre chiffres, accepté par Microsoft", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateAccountPassword();
      expect(p).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
      expect(p.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("varie d'un tirage à l'autre", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateAccountPassword()));
    expect(seen.size).toBe(50);
  });

  it("rejette les tirages qui biaiseraient le choix", () => {
    // Premier tirage au-delà du dernier multiple de la taille de la liste :
    // ignoré, le suivant (0) donne le premier mot
    const draws = [0xffff_ffff, 0, 1, 2, 4827];
    const random = (b: Uint32Array) => {
      b[0] = draws.shift()!;
      return b;
    };
    expect(generateAccountPassword(random)).toBe(
      `${PASSWORD_WORDS[0]}-${PASSWORD_WORDS[1]}-${PASSWORD_WORDS[2]}-4827`,
    );
  });

  it("des mots simples, sans accent ni doublon", () => {
    expect(new Set(PASSWORD_WORDS).size).toBe(PASSWORD_WORDS.length);
    expect(PASSWORD_WORDS.length).toBeGreaterThanOrEqual(200);
    for (const w of PASSWORD_WORDS) expect(w).toMatch(/^[A-Z][a-z]{3,8}$/);
  });
});

describe("message de remise des comptes", () => {
  it("un bloc par compte, sans ligne vide inutile", () => {
    const text = handoverMessage({
      candidate: "Amine",
      agencyName: "Atlas Études",
      accounts: [
        {
          platform: "Outlook",
          url: "https://outlook.live.com/",
          login: "amine.madiou@outlook.com",
          password: "Soleil-Cactus-Plume-4827",
        },
        { platform: "Pastel", url: null, login: "AMINE05", password: null },
      ],
    });
    expect(text).toBe(
      [
        "Bonjour Amine,",
        "Voici les comptes créés pour votre dossier :",
        "Outlook\nIdentifiant : amine.madiou@outlook.com\nMot de passe : Soleil-Cactus-Plume-4827\nSite : https://outlook.live.com/",
        "Pastel\nIdentifiant : AMINE05",
        "Gardez ce message en lieu sûr et ne le transmettez à personne.",
        "Atlas Études",
      ].join("\n\n"),
    );
  });

  it("au singulier pour un seul compte, sans signature si l'agence n'a pas de nom", () => {
    const text = handoverMessage({
      candidate: "Amine",
      agencyName: "",
      accounts: [{ platform: "Outlook", url: null, login: "a@outlook.com", password: "x" }],
    });
    expect(text).toContain("Voici le compte créé pour votre dossier :");
    expect(text.endsWith("ne le transmettez à personne.")).toBe(true);
  });
});
