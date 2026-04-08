import { CENSUS_DATA, type RegionData, type Zone } from "@/data/censo-chile-2024";

export interface AgeRange {
  label: string;
  min: number;
  max: number;
}

export interface SampleConfig {
  ageMin: number;
  ageMax: number;
  sexFilter: "both" | "male" | "female";
  selectedRegions: string[]; // region codes
  ageRanges: AgeRange[];
  sampleSize: number;
  groupBy: "region" | "zone";
}

export interface QuotaRow {
  region: string;
  regionCode: string;
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

function getPopulationForAgeRange(
  region: RegionData,
  ageMin: number,
  ageMax: number,
  sexFilter: "both" | "male" | "female"
): number {
  let total = 0;
  for (const ag of region.population) {
    // Check overlap
    if (ag.ageMax < ageMin || ag.ageMin > ageMax) continue;

    const overlapMin = Math.max(ag.ageMin, ageMin);
    const overlapMax = Math.min(ag.ageMax, ageMax);
    const groupSpan = ag.ageMax - ag.ageMin + 1;
    const overlapSpan = overlapMax - overlapMin + 1;
    const fraction = overlapSpan / groupSpan;

    if (sexFilter === "male") {
      total += Math.round(ag.male * fraction);
    } else if (sexFilter === "female") {
      total += Math.round(ag.female * fraction);
    } else {
      total += Math.round((ag.male + ag.female) * fraction);
    }
  }
  return total;
}

export function calculateSample(config: SampleConfig): SampleResult {
  const regions = CENSUS_DATA.filter((r) => config.selectedRegions.includes(r.code));

  // Build quota rows
  const quotas: QuotaRow[] = [];
  const sexes: ("male" | "female")[] =
    config.sexFilter === "both"
      ? ["male", "female"]
      : config.sexFilter === "male"
        ? ["male"]
        : ["female"];

  for (const region of regions) {
    for (const sex of sexes) {
      for (const ageRange of config.ageRanges) {
        const clampedMin = Math.max(ageRange.min, config.ageMin);
        const clampedMax = Math.min(ageRange.max, config.ageMax);
        if (clampedMin > clampedMax) continue;

        const pop = getPopulationForAgeRange(region, clampedMin, clampedMax, sex);
        if (pop === 0) continue;

        quotas.push({
          region: config.groupBy === "zone" ? region.zone : region.name,
          regionCode: region.code,
          zone: region.zone,
          sex: sex === "male" ? "Hombre" : "Mujer",
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

  // Calculate proportions and sample allocation
  for (const q of quotas) {
    q.proportion = totalUniverse > 0 ? q.population / totalUniverse : 0;
    q.sample = Math.round(q.proportion * config.sampleSize);
  }

  // Fix rounding: adjust largest group
  const sampleSum = quotas.reduce((s, q) => s + q.sample, 0);
  if (quotas.length > 0 && sampleSum !== config.sampleSize) {
    const diff = config.sampleSize - sampleSum;
    const largest = quotas.reduce((a, b) => (a.population > b.population ? a : b));
    largest.sample += diff;
  }

  // Margin of error (95% confidence, p=0.5)
  const marginOfError =
    totalUniverse > 0
      ? (1.96 * Math.sqrt(0.25 / config.sampleSize) *
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
