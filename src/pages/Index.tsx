import { useState, useMemo, useCallback } from "react";
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
import { CENSUS_DATA, ZONE_LABELS, type Zone } from "@/data/censo-chile-2024";
import {
  calculateSample,
  exportToCSV,
  type SampleConfig,
  type AgeRange,
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
import { Download, Users, Target, TrendingUp, HelpCircle, Plus, X, FileSpreadsheet } from "lucide-react";

const DEFAULT_AGE_RANGES: AgeRange[] = [
  { label: "18-29", min: 18, max: 29 },
  { label: "30-44", min: 30, max: 44 },
  { label: "45-59", min: 45, max: 59 },
  { label: "60+", min: 60, max: 120 },
];

const ZONE_REGIONS: Record<Zone, string[]> = {
  Norte: ["XV", "I", "II", "III", "IV"],
  Centro: ["V", "VI", "VII"],
  RM: ["XIII"],
  Sur: ["VIII", "IX", "XIV", "X", "XI", "XII", "XVI"],
};

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(172, 66%, 50%)",
  "hsl(43, 96%, 56%)",
  "hsl(27, 87%, 67%)",
  "hsl(280, 65%, 60%)",
];

export default function SampleDashboard() {
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(120);
  const [sexFilter, setSexFilter] = useState<"both" | "male" | "female">("both");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(CENSUS_DATA.map((r) => r.code));
  const [ageRanges, setAgeRanges] = useState<AgeRange[]>(DEFAULT_AGE_RANGES);
  const [sampleSize, setSampleSize] = useState(1000);
  const [groupBy, setGroupBy] = useState<"region" | "zone">("zone");
  const [newRangeMin, setNewRangeMin] = useState("");
  const [newRangeMax, setNewRangeMax] = useState("");

  const config: SampleConfig = useMemo(
    () => ({ ageMin, ageMax, sexFilter, selectedRegions, ageRanges, sampleSize, groupBy }),
    [ageMin, ageMax, sexFilter, selectedRegions, ageRanges, sampleSize, groupBy]
  );

  const result: SampleResult = useMemo(() => calculateSample(config), [config]);

  const toggleZone = useCallback(
    (zone: Zone, checked: boolean) => {
      const zoneCodes = ZONE_REGIONS[zone];
      setSelectedRegions((prev) =>
        checked ? [...new Set([...prev, ...zoneCodes])] : prev.filter((c) => !zoneCodes.includes(c))
      );
    },
    []
  );

  const toggleRegion = useCallback((code: string, checked: boolean) => {
    setSelectedRegions((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)));
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
    // Simple Excel XML export
    const rows = result.quotas.map(
      (q) =>
        `<Row><Cell><Data ss:Type="String">${q.region}</Data></Cell><Cell><Data ss:Type="String">${q.sex}</Data></Cell><Cell><Data ss:Type="String">${q.ageRange}</Data></Cell><Cell><Data ss:Type="Number">${q.population}</Data></Cell><Cell><Data ss:Type="Number">${(q.proportion * 100).toFixed(2)}</Data></Cell><Cell><Data ss:Type="Number">${q.sample}</Data></Cell></Row>`
    );
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Cuotas"><Table><Row><Cell><Data ss:Type="String">Región/Zona</Data></Cell><Cell><Data ss:Type="String">Sexo</Data></Cell><Cell><Data ss:Type="String">Tramo Edad</Data></Cell><Cell><Data ss:Type="String">Población</Data></Cell><Cell><Data ss:Type="String">Proporción (%)</Data></Cell><Cell><Data ss:Type="String">Muestra</Data></Cell></Row>${rows.join("")}</Table></Worksheet></Workbook>`;
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
              Basado en proyecciones del Censo de Chile 2024 — INE
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    onChange={(e) => setAgeMin(parseInt(e.target.value) || 0)}
                    min={0}
                    max={120}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Edad máxima</Label>
                  <Input
                    type="number"
                    value={ageMax === 120 ? "" : ageMax}
                    placeholder="Sin límite"
                    onChange={(e) => setAgeMax(e.target.value ? parseInt(e.target.value) : 120)}
                    min={0}
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
                      <p className="max-w-48 text-xs">Número total de personas a encuestar. Se distribuirá proporcionalmente según las variables seleccionadas.</p>
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
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone">Zona</SelectItem>
                    <SelectItem value="region">Región</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Regions */}
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
                      {CENSUS_DATA.filter((r) => ZONE_REGIONS[zone].includes(r.code)).map((region) => (
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
                  <Input
                    type="number"
                    placeholder="18"
                    value={newRangeMin}
                    onChange={(e) => setNewRangeMin(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input
                    type="number"
                    placeholder="29"
                    value={newRangeMax}
                    onChange={(e) => setNewRangeMax(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" onClick={addAgeRange}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs w-full"
                onClick={() => setAgeRanges(DEFAULT_AGE_RANGES)}
              >
                Restaurar tramos por defecto
              </Button>
            </CardContent>
          </Card>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <RechartsTooltip
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]}
                  />
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
                  <RechartsTooltip
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]}
                  />
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
              <CardTitle className="text-sm">
                Distribución por {groupBy === "zone" ? "Zona" : "Región"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.byRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={groupBy === "zone" ? 50 : 120} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Proporción"]}
                  />
                  <Bar dataKey="proportion" radius={[0, 4, 4, 0]}>
                    {result.byRegion.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quota Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tabla de Cuotas</CardTitle>
                <CardDescription>
                  Distribución proporcional de la muestra — {result.quotas.length} segmentos
                </CardDescription>
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
            <div className="rounded-md border overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{groupBy === "zone" ? "Zona" : "Región"}</TableHead>
                    <TableHead className="font-semibold">Sexo</TableHead>
                    <TableHead className="font-semibold">Tramo Edad</TableHead>
                    <TableHead className="font-semibold text-right">Población</TableHead>
                    <TableHead className="font-semibold text-right">Proporción</TableHead>
                    <TableHead className="font-semibold text-right">Muestra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.quotas.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{q.region}</TableCell>
                      <TableCell className="text-sm">{q.sex}</TableCell>
                      <TableCell className="text-sm">{q.ageRange}</TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {q.population.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {(q.proportion * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono font-semibold text-primary">
                        {q.sample}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          Fuente: Proyecciones de población INE Chile 2024. Los datos son aproximados para fines de muestreo.
        </p>
      </div>
    </div>
  );
}
