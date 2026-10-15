import { notFound } from "next/navigation";
import { appIcon } from "@/features/pwa/app-icon";

// Icônes du manifeste, générées une fois à la compilation
const ICONS: Record<string, [number, "rounded" | "full"]> = {
  "icon-192.png": [192, "rounded"],
  "icon-512.png": [512, "rounded"],
  "maskable-512.png": [512, "full"],
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const icon = ICONS[(await params).file];
  if (!icon) notFound();
  return appIcon(...icon);
}
