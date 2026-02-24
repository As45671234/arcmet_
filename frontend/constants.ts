export const CONTACT_EMAIL = "ceo@arcmet.kz";

// Brand logos shown on the Home page (instead of generic icons)
// Files live in: /aa/public/logos/
export const BRAND_LOGOS: Record<string, { label: string; src: string }> = {
  panelsan: { label: "Panelsan", src: "/logos/panelsan.svg" },
  rheinzink: { label: "Rheinzink", src: "/logos/rheinzink.svg" },
  penoplex: { label: "Пеноплэкс", src: "/logos/penoplex.svg" },
  plastfoil: { label: "Plastfoil", src: "/logos/plastfoil.svg" },
  fachmann: { label: "Fachmann", src: "/logos/fachmann.svg" },
  akfa: { label: "AKFA", src: "/logos/akfa.svg" },
  skyplast: { label: "SkyPlast (Protan)", src: "/logos/skyplast.svg" },
};

export const DEFAULT_CATEGORY_IMAGE =
  "https://source.unsplash.com/featured/900x600/?building,materials";

export const CATEGORY_IMAGES: Record<string, string> = {
  panelsan: "https://source.unsplash.com/featured/900x600/?sandwich,panels",
  rheinzink: "https://source.unsplash.com/featured/900x600/?metal,roof",
  penoplex: "https://source.unsplash.com/featured/900x600/?insulation,foam",
  plastfoil: "https://source.unsplash.com/featured/900x600/?roofing,membrane",
  fachmann: "https://source.unsplash.com/featured/900x600/?roof,ventilation",
  akfa: "https://source.unsplash.com/featured/900x600/?aluminum,windows",
  skyplast: "https://source.unsplash.com/featured/900x600/?pvc,membrane",
};
