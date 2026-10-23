import { describe, expect, it } from "vitest";
import {
  agencyMessagePush,
  assignedTaskPush,
  assignedTasksPush,
  messageFrom,
  ofName,
  preview,
  studentMessagePush,
  studentReviewPush,
  taskDigestPush,
  testPush,
} from "./texts";

const CASE = "c1111111-1111-1111-1111-111111111111";

describe("preview", () => {
  it("met le message sur une ligne", () => {
    expect(preview("  Bonjour,\n\nmon  relevé est prêt. ")).toBe("Bonjour, mon relevé est prêt.");
  });

  it("coupe un long message avec des points de suspension", () => {
    const cut = preview("a".repeat(300));
    expect(cut).toHaveLength(140);
    expect(cut.endsWith("…")).toBe(true);
    expect(preview("x".repeat(140))).toBe("x".repeat(140));
  });
});

describe("ofName", () => {
  it("de ou d'", () => {
    expect(ofName("Atlas Études")).toBe("d'Atlas Études");
    expect(ofName("Yastene")).toBe("de Yastene");
  });
});

describe("messageFrom", () => {
  it("élide devant une voyelle ou un h", () => {
    expect(messageFrom("BENALI Karim")).toBe("Message de BENALI Karim");
    expect(messageFrom("AMRANI Lina")).toBe("Message d'AMRANI Lina");
    expect(messageFrom("Éducation Plus")).toBe("Message d'Éducation Plus");
    expect(messageFrom("HADDAD Sami")).toBe("Message d'HADDAD Sami");
    expect(messageFrom("YAHIAOUI Rym")).toBe("Message de YAHIAOUI Rym");
  });
});

describe("notifications de l'agence", () => {
  it("message d'un candidat : son nom, le début du message, l'onglet Messages", () => {
    expect(studentMessagePush(CASE, "BENALI Karim", "Bonjour,\nune question")).toEqual({
      title: "Message de BENALI Karim",
      body: "Bonjour, une question",
      url: `/cases/${CASE}/messages`,
      tag: `message-${CASE}`,
    });
  });

  it("réponse du candidat : validation ou demande de modification", () => {
    expect(studentReviewPush(CASE, "BENALI Karim", { decision: "approved" })).toMatchObject({
      title: "BENALI Karim a tout validé",
      url: `/cases/${CASE}`,
    });
    expect(
      studentReviewPush(CASE, "BENALI Karim", {
        decision: "changes_requested",
        message: "Corriger la date",
      }),
    ).toMatchObject({
      title: "BENALI Karim demande une modification",
      body: "Corriger la date",
      url: `/cases/${CASE}/messages`,
    });
  });

  it("tâche confiée : qui, quoi, pour quel candidat", () => {
    expect(
      assignedTaskPush(CASE, { id: "t1", title: "Relevé de notes" }, "Amine Madiou", "BENALI Karim"),
    ).toEqual({
      title: "Tâche confiée par Amine Madiou",
      body: "Relevé de notes · BENALI Karim",
      url: `/cases/${CASE}/tasks`,
      tag: "task-t1",
    });
  });

  it("même tâche pour plusieurs dossiers : une notification vers la page Tâches", () => {
    expect(assignedTasksPush("Relevé de notes", "Amine Madiou", 4)).toMatchObject({
      title: "Tâche confiée par Amine Madiou",
      body: "Relevé de notes · 4 dossiers",
      url: "/tasks",
    });
  });

  it("récapitulatif du matin, au singulier comme au pluriel", () => {
    expect(taskDigestPush(1, 0).body).toBe("1 tâche pour aujourd'hui");
    expect(taskDigestPush(2, 1).body).toBe("2 tâches pour aujourd'hui et 1 en retard");
    expect(taskDigestPush(0, 3).body).toBe("3 tâches en retard");
    expect(taskDigestPush(0, 1)).toMatchObject({ body: "1 tâche en retard", url: "/tasks" });
  });

  it("l'essai ouvre Réglages", () => {
    expect(testPush()).toMatchObject({ url: "/settings#notifications" });
    expect(testPush(true)).toMatchObject({ url: "/student/messages" });
  });
});

describe("notifications du candidat", () => {
  it("message de l'agence : son nom, vers ses messages", () => {
    expect(agencyMessagePush("Atlas Études", "Votre rendez-vous est confirmé")).toEqual({
      title: "Message d'Atlas Études",
      body: "Votre rendez-vous est confirmé",
      url: "/student/messages",
      tag: "message",
    });
  });
});

describe("adresses ouvertes au toucher", () => {
  it("toujours une page du site", () => {
    for (const p of [
      studentMessagePush(CASE, "X", "y"),
      studentReviewPush(CASE, "X", { decision: "approved" }),
      assignedTaskPush(CASE, { id: "t", title: "y" }, "Z", "X"),
      taskDigestPush(1, 1),
      agencyMessagePush("A", "y"),
      testPush(),
    ]) {
      expect(p.url.startsWith("/")).toBe(true);
      expect(p.url.startsWith("//")).toBe(false);
    }
  });
});
