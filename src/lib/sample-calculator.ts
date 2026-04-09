import {
  type PersonaCenso,
  type PersonaGseCenso,
  type Zone,
  getRegionName,
  getRegionZone,
  ZONE_LABELS,
} from "./census-types";

export interface AgeRange {
  label: string;
  min: number;
  max: number;
}

export interface SampleConfig {
  ageMin: number;
  ageMax: number;
  sexFilter: "both" | "male" | "female";
  selectedRegions: number[];
  selectedComunas: number[]; // empty = all comunas in region
  selectedGse: string[]; // empty = no GSE filter (use personas_censo)
  ageRanges: AgeRange[];
  sampleSize: number;
  groupBy: "region" | "zone";
}

export interface QuotaRow {
  region: string;
  regionCode: number;
  zone: Zone;
  sex: string;
  ageRange: string;
  population: number;
  proportion: number;
  sample: number;
}

export interface SampleResult {
  totalUniverse: number;
  sampleSize: number;
  marginOfError: number;
  quotas: QuotaRow[];
  bySex: { label: string; population: number; proportion: number; sample: number }[];
  byAge: { label: string; population: number; proportion: number; sample: number }[];
  byRegion: { label: string; population: number; proportion: number; sample: number }[];
}

function filterData(
  personas: PersonaCenso[],
  config: SampleConfig
): PersonaCenso[] {
  return personas.filter((p) => {
    if (!config.selectedRegions.includes(p.region)) return false;
    if (config.selectedComunas.length > 0 && !config.selectedComunas.includes(p.comuna)) return false;
    if (p.edad < config.ageMin || p.edad > config.ageMax) return false;
    if (config.sexFilter === "male" && p.sexo !== 1) return false;
    if (config.sexFilter === "female" && p.sexo !== 2) return false;
    return true;
  });
}

function filterGseData(
  personasGse: PersonaGseCenso[],
  config: SampleConfig
): PersonaGseCenso[] {
  return personasGse.filter((p) => {
    if (!config.selectedRegions.includes(p.region)) return false;
    if (config.selectedComunas.length > 0 && !config.selectedComunas.includes(p.comuna)) return false;
    if (p.edad < config.ageMin || p.edad > config.ageMax) return false;
    if (config.sexFilter === "male" && p.sexo !== 1) return false;
    if (config.sexFilter === "female" && p.sexo !== 2) return false;
    if (!config.selectedGse.includes(p.gse)) return false;
    return true;
  });
}

export function calculateSample(
  config: SampleConfig,
  personasCenso: PersonaCenso[],
  personasGse: PersonaGseCenso[]
): SampleResult {
  const useGse = config.selectedGse.length > 0;

  // Build quota rows from raw data
  const quotas: QuotaRow[] = [];
  const sexes: number[] =
    config.sexFilter === "both" ? [1, 2] : config.sexFilter === "male" ? [1] : [2];

  // Pre-filter data once
  const filtered = useGse
    ? filterGseData(personasGse, config)
    : filterData(personasCenso, config);

  // Group by region, sex, ageRange
  for (const regionCode of config.selectedRegions) {
    const zone = getRegionZone(regionCode);
    const regionLabel = config.groupBy === "zone" ? ZONE_LABELS[zone] : getRegionName(regionCode);

    for (const sexCode of sexes) {
      for (const ageRange of config.ageRanges) {
        const clampedMin = Math.max(ageRange.min, config.ageMin);
        const clampedMax = Math.min(ageRange.max, config.ageMax);
        if (clampedMin > clampedMax) continue;

        let pop = 0;
        for (const p of filtered) {
          if (p.region !== regionCode) continue;
          if (p.sexo !== sexCode) continue;
          if (p.edad < clampedMin || p.edad > clampedMax) continue;
          pop += useGse ? (p as unknown as PersonaGseCenso).n_personas_gse : (p as PersonaCenso).n_personas;
        }
        if (pop === 0) continue;

        quotas.push({
          region: regionLabel,
          regionCode,
          zone,
          sex: sexCode === 1 ? "Hombre" : "Mujer",
          ageRange: ageRange.label,
          population: pop,
          proportion: 0,
          sample: 0,
        });
      }
    }
  }

  // If groupBy zone, aggregate
  if (config.groupBy === "zone") {
    const grouped = new Map<string, QuotaRow>();
    for (const q of quotas) {
      const key = `${q.region}|${q.sex}|${q.ageRange}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.population += q.population;
      } else {
        grouped.set(key, { ...q });
      }
    }
    quotas.length = 0;
    quotas.push(...grouped.values());
  }

  const totalUniverse = quotas.reduce((s, q) => s + q.population, 0);

  for (const q of quotas) {
    q.proportion = totalUniverse > 0 ? q.population / totalUniverse : 0;
    q.sample = Math.round(q.proportion * config.sampleSize);
  }

  // Fix rounding
  const sampleSum = quotas.reduce((s, q) => s + q.sample, 0);
  if (quotas.length > 0 && sampleSum !== config.sampleSize) {
    const diff = config.sampleSize - sampleSum;
    const largest = quotas.reduce((a, b) => (a.population > b.population ? a : b));
    largest.sample += diff;
  }

  // Margin of error (95% confidence, p=0.5)
  const marginOfError =
    totalUniverse > 0
      ? (1.96 *
          Math.sqrt(0.25 / config.sampleSize) *
          Math.sqrt((totalUniverse - config.sampleSize) / (totalUniverse - 1))) *
        100
      : 0;

  // Summaries
  const bySexMap = new Map<string, number>();
  const byAgeMap = new Map<string, number>();
  const byRegionMap = new Map<string, number>();

  for (const q of quotas) {
    bySexMap.set(q.sex, (bySexMap.get(q.sex) || 0) + q.population);
    byAgeMap.set(q.ageRange, (byAgeMap.get(q.ageRange) || 0) + q.population);
    byRegionMap.set(q.region, (byRegionMap.get(q.region) || 0) + q.population);
  }

  const makeSummary = (map: Map<string, number>) =>
    Array.from(map.entries()).map(([label, population]) => ({
      label,
      population,
      proportion: totalUniverse > 0 ? population / totalUniverse : 0,
      sample: Math.round((population / totalUniverse) * config.sampleSize),
    }));

  return {
    totalUniverse,
    sampleSize: config.sampleSize,
    marginOfError,
    quotas,
    bySex: makeSummary(bySexMap),
    byAge: makeSummary(byAgeMap),
    byRegion: makeSummary(byRegionMap),
  };
}

export function exportToCSV(result: SampleResult): string {
  const headers = ["Región/Zona", "Sexo", "Tramo Edad", "Población", "Proporción (%)", "Muestra"];
  const rows = result.quotas.map((q) => [
    q.region,
    q.sex,
    q.ageRange,
    q.population.toString(),
    (q.proportion * 100).toFixed(2),
    q.sample.toString(),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
