// Types for real census JSON data

export interface PersonaCenso {
  region: number;
  provincia: number;
  comuna: number;
  sexo: number; // 1=hombre, 2=mujer
  edad: number;
  n_personas: number;
}

export interface PersonaGseCenso {
  region: number;
  provincia: number;
  comuna: number;
  sexo: number;
  edad: number;
  gse: string; // C1, C2, C3, D, E
  n_personas_gse: number;
}

export interface GseComuna {
  region: number;
  comuna: number;
  nombre_comuna: string;
  pct_C1: number;
  pct_C2: number;
  pct_C3: number;
  pct_D: number;
  pct_E: number;
  imputado?: boolean;
}

export type Zone = "Norte" | "Centro" | "RM" | "Sur";

export const GSE_OPTIONS = ["C1", "C2", "C3", "D", "E"] as const;

export interface RegionInfo {
  code: number;
  name: string;
  zone: Zone;
}

export const REGION_MAP: RegionInfo[] = [
  { code: 15, name: "Arica y Parinacota", zone: "Norte" },
  { code: 1, name: "Tarapacá", zone: "Norte" },
  { code: 2, name: "Antofagasta", zone: "Norte" },
  { code: 3, name: "Atacama", zone: "Norte" },
  { code: 4, name: "Coquimbo", zone: "Norte" },
  { code: 5, name: "Valparaíso", zone: "Centro" },
  { code: 6, name: "O'Higgins", zone: "Centro" },
  { code: 7, name: "Maule", zone: "Centro" },
  { code: 16, name: "Ñuble", zone: "Sur" },
  { code: 8, name: "Biobío", zone: "Sur" },
  { code: 9, name: "La Araucanía", zone: "Sur" },
  { code: 14, name: "Los Ríos", zone: "Sur" },
  { code: 10, name: "Los Lagos", zone: "Sur" },
  { code: 11, name: "Aysén", zone: "Sur" },
  { code: 12, name: "Magallanes", zone: "Sur" },
  { code: 13, name: "Metropolitana", zone: "RM" },
];

export const ZONE_LABELS: Record<Zone, string> = {
  Norte: "Norte Grande y Chico",
  Centro: "Zona Central",
  RM: "Región Metropolitana",
  Sur: "Zona Sur y Austral",
};

export const ZONE_REGIONS: Record<Zone, number[]> = {
  Norte: [15, 1, 2, 3, 4],
  Centro: [5, 6, 7],
  RM: [13],
  Sur: [16, 8, 9, 14, 10, 11, 12],
};

export function getRegionName(code: number): string {
  return REGION_MAP.find((r) => r.code === code)?.name ?? `Región ${code}`;
}

export function getRegionZone(code: number): Zone {
  return REGION_MAP.find((r) => r.code === code)?.zone ?? "Centro";
}
