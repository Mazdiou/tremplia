import { studentManifest } from "@/features/pwa/manifest";

// Manifeste de l'espace candidat (déclaré par les layouts de /student)
export const dynamic = "force-static";

export function GET() {
  return Response.json(studentManifest(), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
