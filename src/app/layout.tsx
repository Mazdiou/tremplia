import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";
import { siteUrl } from "@/lib/site-url";
import { PwaSetup } from "@/features/pwa/components/pwa-setup";

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

// Police du nom de l'application seulement (logo), pas du texte
const brand = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = `${BRAND.tagline} : dossiers, documents, paiements et équipe réunis dans un seul outil.`;

export const metadata: Metadata = {
  // Adresse de base des liens absolus (aperçus de liens, plan du site)
  metadataBase: new URL(siteUrl()),
  // Titre de chaque page suivi du nom de l'application : « Page introuvable – <nom> »
  title: { default: BRAND.name, template: `%s – ${BRAND.name}` },
  description: DESCRIPTION,
  // Aperçu d'un lien partagé (WhatsApp, Facebook, LinkedIn…) : l'image vient
  // de opengraph-image.tsx
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "fr_FR",
    title: `${BRAND.name} – ${BRAND.tagline}`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // Application ajoutée à l'écran d'accueil d'un iPhone : plein écran
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  // Ancienne balise, encore lue par les iPhone antérieurs à iOS 16.4
  other: { "apple-mobile-web-app-capable": "yes" },
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

// Taille du texte réduite (Réglages, téléphone) : posée de même avant
// l'affichage, pour que rien ne change de taille au chargement
const textScript = `(function(){try{if(localStorage.getItem("sf:text")==="small")document.documentElement.classList.add("text-small")}catch(e){}})()`;

// iPhone et iPad : Safari zoome sur tout champ écrit sous 16 px dès qu'on le
// touche. maximum-scale=1 l'en empêche, et iOS laisse quand même zoomer avec
// deux doigts. Réservé à iOS : ailleurs (Android), il bloquerait ce zoom.
const zoomScript = `(function(){var n=navigator;if(/iP(hone|ad|od)/.test(n.userAgent)||(n.platform==="MacIntel"&&n.maxTouchPoints>1)){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("maximum-scale")<0)m.content+=", maximum-scale=1"}})()`;

// Proposition d'installation (Android) : gardée dès son arrivée, avant même
// l'affichage de la carte « Installez l'application » qui s'en sert.
const installScript = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event("sf:installable"))})`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sans.variable} ${brand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: textScript }} />
        <script dangerouslySetInnerHTML={{ __html: zoomScript }} />
        <script dangerouslySetInnerHTML={{ __html: installScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
