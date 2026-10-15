import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { PwaSetup } from "@/features/pwa/components/pwa-setup";

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Titre de chaque page suivi du nom de l'application : « Page introuvable · <nom> »
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "CRM pour agences de démarches d'études à l'étranger",
  // Application ajoutée à l'écran d'accueil d'un iPhone : plein écran
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

// Téléphone : la page occupe tout l'écran (encoche comprise, les marges de
// sécurité sont dans globals.css) ; la barre d'état prend la couleur du fond.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.colors.background },
    { media: "(prefers-color-scheme: dark)", color: BRAND.colors.backgroundDark },
  ],
};

// Posé avant l'hydratation : pas de flash au chargement.
// Sans choix mémorisé, on suit le thème du système.
const themeScript = `(function(){try{var t=localStorage.getItem("sf:theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

// Proposition d'installation (Android) : gardée dès son arrivée, avant même
// l'affichage de la carte « Installez l'application » qui s'en sert.
const installScript = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event("sf:installable"))})`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: installScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
