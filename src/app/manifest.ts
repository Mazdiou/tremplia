import type { MetadataRoute } from "next";
import { agencyManifest } from "@/features/pwa/manifest";

export default function manifest(): MetadataRoute.Manifest {
  return agencyManifest();
}
