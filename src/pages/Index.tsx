import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type PersonaCenso,
  type PersonaGseCenso,
  type GseComuna,
  type Zone,
  REGION_MAP,
  ZONE_LABELS,
  ZONE_REGIONS,
  GSE_OPTIONS,
} from "@/lib/census-types";
import {
  calculateSample,
  exportToCSV,
  exportToExcel,
  marginOfErrorRow,
  type SampleConfig,
  type AgeRange,
  type GseGroup,
  type SampleResult,
} from "@/lib/sample-calculator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Download, Users, Target, TrendingUp, HelpCircle, Plus, X, FileSpreadsheet, Loader2 } from "lucide-react";

const DEFAULT_AGE_RANGES: AgeRange[] = [
  { label: "1-17", min: 1, max: 17 },
  { label: "18-29", min: 18, max: 29 },
  { label: "30-44", min: 30, max: 44 },
  { label: "45-59", min: 45, max: 59 },
  { label: "60+", min: 60, max: 120 },
];

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(172, 66%, 50%)",
  "hsl(43, 96%, 56%)",
  "hsl(27, 87%, 67%)",
  "hsl(280, 65%, 60%)",
];

const ALL_REGION_CODES = REGION_MAP.map((r) => r.code);

export default function SampleDashboard() {
  // Data loading
  const [personasCenso, setPersonasCenso] = useState<PersonaCenso[] | null>(null);
  const [personasGse, setPersonasGse] = useState<PersonaGseCenso[] | null>(null);
  const [gseComunas, setGseComunas] = useState<GseComuna[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("https://raw.githubusercontent.com/alvaroleongarrido/constructor-muestras/refs/heads/main/public/data/personas_censo.json").then((r) => r.json()),
      fetch("https://raw.githubusercontent.com/alvaroleongarrido/constructor-muestras/refs/heads/main/public/data/personas_gse_censo.json").then((r) => r.json()),
      fetch("https://raw.githubusercontent.com/alvaroleongarrido/constructor-muestras/refs/heads/main/public/data/gse_comunas.json").then((r) => r.json()),
    ])
      .then(([censo, gse, comunas]) => {
        setPersonasCenso(censo);
        setPersonasGse(gse);
        setGseComunas(comunas);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message);
        setLoading(false);
      });
  }, []);

  // Config state
  const [ageMin, setAgeMin] = useState(1);
  const [ageMax, setAgeMax] = useState(120);
  const [sexFilter, setSexFilter] = useState<"both" | "male" | "female">("both");
  const [selectedRegions, setSelectedRegions] = useState<number[]>(ALL_REGION_CODES);
  const [selectedComunas, setSelectedComunas] = useState<number[]>([]);
  const [selectedGse, setSelectedGse] = useState<string[]>([]);
  const [ageRanges, setAgeRanges] = useState<AgeRange[]>(DEFAULT_AGE_RANGES);
  const [gseGroups, setGseGroups] = useState<GseGroup[]>([]);
  const [sampleSize, setSampleSize] = useState(1000);
  const [groupBy, setGroupBy] = useState<"region" | "zone" | "comuna">("zone");
  const [newRangeMin, setNewRangeMin] = useState("");
  const [newRangeMax, setNewRangeMax] = useState("");
  const [newGseGroupName, setNewGseGroupName] = useState("");
  const [newGseGroupCats, setNewGseGroupCats] = useState<string[]>([]);
  const [crossSex, setCrossSex] = useState(true);
  const [crossAge, setCrossAge] = useState(true);
  const [crossRegion, setCrossRegion] = useState(true);
  const [crossGse, setCrossGse] = useState(false);

  // For comuna groupBy mode: single region + single comuna
  const [comunaRegion, setComunaRegion] = useState<number | null>(null);

  // Available comunas for comuna mode
  const availableComunasForMode = useMemo(() => {
    if (!gseComunas || groupBy !== "comuna" || comunaRegion === null) return [];
    return gseComunas
      .filter((c) => c.region === comunaRegion && c.nombre_comuna != null && c.nombre_comuna !== "")
      .sort((a, b) => (a.nombre_comuna ?? "").localeCompare(b.nombre_comuna ?? ""));
  }, [gseComunas, groupBy, comunaRegion]);

  // GSE distribution for selected comunas
  const gseDistribution = useMemo(() => {
    if (!gseComunas || selectedComunas.length === 0) return null;
    const selected = gseComunas.filter((c) => selectedComunas.includes(c.comuna));
    if (selected.length === 0) return null;
    return {
      C1: selected.reduce((s, c) => s + c.pct_C1, 0) / selected.length,
      C2: selected.reduce((s, c) => s + c.pct_C2, 0) / selected.length,
      C3: selected.reduce((s, c) => s + c.pct_C3, 0) / selected.length,
      D: selected.reduce((s, c) => s + c.pct_D, 0) / selected.length,
      E: selected.reduce((s, c) => s + c.pct_E, 0) / selected.length,
    };
  }, [gseComunas, selectedComunas]);

  // Effective regions and comunas based on groupBy mode
  const effectiveRegions = useMemo(() => {
    if (groupBy === "comuna" && comunaRegion !== null) return [comunaRegion];
    return selectedRegions;
  }, [groupBy, comunaRegion, selectedRegions]);

  const effectiveComunas = useMemo(() => {
    if (groupBy === "comuna") return selectedComunas;
    return [];
  }, [groupBy, selectedComunas]);

  const config: SampleConfig = useMemo(
    () => ({
      ageMin, ageMax, sexFilter,
      selectedRegions: effectiveRegions,
      selectedComunas: effectiveComunas,
      selectedGse, ageRanges, gseGroups, sampleSize, groupBy,
    }),
    [ageMin, ageMax, sexFilter, effectiveRegions, effectiveComunas, selectedGse, ageRanges, gseGroups, sampleSize, groupBy]
  );

  const result: SampleResult = useMemo(() => {
    if (!personasCenso || !personasGse || !gseComunas) {
      return { totalUniverse: 0, sampleSize: 0, marginOfError: 0, quotas: [], bySex: [], byAge: [], byRegion: [], byGse: [] };
    }
    return calculateSample(config, personasCenso, personasGse, gseComunas);
  }, [config, personasCenso, personasGse, gseComunas]);

  const crossedQuotas = useMemo(() => {
    const useGse = selectedGse.length > 0;
    if (crossSex && crossAge && crossRegion && (!useGse || crossGse)) return result.quotas;
    const grouped = new Map<string, { region: string; sex: string; ageRange: string; gse: string; population: number }>();
    for (const q of result.quotas) {
      const regionVal = crossRegion ? q.region : "Todos";
      const sexVal = crossSex ? q.sex : "Todos";
      const ageVal = crossAge ? q.ageRange : "Todos";
      const gseVal = (useGse && crossGse) ? q.gse : "Todos";
      const key = `${regionVal}|${sexVal}|${ageVal}|${gseVal}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.population += q.population;
      } else {
        grouped.set(key, { region: regionVal, sex: sexVal, ageRange: ageVal, gse: gseVal, population: q.population });
      }
    }
    const rows = Array.from(grouped.values());
    const total = rows.reduce((s, r) => s + r.population, 0);
    return rows.map((r) => ({
      ...r,
      proportion: total > 0 ? r.population / total : 0,
      sample: Math.round((r.population / (total || 1)) * config.sampleSize),
    }));
  }, [result.quotas, crossSex, crossAge, crossRegion, crossGse, config.sampleSize, selectedGse.length]);

  const toggleZone = useCallback((zone: Zone, checked: boolean) => {
    const zoneCodes = ZONE_REGIONS[zone];
    setSelectedRegions((prev) =>
      checked ? [...new Set([...prev, ...zoneCodes])] : prev.filter((c) => !zoneCodes.includes(c))
    );
  }, []);

  const toggleRegion = useCallback((code: number, checked: boolean) => {
    setSelectedRegions((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)));
  }, []);

  const toggleGse = useCallback((gse: string, checked: boolean) => {
    setSelectedGse((prev) => (checked ? [...prev, gse] : prev.filter((g) => g !== gse)));
  }, []);

  const addAgeRange = useCallback(() => {
    const min = parseInt(newRangeMin);
    const max = parseInt(newRangeMax);
    if (!isNaN(min) && !isNaN(max) && min < max) {
      setAgeRanges((prev) => [...prev, { label: `${min}-${max === 120 ? "+" : max}`, min, max }]);
      setNewRangeMin("");
      setNewRangeMax("");
    }
  }, [newRangeMin, newRangeMax]);

  const removeAgeRange = useCallback((index: number) => {
    setAgeRanges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addGseGroup = useCallback(() => {
    if (newGseGroupName.trim() && newGseGroupCats.length > 0) {
      setGseGroups((prev) => [...prev, { label: newGseGroupName.trim(), categories: [...newGseGroupCats] }]);
      setNewGseGroupName("");
      setNewGseGroupCats([]);
    }
  }, [newGseGroupName, newGseGroupCats]);

  const removeGseGroup = useCallback((index: number) => {
    setGseGroups((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV(result);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuotas_muestra.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleExportExcel = useCallback(() => {
    const xml = exportToExcel(result);
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuotas_muestra.xls";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const isZoneFullySelected = (zone: Zone) =>
    ZONE_REGIONS[zone].every((c) => selectedRegions.includes(c));
  const isZonePartiallySelected = (zone: Zone) =>
    ZONE_REGIONS[zone].some((c) => selectedRegions.includes(c)) && !isZoneFullySelected(zone);

  const hasGse = selectedGse.length > 0;
  const geoLabel = groupBy === "zone" ? "Zona" : groupBy === "region" ? "Región" : "Comuna";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando datos del Censo 2024…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Error al cargar datos</p>
            <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper to render a summary table with margin of error
  const renderSummaryTable = (title: string, labelHeader: string, data: typeof result.bySex) => (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">{labelHeader}</TableHead>
              <TableHead className="font-semibold text-right">Población</TableHead>
              <TableHead className="font-semibold text-right">Proporción</TableHead>
              <TableHead className="font-semibold text-right">Muestra</TableHead>
              <TableHead className="font-semibold text-right">Margen de Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{row.label}</TableCell>
                <TableCell className="text-sm text-right font-mono">{row.population.toLocaleString("es-CL")}</TableCell>
                <TableCell className="text-sm text-right font-mono">{(row.proportion * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-sm text-right font-mono font-semibold text-primary">{row.sample}</TableCell>
                <TableCell className="text-sm text-right font-mono text-muted-foreground">{marginOfErrorRow(row.sample)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Calculadora de Muestras
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Basado en datos del Censo de Chile 2024 — INE
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Universe Config */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Universo Objetivo
              </CardTitle>
              <CardDescription>Define la población a estudiar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Edad mínima</Label>
                  <Input
                    type="number"
                    value={ageMin}
                    onChange={(e) => setAgeMin(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={85}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Edad máxima</Label>
                  <Input
                    type="number"
                    value={ageMax === 120 ? "" : ageMax}
                    placeholder="Sin límite"
                    onChange={(e) => setAgeMax(e.target.value ? parseInt(e.target.value) : 120)}
                    min={1}
                    max={120}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Sexo</Label>
                <Select value={sexFilter} onValueChange={(v) => setSexFilter(v as typeof sexFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambos sexos</SelectItem>
                    <SelectItem value="male">Solo hombres</SelectItem>
                    <SelectItem value="female">Solo mujeres</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Tamaño de muestra (n)
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-48 text-xs">Número total de personas a encuestar. Se distribuirá proporcionalmente.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Agrupar por</Label>
                <Select value={groupBy} onValueChange={(v) => {
                  setGroupBy(v as typeof groupBy);
                  if (v === "comuna") {
                    setComunaRegion(null);
                    setSelectedComunas([]);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone">Zona</SelectItem>
                    <SelectItem value="region">Región</SelectItem>
                    <SelectItem value="comuna">Comuna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comuna mode: select region then comuna */}
              {groupBy === "comuna" && (
                <div className="space-y-3 rounded-md border p-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Región</Label>
                    <Select value={comunaRegion?.toString() ?? ""} onValueChange={(v) => {
                      setComunaRegion(parseInt(v));
                      setSelectedComunas([]);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una región" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_MAP.map((r) => (
                          <SelectItem key={r.code} value={r.code.toString()}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {comunaRegion !== null && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Comuna</Label>
                      <Select
                        value={selectedComunas[0]?.toString() ?? ""}
                        onValueChange={(v) => setSelectedComunas([parseInt(v)])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una comuna" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableComunasForMode.map((c) => (
                            <SelectItem key={c.comuna} value={c.comuna.toString()}>{c.nombre_comuna}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* GSE Selector */}
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Grupo Socioeconómico (GSE)
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-48 text-xs">Si seleccionas uno o más GSE, el universo se calcula solo con personas de esos grupos y GSE se agrega como dimensión de análisis.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {GSE_OPTIONS.map((gse) => (
                    <div key={gse} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`gse-${gse}`}
                        checked={selectedGse.includes(gse)}
                        onCheckedChange={(checked) => toggleGse(gse, !!checked)}
                      />
                      <Label htmlFor={`gse-${gse}`} className="text-xs cursor-pointer">{gse}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                  La distribución de GSE se aplica a nivel comunal con proporción uniforme entre grupos de edad y sexo (fuente: AIM 2023).
                </p>
              </div>

              {/* GSE distribution table */}
              {gseDistribution && (
                <div className="rounded-md border p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Distribución GSE (comuna seleccionada)</p>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {Object.entries(gseDistribution).map(([gse, pct]) => (
                      <div key={gse}>
                        <p className="text-xs font-semibold">{gse}</p>
                        <p className="text-xs text-muted-foreground">{(pct * 100).toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regions - hidden in comuna mode */}
          {groupBy !== "comuna" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Regiones / Zonas
                </CardTitle>
                <CardDescription>Selecciona las regiones a incluir</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {(Object.keys(ZONE_REGIONS) as Zone[]).map((zone) => (
                    <div key={zone}>
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox
                          id={`zone-${zone}`}
                          checked={isZoneFullySelected(zone)}
                          ref={(el) => {
                            if (el) {
                              (el as unknown as HTMLButtonElement).dataset.state =
                                isZonePartiallySelected(zone) ? "indeterminate" : isZoneFullySelected(zone) ? "checked" : "unchecked";
                            }
                          }}
                          onCheckedChange={(checked) => toggleZone(zone, !!checked)}
                        />
                        <Label htmlFor={`zone-${zone}`} className="text-sm font-medium cursor-pointer">
                          {ZONE_LABELS[zone]}
                        </Label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {REGION_MAP.filter((r) => ZONE_REGIONS[zone].includes(r.code)).map((region) => (
                          <div key={region.code} className="flex items-center gap-2">
                            <Checkbox
                              id={`region-${region.code}`}
                              checked={selectedRegions.includes(region.code)}
                              onCheckedChange={(checked) => toggleRegion(region.code, !!checked)}
                            />
                            <Label
                              htmlFor={`region-${region.code}`}
                              className="text-xs text-muted-foreground cursor-pointer"
                            >
                              {region.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Age Ranges */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tramos de Edad
              </CardTitle>
              <CardDescription>Personaliza los rangos para la tabla de cuotas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {ageRanges.map((r, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-sm">
                    {r.label}
                    <button onClick={() => removeAgeRange(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Input type="number" placeholder="1" value={newRangeMin} onChange={(e) => setNewRangeMin(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input type="number" placeholder="29" value={newRangeMax} onChange={(e) => setNewRangeMax(e.target.value)} />
                </div>
                <Button variant="outline" size="icon" onClick={addAgeRange}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setAgeRanges(DEFAULT_AGE_RANGES)}>
                Restaurar tramos por defecto
              </Button>
            </CardContent>
          </Card>

          {/* GSE Groups */}
          {hasGse && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Agrupar GSE
                </CardTitle>
                <CardDescription>Agrupa categorías GSE con nombre libre</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {gseGroups.map((g, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-sm">
                      {g.label} ({g.categories.join("+")})
                      <button onClick={() => removeGseGroup(i)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nombre del grupo</Label>
                  <Input placeholder="Ej: ABC1" value={newGseGroupName} onChange={(e) => setNewGseGroupName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Categorías</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedGse.map((gse) => (
                      <div key={gse} className="flex items-center gap-1">
                        <Checkbox
                          id={`gse-group-${gse}`}
                          checked={newGseGroupCats.includes(gse)}
                          onCheckedChange={(checked) =>
                            setNewGseGroupCats((prev) =>
                              checked ? [...prev, gse] : prev.filter((g) => g !== gse)
                            )
                          }
                        />
                        <Label htmlFor={`gse-group-${gse}`} className="text-xs cursor-pointer">{gse}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={addGseGroup}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar grupo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Universo Total</p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {result.totalUniverse.toLocaleString("es-CL")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">personas en población objetivo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Tamaño de Muestra</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {result.sampleSize.toLocaleString("es-CL")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">encuestas a realizar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Margen de Error</p>
              <p className="text-3xl font-bold text-foreground mt-1">
                ±{result.marginOfError.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">al 95% de confianza</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className={`grid grid-cols-1 gap-6 ${hasGse ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por Sexo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.bySex} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={60} />
                  <RechartsTooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]} />
                  <Bar dataKey="proportion" radius={[0, 4, 4, 0]}>
                    {result.bySex.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por Edad</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.byAge}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <RechartsTooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]} />
                  <Bar dataKey="proportion" radius={[4, 4, 0, 0]}>
                    {result.byAge.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por {geoLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.byRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={groupBy === "zone" ? 50 : 120} />
                  <RechartsTooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]} />
                  <Bar dataKey="proportion" radius={[0, 4, 4, 0]}>
                    {result.byRegion.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {hasGse && result.byGse.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribución por GSE</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={result.byGse}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <RechartsTooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]} />
                    <Bar dataKey="proportion" radius={[4, 4, 0, 0]}>
                      {result.byGse.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quota Tables */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tablas de Cuotas</CardTitle>
                <CardDescription>Distribución proporcional de la muestra</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="direct" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="direct">Cuotas Directas</TabsTrigger>
                <TabsTrigger value="crossed">Cuotas Cruzadas</TabsTrigger>
              </TabsList>

              {/* Direct Quotas */}
              <TabsContent value="direct" className="space-y-6">
                {result.bySex.length > 0 && renderSummaryTable("Por Sexo", "Sexo", result.bySex)}
                {result.byAge.length > 0 && renderSummaryTable("Por Tramo de Edad", "Tramo", result.byAge)}
                {result.byRegion.length > 0 && renderSummaryTable(`Por ${geoLabel}`, geoLabel, result.byRegion)}
                {hasGse && result.byGse.length > 0 && renderSummaryTable("Por GSE", "Categoría", result.byGse)}
              </TabsContent>

              {/* Crossed Quotas */}
              <TabsContent value="crossed">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <span className="text-sm font-medium text-foreground">Cruzar por:</span>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cross-sex" checked={crossSex} onCheckedChange={(v) => setCrossSex(!!v)} />
                    <Label htmlFor="cross-sex" className="text-sm cursor-pointer">Sexo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cross-age" checked={crossAge} onCheckedChange={(v) => setCrossAge(!!v)} />
                    <Label htmlFor="cross-age" className="text-sm cursor-pointer">Tramo de Edad</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="cross-region" checked={crossRegion} onCheckedChange={(v) => setCrossRegion(!!v)} />
                    <Label htmlFor="cross-region" className="text-sm cursor-pointer">{geoLabel}</Label>
                  </div>
                  {hasGse && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="cross-gse" checked={crossGse} onCheckedChange={(v) => setCrossGse(!!v)} />
                      <Label htmlFor="cross-gse" className="text-sm cursor-pointer">GSE</Label>
                    </div>
                  )}
                </div>
                {(!crossSex && !crossAge && !crossRegion && !crossGse) ? (
                  <p className="text-sm text-muted-foreground">Selecciona al menos una variable para cruzar.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">{crossedQuotas.length} segmentos cruzados</p>
                    <div className="rounded-md border overflow-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            {crossRegion && <TableHead className="font-semibold">{geoLabel}</TableHead>}
                            {crossSex && <TableHead className="font-semibold">Sexo</TableHead>}
                            {crossAge && <TableHead className="font-semibold">Tramo Edad</TableHead>}
                            {hasGse && crossGse && <TableHead className="font-semibold">GSE</TableHead>}
                            <TableHead className="font-semibold text-right">Población</TableHead>
                            <TableHead className="font-semibold text-right">Proporción</TableHead>
                            <TableHead className="font-semibold text-right">Muestra</TableHead>
                            <TableHead className="font-semibold text-right">Margen de Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crossedQuotas.map((q, i) => (
                            <TableRow key={i}>
                              {crossRegion && <TableCell className="text-sm">{q.region}</TableCell>}
                              {crossSex && <TableCell className="text-sm">{q.sex}</TableCell>}
                              {crossAge && <TableCell className="text-sm">{q.ageRange}</TableCell>}
                              {hasGse && crossGse && <TableCell className="text-sm">{q.gse}</TableCell>}
                              <TableCell className="text-sm text-right font-mono">{q.population.toLocaleString("es-CL")}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{(q.proportion * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-sm text-right font-mono font-semibold text-primary">{q.sample}</TableCell>
                              <TableCell className="text-sm text-right font-mono text-muted-foreground">{marginOfErrorRow(q.sample)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          Fuente: Censo de población y vivienda INE Chile 2024. Datos reales a nivel de comuna, sexo y edad.
        </p>
      </div>
    </div>
  );
}
