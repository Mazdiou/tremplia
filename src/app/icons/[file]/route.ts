import { notFound } from "next/navigation";
import { appIcon } from "@/features/pwa/app-icon";

// Icônes du manifeste et des notifications, générées une fois à la
// compilation
const ICONS: Record<string, [number, "rounded" | "full" | "badge"]> = {
  "icon-192.png": [192, "rounded"],
  "icon-512.png": [512, "rounded"],
  "maskable-512.png": [512, "full"],
  "badge-96.png": [96, "badge"],
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
