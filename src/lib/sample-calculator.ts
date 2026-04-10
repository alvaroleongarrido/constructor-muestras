import {
  type PersonaCenso,
  type PersonaGseCenso,
  type GseComuna,
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

export interface GseGroup {
  label: string;
  categories: string[];
}

export interface SampleConfig {
  ageMin: number;
  ageMax: number;
  sexFilter: "both" | "male" | "female";
  selectedRegions: number[];
  selectedComunas: number[];
  selectedGse: string[];
  ageRanges: AgeRange[];
  gseGroups: GseGroup[];
  sampleSize: number;
  groupBy: "region" | "zone" | "comuna";
}

export interface QuotaRow {
  region: string;
  regionCode: number;
  zone: Zone;
  sex: string;
  ageRange: string;
  gse: string;
  population: number;
  proportion: number;
  sample: number;
}

export interface SummaryRow {
  label: string;
  population: number;
  proportion: number;
  sample: number;
}

export interface SampleResult {
  totalUniverse: number;
  sampleSize: number;
  marginOfError: number;
  quotas: QuotaRow[];
  bySex: SummaryRow[];
  byAge: SummaryRow[];
  byRegion: SummaryRow[];
  byGse: SummaryRow[];
}

function filterData(personas: PersonaCenso[], config: SampleConfig): PersonaCenso[] {
  return personas.filter((p) => {
    if (!config.selectedRegions.includes(p.region)) return false;
    if (config.selectedComunas.length > 0 && !config.selectedComunas.includes(p.comuna)) return false;
    if (p.edad < config.ageMin || p.edad > config.ageMax) return false;
    if (config.sexFilter === "male" && p.sexo !== 1) return false;
    if (config.sexFilter === "female" && p.sexo !== 2) return false;
    return true;
  });
}

function filterGseData(personasGse: PersonaGseCenso[], config: SampleConfig): PersonaGseCenso[] {
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

function resolveGseLabel(gse: string, groups: GseGroup[]): string {
  if (groups.length === 0) return gse;
  const group = groups.find((g) => g.categories.includes(gse));
  return group ? group.label : gse;
}

function getComunaName(comunaCode: number, gseComunas: GseComuna[]): string {
  return gseComunas.find((c) => c.comuna === comunaCode)?.nombre_comuna || String(comunaCode);
}

export function calculateSample(
  config: SampleConfig,
  personasCenso: PersonaCenso[],
  personasGse: PersonaGseCenso[],
  gseComunas: GseComuna[]
): SampleResult {
  const useGse = config.selectedGse.length > 0;
  const quotas: QuotaRow[] = [];
  const sexes: number[] =
    config.sexFilter === "both" ? [1, 2] : config.sexFilter === "male" ? [1] : [2];

  const filtered = useGse
    ? filterGseData(personasGse, config)
    : filterData(personasCenso, config);

  // Determine GSE categories to iterate
  const gseCategories = useGse ? config.selectedGse : ["all"];

  // Determine geographic grouping keys
  const geoKeys: { code: number; label: string; zone: Zone }[] = [];

  if (config.groupBy === "comuna") {
    // Get unique comunas from filtered data
    const comunaCodes = new Set<number>();
    for (const p of filtered) comunaCodes.add(p.comuna);
    for (const code of comunaCodes) {
      const name = getComunaName(code, gseComunas);
      geoKeys.push({ code, label: name, zone: getRegionZone((filtered.find(p => p.comuna === code)?.region) ?? 13) });
    }
  } else {
    for (const regionCode of config.selectedRegions) {
      const zone = getRegionZone(regionCode);
      const label = config.groupBy === "zone" ? ZONE_LABELS[zone] : getRegionName(regionCode);
      geoKeys.push({ code: regionCode, label, zone });
    }
  }

  for (const geo of geoKeys) {
    for (const sexCode of sexes) {
      for (const ageRange of config.ageRanges) {
        const clampedMin = Math.max(ageRange.min, config.ageMin);
        const clampedMax = Math.min(ageRange.max, config.ageMax);
        if (clampedMin > clampedMax) continue;

        for (const gseCat of gseCategories) {
          let pop = 0;
          for (const p of filtered) {
            if (config.groupBy === "comuna") {
              if (p.comuna !== geo.code) continue;
            } else {
              if (p.region !== geo.code) continue;
            }
            if (p.sexo !== sexCode) continue;
            if (p.edad < clampedMin || p.edad > clampedMax) continue;
            if (useGse) {
              const pg = p as unknown as PersonaGseCenso;
              if (gseCat !== "all" && pg.gse !== gseCat) continue;
              pop += pg.n_personas_gse;
            } else {
              pop += (p as PersonaCenso).n_personas;
            }
          }
          if (pop === 0) continue;

          const gseLabel = gseCat === "all" ? "Todos" : resolveGseLabel(gseCat, config.gseGroups);

          quotas.push({
            region: geo.label,
            regionCode: geo.code,
            zone: geo.zone,
            sex: sexCode === 1 ? "Hombre" : "Mujer",
            ageRange: ageRange.label,
            gse: gseLabel,
            population: pop,
            proportion: 0,
            sample: 0,
          });
        }
      }
    }
  }

  // Aggregate by zone if needed
  if (config.groupBy === "zone") {
    const grouped = new Map<string, QuotaRow>();
    for (const q of quotas) {
      const key = `${q.region}|${q.sex}|${q.ageRange}|${q.gse}`;
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

  // Aggregate GSE groups
  if (useGse && config.gseGroups.length > 0) {
    const grouped = new Map<string, QuotaRow>();
    for (const q of quotas) {
      const key = `${q.region}|${q.sex}|${q.ageRange}|${q.gse}`;
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
  const byGseMap = new Map<string, number>();

  for (const q of quotas) {
    bySexMap.set(q.sex, (bySexMap.get(q.sex) || 0) + q.population);
    byAgeMap.set(q.ageRange, (byAgeMap.get(q.ageRange) || 0) + q.population);
    byRegionMap.set(q.region, (byRegionMap.get(q.region) || 0) + q.population);
    if (useGse) {
      byGseMap.set(q.gse, (byGseMap.get(q.gse) || 0) + q.population);
    }
  }

  const makeSummary = (map: Map<string, number>): SummaryRow[] =>
    Array.from(map.entries()).map(([label, population]) => ({
      label,
      population,
      proportion: totalUniverse > 0 ? population / totalUniverse : 0,
      sample: Math.round((population / (totalUniverse || 1)) * config.sampleSize),
    }));

  return {
    totalUniverse,
    sampleSize: config.sampleSize,
    marginOfError,
    quotas,
    bySex: makeSummary(bySexMap),
    byAge: makeSummary(byAgeMap),
    byRegion: makeSummary(byRegionMap),
    byGse: makeSummary(byGseMap),
  };
}

export function marginOfErrorRow(sampleRow: number): string {
  if (sampleRow <= 0) return "—";
  return `±${(1.96 * Math.sqrt(0.25 / sampleRow) * 100).toFixed(1)}%`;
}

export function exportToCSV(result: SampleResult): string {
  const hasGse = result.byGse.length > 0;
  const headers = ["Región/Zona", "Sexo", "Tramo Edad", ...(hasGse ? ["GSE"] : []), "Población", "Proporción (%)", "Muestra", "Margen de Error"];
  const rows = result.quotas.map((q) => [
    q.region,
    q.sex,
    q.ageRange,
    ...(hasGse ? [q.gse] : []),
    q.population.toString(),
    (q.proportion * 100).toFixed(2),
    q.sample.toString(),
    marginOfErrorRow(q.sample),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportToExcel(result: SampleResult): string {
  const pct = (n: number) => (n * 100).toFixed(2) + "%";
  const hasGse = result.byGse.length > 0;

  const titleRow = (title: string) =>
    `<Row><Cell ss:StyleID="t"><Data ss:Type="String">${title}</Data></Cell></Row>`;

  const headerRow = (cols: string[]) =>
    `<Row>${cols.map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${c}</Data></Cell>`).join("")}</Row>`;

  const emptyRow = `<Row><Cell><Data ss:Type="String"></Data></Cell></Row>`;

  const dataRow = (label: string, pop: number, prop: number, sample: number) =>
    `<Row>` +
    `<Cell><Data ss:Type="String">${label}</Data></Cell>` +
    `<Cell><Data ss:Type="Number">${pop}</Data></Cell>` +
    `<Cell><Data ss:Type="String">${pct(prop)}</Data></Cell>` +
    `<Cell><Data ss:Type="Number">${sample}</Data></Cell>` +
    `<Cell><Data ss:Type="String">${marginOfErrorRow(sample)}</Data></Cell>` +
    `</Row>`;

  const rows: string[] = [];

  rows.push(titleRow("Por Sexo"));
  rows.push(headerRow(["Sexo", "Población", "Proporción", "Muestra", "Margen de Error"]));
  result.bySex.forEach((r) => rows.push(dataRow(r.label, r.population, r.proportion, r.sample)));
  rows.push(emptyRow);

  rows.push(titleRow("Por Tramo de Edad"));
  rows.push(headerRow(["Tramo", "Población", "Proporción", "Muestra", "Margen de Error"]));
  result.byAge.forEach((r) => rows.push(dataRow(r.label, r.population, r.proportion, r.sample)));
  rows.push(emptyRow);

  rows.push(titleRow("Por Región"));
  rows.push(headerRow(["Región", "Población", "Proporción", "Muestra", "Margen de Error"]));
  result.byRegion.forEach((r) => rows.push(dataRow(r.label, r.population, r.proportion, r.sample)));

  if (hasGse) {
    rows.push(emptyRow);
    rows.push(titleRow("Por GSE"));
    rows.push(headerRow(["GSE", "Población", "Proporción", "Muestra", "Margen de Error"]));
    result.byGse.forEach((r) => rows.push(dataRow(r.label, r.population, r.proportion, r.sample)));
  }

  const styles = `<Styles>
    <Style ss:ID="h"><Font ss:Bold="1"/></Style>
    <Style ss:ID="t"><Font ss:Bold="1" ss:Size="12"/></Style>
  </Styles>`;

  return (
    `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    styles +
    `<Worksheet ss:Name="Cuotas Directas"><Table>` +
    rows.join("") +
    `</Table></Worksheet></Workbook>`
  );
}
