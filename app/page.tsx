"use client";

import { useMemo, useState } from "react";
import dashboardData from "./data/dashboard-data.json";

type MetricRow = {
  platformId: string;
  platformLabel: string;
  sourcePlatform?: string;
  periodId: string;
  periodLabel: string;
  periodKind: string;
  monthLabel?: string;
  timeProgress?: number | null;
  region: string;
  parent: string;
  gmv: number;
  quantity?: number | null;
  orders?: number | null;
  users?: number | null;
  activityGmv: number;
  subsidy: number;
  budget?: number | null;
  buTarget?: number | null;
  targetGmv?: number | null;
  actualTmFeeRatio?: number | null;
  targetPromoFeeRatio?: number | null;
};

type BreakdownRow = MetricRow & {
  channel?: string;
  brand?: string;
  merchant?: string;
  product?: string;
};

type ActivityRow = {
  platformId: string;
  platformLabel: string;
  periodId: string;
  periodLabel: string;
  periodKind: string;
  region: string;
  parent: string;
  activityName: string;
  redemptionAmount: number;
  activityGmv: number;
  promoFeeRatio: number | null;
  activityRoi: number | null;
  couponCount: number;
};

type Aggregate = {
  gmv: number;
  quantity: number;
  orders: number;
  users: number;
  activityGmv: number;
  subsidy: number;
  budget: number;
  target: number;
  timeProgress: number | null;
  targetPromoFeeRatio: number | null;
  actualTmFeeRatio: number | null;
  activityShare: number | null;
  promoFeeRatio: number | null;
  activityDiscount: number | null;
  promoBudgetUsage: number | null;
  promoBudgetRemaining: number | null;
  targetAchievement: number | null;
  paceAchievement: number | null;
};

type DataShape = {
  metadata: {
    title: string;
    generatedAt: string;
    currentPeriodId: string;
    previousPeriodId: string;
    lastYearPeriodId: string;
    periods: Array<{
      id: string;
      label: string;
      shortLabel: string;
      kind: string;
      start: string;
      end: string;
      monthLabel: string;
      timeProgress: number;
    }>;
    platforms: Array<{
      id: string;
      label: string;
      sourcePlatform: string;
    }>;
    regionOrder: string[];
    regionParent: Record<string, string>;
    regionGroups: Record<string, string[]>;
  };
  records: MetricRow[];
  breakdowns: {
    channels: BreakdownRow[];
    brands: BreakdownRow[];
    merchants: BreakdownRow[];
    products: BreakdownRow[];
    activities: ActivityRow[];
  };
  reconciliation: Array<Record<string, string | number>>;
};

const data = dashboardData as DataShape;
const PLATFORM_ALL = "all";
const REGION_ALL = "all";
const GROUP_ORDER = ["CBC", "CIB", "NX", "XJ", "YN", "华中", "未识别"];
const EXCEL_REGION_ROWS = [
  "CBC-CQ",
  "CBC-SC",
  "CBC",
  "CIB东南",
  "CIB华北",
  "CIB华南",
  "CIB苏皖",
  "CIB",
  "NX",
  "XJ",
  "YN",
  "华中-湖南",
  "华中-非湖南",
  "华中",
  "总计",
];

function safeRatio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

function leavesFor(region: string): string[] {
  if (region === REGION_ALL || region === "总计") return data.metadata.regionOrder;
  return data.metadata.regionGroups[region] ?? [region];
}

function platformIds(platform: string): string[] {
  if (platform === PLATFORM_ALL) return data.metadata.platforms.map((item) => item.id);
  return [platform];
}

function aggregateRows(rows: MetricRow[]): Aggregate {
  const totals = rows.reduce(
    (acc, row) => {
      acc.gmv += row.gmv || 0;
      acc.quantity += row.quantity || 0;
      acc.orders += row.orders || 0;
      acc.users += row.users || 0;
      acc.activityGmv += row.activityGmv || 0;
      acc.subsidy += row.subsidy || 0;
      acc.budget += row.budget || 0;
      acc.target += row.buTarget || 0;
      if (row.timeProgress && !acc.timeProgress) acc.timeProgress = row.timeProgress;
      return acc;
    },
    {
      gmv: 0,
      quantity: 0,
      orders: 0,
      users: 0,
      activityGmv: 0,
      subsidy: 0,
      budget: 0,
      target: 0,
      timeProgress: null as number | null,
    },
  );

  const targetAchievement = safeRatio(totals.gmv, totals.target);
  const targetPromoFeeRatio = weightedUniquePlatformRatio(rows, "targetPromoFeeRatio");
  return {
    ...totals,
    targetPromoFeeRatio,
    actualTmFeeRatio: sumUniquePlatformRatio(rows, "actualTmFeeRatio"),
    activityShare: safeRatio(totals.activityGmv, totals.gmv),
    promoFeeRatio: safeRatio(totals.subsidy, totals.gmv),
    activityDiscount:
      totals.activityGmv > 0 ? 1 - totals.subsidy / totals.activityGmv : null,
    promoBudgetUsage: safeRatio(totals.subsidy, totals.budget),
    promoBudgetRemaining: totals.budget ? totals.budget - totals.subsidy : null,
    targetAchievement,
    paceAchievement:
      targetAchievement !== null && totals.timeProgress
        ? targetAchievement / totals.timeProgress
        : null,
  };
}

function sumUniquePlatformRatio(
  rows: MetricRow[],
  key: "actualTmFeeRatio" | "targetPromoFeeRatio",
): number | null {
  const byPlatform = new Map<string, number>();
  rows.forEach((row) => {
    const value = row[key];
    if (value !== null && value !== undefined && !byPlatform.has(row.platformId)) {
      byPlatform.set(row.platformId, value);
    }
  });
  if (!byPlatform.size) return null;
  return Array.from(byPlatform.values()).reduce((sum, value) => sum + value, 0);
}

function weightedUniquePlatformRatio(
  rows: MetricRow[],
  key: "targetPromoFeeRatio",
): number | null {
  const byPlatform = new Map<string, { value: number; target: number }>();
  rows.forEach((row) => {
    const value = row[key];
    const target = row.targetGmv || 0;
    if (value !== null && value !== undefined && !byPlatform.has(row.platformId)) {
      byPlatform.set(row.platformId, { value, target });
    }
  });
  const values = Array.from(byPlatform.values());
  const denominator = values.reduce((sum, item) => sum + item.target, 0);
  if (!denominator) return values.length ? values[0].value : null;
  return values.reduce((sum, item) => sum + item.value * item.target, 0) / denominator;
}

function buildAggregate(periodId: string, platform: string, region: string): Aggregate {
  const selectedLeaves = new Set(leavesFor(region));
  const selectedPlatforms = new Set(platformIds(platform));
  return aggregateRows(
    data.records.filter(
      (row) =>
        row.periodId === periodId &&
        selectedPlatforms.has(row.platformId) &&
        selectedLeaves.has(row.region),
    ),
  );
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}元`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function formatCount(value: number | null | undefined, unit: string): string {
  const formatted = formatNumber(value);
  return formatted === "-" ? formatted : `${formatted}${unit}`;
}

function formatRoi(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}倍`;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatPointDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}pp`;
}

function formatPointDistance(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(Math.abs(value) * 100).toFixed(1)}pp`;
}

function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value)}`;
}

function trendTone(value: number | null | undefined, invert = false): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return "neutral";
  }
  const positive = invert ? value < 0 : value > 0;
  return positive ? "good" : "bad";
}

function periodLabel(periodId: string): string {
  return data.metadata.periods.find((period) => period.id === periodId)?.label ?? periodId;
}

function selectedRegionLabel(region: string): string {
  return region === REGION_ALL ? "全国/全区域" : region;
}

function periodMonthText(periodId: string): string {
  const p = data.metadata.periods.find((item) => item.id === periodId);
  if (!p) return periodId;
  const year = p.start.startsWith("2025") ? "Y25" : "Y26";
  const month = Number(p.start.slice(5, 7));
  const start = `${Number(p.start.slice(5, 7))}.${Number(p.start.slice(8, 10))}`;
  const end = `${Number(p.end.slice(5, 7))}.${Number(p.end.slice(8, 10))}`;
  return `${year} ${month}月(${start}-${end})`;
}

function regionTableNodes(region: string): string[] {
  if (region === REGION_ALL) return EXCEL_REGION_ROWS;
  const children = data.metadata.regionGroups[region];
  if (children && children.length > 1) return [...children, region];
  return [region];
}

function colLabel(first: string, second?: string) {
  return (
    <>
      {first}
      {second ? (
        <>
          <br />
          {second}
        </>
      ) : null}
    </>
  );
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "segment active" : "segment"} onClick={onClick}>
      {children}
    </button>
  );
}

type CoreMetric = {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad" | "neutral" | "warn";
};

type ScopeOption = {
  id: string;
  label: string;
  platform: string;
  variant: "merged" | "platform";
};

type ComboChartRow = {
  label: string;
  bar: number | null;
  barLabel?: string;
  primary?: number | null;
  primaryLabel?: string;
  secondary?: number | null;
  secondaryLabel?: string;
};

function CoreMetricCard({
  metric,
  variant,
}: {
  metric: CoreMetric;
  variant: "merged" | "platform";
}) {
  return (
    <article className={`core-metric-card ${variant} ${metric.tone ?? "neutral"}`}>
      <div className="core-metric-label">{metric.label}</div>
      <div className="core-metric-value">{metric.value}</div>
      <div className="core-metric-sub">{metric.sub}</div>
    </article>
  );
}

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function niceAmountMax(values: Array<number | null | undefined>): number {
  const max = Math.max(0, ...values.filter(finiteNumber));
  if (!max) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

function nicePercentMax(values: Array<number | null | undefined>, fallback = 1): number {
  const max = Math.max(0, ...values.filter(finiteNumber));
  if (!max) return fallback;
  if (max <= 0.4) return 0.4;
  if (max <= 0.6) return 0.6;
  if (max <= 0.8) return 0.8;
  if (max <= 1) return 1;
  return Math.ceil(max * 10) / 10;
}

function chartLabel(label: string): string {
  return label.length > 7 ? `${label.slice(0, 7)}…` : label;
}

function buildScopeOptions(platform: string): ScopeOption[] {
  if (platform === PLATFORM_ALL) {
    return [
      {
        id: "merged",
        label: "合并条件",
        platform: PLATFORM_ALL,
        variant: "merged",
      },
      ...data.metadata.platforms.map((item) => ({
        id: item.id,
        label: item.label,
        platform: item.id,
        variant: "platform" as const,
      })),
    ];
  }
  const selected = data.metadata.platforms.find((item) => item.id === platform);
  return [
    {
      id: platform,
      label: selected?.label ?? platform,
      platform,
      variant: "platform",
    },
  ];
}

function promoTargetText(row: Aggregate): string {
  if (row.promoFeeRatio === null || row.targetPromoFeeRatio === null) return "目标 -";
  const diff = row.promoFeeRatio - row.targetPromoFeeRatio;
  return `${diff >= 0 ? "高于目标" : "低于目标"} ${formatPointDistance(diff)}`;
}

function activityShareText(value: number | null): string {
  if (value === null) return "活动GMV -";
  if (value >= 0.6) return "促销依赖度高";
  if (value >= 0.45) return "促销贡献偏高";
  return "促销依赖度可控";
}

function ComboBarLineChart({
  title,
  rows,
  barName,
  primaryName,
  secondaryName,
  barFormatter = formatMoney,
  lineFormatter = formatPercent,
  lineMax,
}: {
  title: string;
  rows: ComboChartRow[];
  barName: string;
  primaryName: string;
  secondaryName?: string;
  barFormatter?: (value: number | null | undefined) => string;
  lineFormatter?: (value: number | null | undefined) => string;
  lineMax?: number;
}) {
  const chartRows = rows.slice(0, 14);
  const width = 760;
  const height = 360;
  const left = 58;
  const right = 58;
  const top = 44;
  const bottom = 82;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const plotBottom = top + plotHeight;
  const step = plotWidth / Math.max(chartRows.length, 1);
  const barWidth = Math.max(14, Math.min(34, step * 0.46));
  const barMax = niceAmountMax(chartRows.map((row) => row.bar));
  const computedLineMax =
    lineMax ??
    nicePercentMax(chartRows.flatMap((row) => [row.primary, row.secondary]), 1);
  const xFor = (index: number) => left + step * index + step / 2;
  const barY = (value: number) => plotBottom - (Math.max(value, 0) / barMax) * plotHeight;
  const lineY = (value: number) =>
    plotBottom - (Math.max(value, 0) / computedLineMax) * plotHeight;
  const linePoints = (key: "primary" | "secondary") =>
    chartRows
      .map((row, index) => {
        const value = row[key];
        return finiteNumber(value) ? `${xFor(index)},${lineY(value)}` : null;
      })
      .filter(Boolean)
      .join(" ");

  return (
    <article className="summary-chart-card">
      <div className="summary-chart-heading">
        <h3>{title}</h3>
        <div className="chart-legend">
          <span className="legend-bar">{barName}</span>
          <span className="legend-primary">{primaryName}</span>
          {secondaryName ? <span className="legend-secondary">{secondaryName}</span> : null}
        </div>
      </div>
      <svg className="summary-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 0.5, 1].map((ratio) => {
          const y = plotBottom - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line className="chart-grid-line" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="chart-axis-label" x={left - 10} y={y + 4} textAnchor="end">
                {barFormatter(barMax * ratio)}
              </text>
              <text className="chart-axis-label" x={width - right + 10} y={y + 4}>
                {lineFormatter(computedLineMax * ratio)}
              </text>
            </g>
          );
        })}
        {chartRows.map((row, index) => {
          const value = row.bar ?? 0;
          const x = xFor(index);
          const y = barY(value);
          const heightValue = plotBottom - y;
          return (
            <g key={`${row.label}-${index}`}>
              <rect
                className="chart-bar"
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={heightValue}
                rx={3}
              />
              <text className="chart-value-label bar-label" x={x} y={Math.max(top + 14, y - 8)} textAnchor="middle">
                {row.barLabel ?? barFormatter(row.bar)}
              </text>
              <text
                className="chart-x-label"
                x={x}
                y={plotBottom + 28}
                textAnchor="end"
                transform={`rotate(-42 ${x} ${plotBottom + 28})`}
              >
                {chartLabel(row.label)}
              </text>
            </g>
          );
        })}
        {linePoints("primary") ? (
          <polyline className="chart-line primary" points={linePoints("primary")} />
        ) : null}
        {linePoints("secondary") ? (
          <polyline className="chart-line secondary" points={linePoints("secondary")} />
        ) : null}
        {chartRows.map((row, index) => {
          const x = xFor(index);
          return (
            <g key={`${row.label}-points-${index}`}>
              {finiteNumber(row.primary) ? (
                <>
                  <circle className="chart-point primary" cx={x} cy={lineY(row.primary)} r={5} />
                  <text className="chart-value-label primary-label" x={x} y={lineY(row.primary) - 12} textAnchor="middle">
                    {row.primaryLabel ?? lineFormatter(row.primary)}
                  </text>
                </>
              ) : null}
              {finiteNumber(row.secondary) ? (
                <>
                  <circle className="chart-point secondary" cx={x} cy={lineY(row.secondary)} r={4} />
                  <text className="chart-value-label secondary-label" x={x} y={lineY(row.secondary) + 22} textAnchor="middle">
                    {row.secondaryLabel ?? lineFormatter(row.secondary)}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function SimpleBarChart({
  title,
  rows,
  barName,
  formatter = formatPercent,
}: {
  title: string;
  rows: ComboChartRow[];
  barName: string;
  formatter?: (value: number | null | undefined) => string;
}) {
  const chartRows = rows.slice(0, 14);
  const width = 760;
  const height = 330;
  const left = 54;
  const right = 22;
  const top = 42;
  const bottom = 78;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const plotBottom = top + plotHeight;
  const step = plotWidth / Math.max(chartRows.length, 1);
  const barWidth = Math.max(16, Math.min(38, step * 0.5));
  const barMax = nicePercentMax(chartRows.map((row) => row.bar), 0.2);
  const xFor = (index: number) => left + step * index + step / 2;
  const yFor = (value: number) => plotBottom - (Math.max(value, 0) / barMax) * plotHeight;

  return (
    <article className="summary-chart-card">
      <div className="summary-chart-heading">
        <h3>{title}</h3>
        <div className="chart-legend">
          <span className="legend-bar">{barName}</span>
        </div>
      </div>
      <svg className="summary-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 0.5, 1].map((ratio) => {
          const y = plotBottom - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line className="chart-grid-line" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="chart-axis-label" x={left - 10} y={y + 4} textAnchor="end">
                {formatter(barMax * ratio)}
              </text>
            </g>
          );
        })}
        {chartRows.map((row, index) => {
          const value = row.bar ?? 0;
          const x = xFor(index);
          const y = yFor(value);
          return (
            <g key={`${row.label}-${index}`}>
              <rect
                className="chart-bar"
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={plotBottom - y}
                rx={3}
              />
              <text className="chart-value-label bar-label" x={x} y={Math.max(top + 14, y - 8)} textAnchor="middle">
                {row.barLabel ?? formatter(row.bar)}
              </text>
              <text
                className="chart-x-label"
                x={x}
                y={plotBottom + 28}
                textAnchor="end"
                transform={`rotate(-42 ${x} ${plotBottom + 28})`}
              >
                {chartLabel(row.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function Panel({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          {kicker ? <p>{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function compareAggregate(current: Aggregate, baseline: Aggregate): number | null {
  return safeRatio(current.gmv - baseline.gmv, baseline.gmv);
}

function promoRatioChange(current: Aggregate, baseline: Aggregate): number | null {
  if (current.promoFeeRatio === null || baseline.promoFeeRatio === null) return null;
  return current.promoFeeRatio - baseline.promoFeeRatio;
}

type BreakdownKey = "channel" | "brand" | "merchant" | "product";

function collectBreakdown(
  rows: BreakdownRow[],
  key: BreakdownKey,
  periodId: string,
  selectedPlatforms: Set<string>,
  selectedLeaves: Set<string>,
) {
  const grouped = new Map<string, MetricRow[]>();
  rows
    .filter(
      (row) =>
        row.periodId === periodId &&
        selectedPlatforms.has(row.platformId) &&
        selectedLeaves.has(row.region),
    )
    .forEach((row) => {
      const name = String(row[key] ?? "未识别");
      const bucket = grouped.get(name) ?? [];
      bucket.push(row);
      grouped.set(name, bucket);
    });
  return Array.from(grouped.entries())
    .map(([name, bucket]) => ({ name, ...aggregateRows(bucket) }))
    .sort((a, b) => b.gmv - a.gmv);
}

function collectActivities(
  rows: ActivityRow[],
  periodId: string,
  selectedPlatforms: Set<string>,
  selectedLeaves: Set<string>,
) {
  const grouped = new Map<
    string,
    { redemptionAmount: number; activityGmv: number; couponCount: number }
  >();
  rows
    .filter(
      (row) =>
        row.periodId === periodId &&
        selectedPlatforms.has(row.platformId) &&
        selectedLeaves.has(row.region),
    )
    .forEach((row) => {
      const bucket = grouped.get(row.activityName) ?? {
        redemptionAmount: 0,
        activityGmv: 0,
        couponCount: 0,
      };
      bucket.redemptionAmount += row.redemptionAmount || 0;
      bucket.activityGmv += row.activityGmv || 0;
      bucket.couponCount += row.couponCount || 0;
      grouped.set(row.activityName, bucket);
    });
  return Array.from(grouped.entries())
    .map(([activityName, value]) => ({
      activityName,
      ...value,
      promoFeeRatio: safeRatio(value.redemptionAmount, value.activityGmv),
      activityRoi: safeRatio(value.activityGmv, value.redemptionAmount),
    }))
    .sort((a, b) => b.redemptionAmount - a.redemptionAmount);
}

function buildNarrative({
  current,
  previous,
  lastYear,
  regionLabel,
  regionDrivers,
  channels,
  brands,
  merchants,
}: {
  current: Aggregate;
  previous: Aggregate;
  lastYear: Aggregate;
  regionLabel: string;
  regionDrivers: Array<{ node: string; current: Aggregate; previous: Aggregate }>;
  channels: Array<{ name: string } & Aggregate>;
  brands: Array<{ name: string } & Aggregate>;
  merchants: Array<{ name: string } & Aggregate>;
}) {
  const wow = compareAggregate(current, previous);
  const yoy = compareAggregate(current, lastYear);
  const targetGap = (current.targetAchievement ?? 0) - (current.timeProgress ?? 0);
  const budgetPressure = (current.promoBudgetUsage ?? 0) - (current.timeProgress ?? 0);
  const topDriver = regionDrivers
    .filter((item) => item.node !== "总计")
    .map((item) => ({
      ...item,
      inc: item.current.gmv - item.previous.gmv,
    }))
    .sort((a, b) => b.inc - a.inc)[0];
  const topChannel = channels[0];
  const topBrand = brands[0];
  const topBrandsShare = brands
    .slice(0, 4)
    .reduce((sum, item) => sum + (safeRatio(item.gmv, current.gmv) ?? 0), 0);
  const longTailBrand = brands
    .slice(4)
    .filter((item) => item.gmv > current.gmv * 0.01)
    .sort((a, b) => b.gmv - a.gmv)[0];
  const flagshipMerchants = merchants.filter((item) => /旗|官方|自营|酒小二/.test(item.name));
  const flagshipGmv = flagshipMerchants.reduce((sum, item) => sum + item.gmv, 0);
  const flagshipShare = safeRatio(flagshipGmv, current.gmv);
  const flagshipTargetGap = flagshipShare === null ? null : 0.3 - flagshipShare;
  const highFeeChannel = channels
    .filter((item) => item.gmv > current.gmv * 0.03 && item.promoFeeRatio !== null)
    .sort((a, b) => (b.promoFeeRatio ?? 0) - (a.promoFeeRatio ?? 0))[0];
  const highActivityChannel = channels
    .filter((item) => item.gmv > current.gmv * 0.03 && item.activityShare !== null)
    .sort((a, b) => (b.activityShare ?? 0) - (a.activityShare ?? 0))[0];
  const feeRisk =
    current.targetPromoFeeRatio !== null && current.promoFeeRatio !== null
      ? current.promoFeeRatio - current.targetPromoFeeRatio
      : null;
  const activityDependence = current.activityShare ?? null;
  const activityRiskLevel =
    activityDependence === null ? "unknown" : activityDependence >= 0.7 ? "high" : activityDependence >= 0.6 ? "watch" : "normal";
  const feeRiskTarget =
    highFeeChannel?.name ?? (regionLabel === "全国/全区域" ? "高费比BU/系统" : regionLabel);
  const activityRiskTarget = highActivityChannel?.name ?? topChannel?.name ?? "活动渠道";

  const conclusions = [
    `${regionLabel}本周全量GMV ${formatMoney(current.gmv)}，环比${formatDelta(wow)}，同比${formatDelta(yoy)}。`,
    `GMV目标达成率 ${formatPercent(current.targetAchievement)}，当月时间进度 ${formatPercent(current.timeProgress)}，当前节奏${targetGap >= 0 ? "领先" : "落后"} ${formatPointDelta(Math.abs(targetGap))}。`,
    `实际促销费比 ${formatPercent(current.promoFeeRatio)}，${feeRisk !== null ? `${feeRisk >= 0 ? "高于" : "低于"}目标 ${formatPointDistance(feeRisk)}` : "目标费比缺失"}；活动GMV占比 ${formatPercent(current.activityShare)}，${activityRiskLevel === "high" ? "促销依赖偏高" : activityRiskLevel === "watch" ? "需观察自然增长承接" : "活动依赖相对可控"}。`,
    `促销预算使用率 ${formatPercent(current.promoBudgetUsage)}，预算消耗${budgetPressure > 0 ? "快于" : "慢于"}时间进度 ${formatPointDistance(budgetPressure)}，需结合BU/系统判断是否追加区域预算。`,
  ];

  const analysis = [
    topDriver
      ? `${topDriver.node}是本周主要增量来源，较上周增加 ${formatMoney(topDriver.inc)}；若大盘费比异常，应先下钻该BU/系统，再看渠道、品牌和活动机制。`
      : `本周区域增量来源不集中，费比监控需从大盘切到各BU/系统，避免单一区域或系统费用失控被总盘掩盖。`,
    topChannel && topBrand
      ? `渠道侧${topChannel.name}贡献最高，全量GMV ${formatMoney(topChannel.gmv)}；品牌侧${topBrand.name}贡献最高，Top4品牌GMV占比 ${formatPercent(topBrandsShare)}，需持续观察中腰部/长尾品牌是否侵蚀头部份额。`
      : `渠道和品牌结构数据不足以形成明确主贡献判断，建议补充竞品活动机制、IP合作和流量置换信息。`,
    highFeeChannel
      ? `${highFeeChannel.name}促销费比达到 ${formatPercent(highFeeChannel.promoFeeRatio)}，应优先判断是全国活动无法局部下线导致，还是单渠道/单品机制过重。`
      : `当前高费比渠道没有明显异常，促销效率风险主要来自预算节奏和活动占比。`,
    flagshipShare !== null
      ? `官旗/酒小二相关商户GMV占比 ${formatPercent(flagshipShare)}，距离30%目标仍差 ${formatPointDistance(flagshipTargetGap)}；若占比继续下滑，核心矛盾更可能在供给和拓店，而非继续加促销费。`
      : `当前商户数据不足以识别官旗占比，建议补充旗舰店、酒小二等商户标签后再判断供给侧问题。`,
  ];

  const actions = [
    feeRisk !== null && feeRisk > 0
      ? `控费比：先定位${feeRiskTarget}，按“下线活动、剔除高费低效品、券熔断、改门槛”顺序处理；若属于全国活动无法单区下线，则提示对应区域追加预算。`
      : `稳费比：保留当前活动框架，但继续按BU/系统监控费比，防止下周单区域费用突然超支。`,
    activityRiskLevel === "high"
      ? `降依赖：${activityRiskTarget}活动GMV占比偏高，减少纯补贴放量，转向加品、换品和门槛优化，验证是否能带动基础GMV增长。`
      : `促增长：预算未明显失控时，优先把资源投向GMV占比高且费比可控的渠道，同时观察活动GMV占比是否继续上行。`,
    longTailBrand
      ? `看结构：跟踪${longTailBrand.name}等中腰部/长尾品牌增长原因，对比竞品大单品满减和IP合作，判断是否正在侵蚀头部品牌。`
      : `看竞品：补充百威、雪花、青岛等大单品活动机制和流量置换信息，作为下周品牌结构变化的解释变量。`,
    flagshipShare !== null && flagshipTargetGap !== null && flagshipTargetGap > 0
      ? `补官旗：官旗占比未达30%目标时，建议优先推动拓店和供给恢复，而不是继续抬费比；重点跟进酒小二/旗舰店供给缺口。`
      : `固官旗：官旗链路若已接近目标，保持专人运营与拓店协同，避免服务商定制品下线再次拖累占比。`,
  ];

  const summary = [
    {
      label: "GMV表现",
      value: formatMoney(current.gmv),
      note: `环比 ${formatDelta(wow)}，同比 ${formatDelta(yoy)}`,
    },
    {
      label: "目标与进度",
      value: formatPercent(current.targetAchievement),
      note: `当月时间进度 ${formatPercent(current.timeProgress)}，进度差 ${formatPointDelta(targetGap)}`,
    },
    {
      label: "费用效率",
      value: formatPercent(current.promoFeeRatio),
      note: `促销费 ${formatMoney(current.subsidy)}，预算使用率 ${formatPercent(current.promoBudgetUsage)}`,
    },
    {
      label: "结构抓手",
      value: topChannel?.name ?? "-",
      note: topBrand ? `核心品牌 ${topBrand.name}，活动GMV占比 ${formatPercent(current.activityShare)}` : `活动GMV占比 ${formatPercent(current.activityShare)}`,
    },
  ];

  return { conclusions, analysis, actions, summary };
}

export default function Home() {
  const [platform, setPlatform] = useState(PLATFORM_ALL);
  const [period, setPeriod] = useState(data.metadata.currentPeriodId);
  const [region, setRegion] = useState(REGION_ALL);

  const selectedLeaves = useMemo(() => new Set(leavesFor(region)), [region]);
  const selectedPlatforms = useMemo(() => new Set(platformIds(platform)), [platform]);
  const current = useMemo(() => buildAggregate(period, platform, region), [period, platform, region]);
  const previous = useMemo(
    () => buildAggregate(data.metadata.previousPeriodId, platform, region),
    [platform, region],
  );
  const lastYear = useMemo(
    () => buildAggregate(data.metadata.lastYearPeriodId, platform, region),
    [platform, region],
  );

  const comparisonEnabled = period === data.metadata.currentPeriodId;
  const wow = comparisonEnabled ? compareAggregate(current, previous) : null;
  const yoy = comparisonEnabled ? compareAggregate(current, lastYear) : null;
  const promoWow = comparisonEnabled ? promoRatioChange(current, previous) : null;
  const promoYoy = comparisonEnabled ? promoRatioChange(current, lastYear) : null;

  const regionRows = useMemo(() => {
    return regionTableNodes(region).map((node) => {
      const currentRow = buildAggregate(period, platform, node);
      const previousRow = buildAggregate(data.metadata.previousPeriodId, platform, node);
      const lastYearRow = buildAggregate(data.metadata.lastYearPeriodId, platform, node);
      return { node, current: currentRow, previous: previousRow, lastYear: lastYearRow };
    });
  }, [period, platform, region]);

  const channels = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.channels,
        "channel",
        period,
        selectedPlatforms,
        selectedLeaves,
      ),
    [period, selectedPlatforms, selectedLeaves],
  );
  const previousChannels = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.channels,
        "channel",
        data.metadata.previousPeriodId,
        selectedPlatforms,
        selectedLeaves,
      ),
    [selectedPlatforms, selectedLeaves],
  );
  const lastYearChannels = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.channels,
        "channel",
        data.metadata.lastYearPeriodId,
        selectedPlatforms,
        selectedLeaves,
      ),
    [selectedPlatforms, selectedLeaves],
  );
  const brands = useMemo(
    () =>
      collectBreakdown(data.breakdowns.brands, "brand", period, selectedPlatforms, selectedLeaves),
    [period, selectedPlatforms, selectedLeaves],
  );
  const merchants = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.merchants,
        "merchant",
        period,
        selectedPlatforms,
        selectedLeaves,
      ),
    [period, selectedPlatforms, selectedLeaves],
  );
  const previousBrands = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.brands,
        "brand",
        data.metadata.previousPeriodId,
        selectedPlatforms,
        selectedLeaves,
      ),
    [selectedPlatforms, selectedLeaves],
  );
  const lastYearBrands = useMemo(
    () =>
      collectBreakdown(
        data.breakdowns.brands,
        "brand",
        data.metadata.lastYearPeriodId,
        selectedPlatforms,
        selectedLeaves,
      ),
    [selectedPlatforms, selectedLeaves],
  );
  const activities = useMemo(
    () => collectActivities(data.breakdowns.activities, period, selectedPlatforms, selectedLeaves),
    [period, selectedPlatforms, selectedLeaves],
  );
  const scopeOptions = useMemo(() => buildScopeOptions(platform), [platform]);
  const coreMetricRows = useMemo(
    () =>
      scopeOptions.map((scope) => {
        const row = buildAggregate(period, scope.platform, region);
        const rowPrevious = buildAggregate(data.metadata.previousPeriodId, scope.platform, region);
        const rowLastYear = buildAggregate(data.metadata.lastYearPeriodId, scope.platform, region);
        const rowWow = comparisonEnabled ? compareAggregate(row, rowPrevious) : null;
        const rowYoy = comparisonEnabled ? compareAggregate(row, rowLastYear) : null;
        const targetGap =
          row.targetAchievement !== null && row.timeProgress !== null
            ? row.targetAchievement - row.timeProgress
            : null;
        const metrics: CoreMetric[] = [
          {
            label: "全量GMV",
            value: formatMoney(row.gmv),
            sub: `环比${formatDelta(rowWow)} 同比${formatDelta(rowYoy)}`,
            tone: trendTone(rowWow) as "good" | "bad" | "neutral",
          },
          {
            label: "促销费比",
            value: formatPercent(row.promoFeeRatio),
            sub: promoTargetText(row),
            tone: trendTone(
              row.promoFeeRatio !== null && row.targetPromoFeeRatio !== null
                ? row.promoFeeRatio - row.targetPromoFeeRatio
                : null,
              true,
            ) as "good" | "bad" | "neutral",
          },
          {
            label: "目标达成率",
            value: formatPercent(row.targetAchievement),
            sub: `时间进度 ${formatPercent(row.timeProgress)}`,
            tone: trendTone(targetGap) as "good" | "bad" | "neutral",
          },
          {
            label: "活动GMV占比",
            value: formatPercent(row.activityShare),
            sub: activityShareText(row.activityShare),
            tone: (row.activityShare ?? 0) >= 0.6 ? "warn" : "neutral",
          },
        ];
        return { ...scope, metrics };
      }),
    [comparisonEnabled, period, region, scopeOptions],
  );
  const summaryPanels = useMemo(
    () =>
      scopeOptions.map((scope) => {
        const regionNodes = regionTableNodes(region).filter((node) => node !== "总计");
        const regionSummaryRows = regionNodes.map((node) => {
          const row = buildAggregate(period, scope.platform, node);
          return {
            label: node,
            bar: row.gmv,
            barLabel: formatMoney(row.gmv),
            primary: row.targetAchievement,
            primaryLabel: formatPercent(row.targetAchievement, 0),
            secondary: row.timeProgress,
            secondaryLabel: formatPercent(row.timeProgress, 0),
          };
        });
        const budgetSummaryRows = regionNodes.map((node) => {
          const row = buildAggregate(period, scope.platform, node);
          return {
            label: node,
            bar: Math.max(row.promoBudgetRemaining ?? 0, 0),
            barLabel: formatMoney(row.promoBudgetRemaining),
            primary: row.promoBudgetUsage,
            primaryLabel: formatPercent(row.promoBudgetUsage, 0),
          };
        });
        const promoFeeRows = regionNodes.map((node) => {
          const row = buildAggregate(period, scope.platform, node);
          return {
            label: node,
            bar: row.promoFeeRatio,
            barLabel: formatPercent(row.promoFeeRatio),
          };
        });
        const scopeAggregate = buildAggregate(period, scope.platform, region);
        const channelRows = collectBreakdown(
          data.breakdowns.channels,
          "channel",
          period,
          new Set(platformIds(scope.platform)),
          new Set(leavesFor(region)),
        )
          .slice(0, 8)
          .map((row) => ({
            label: row.name,
            bar: row.gmv,
            barLabel: formatMoney(row.gmv),
            primary: safeRatio(row.gmv, scopeAggregate.gmv),
            primaryLabel: formatPercent(safeRatio(row.gmv, scopeAggregate.gmv), 0),
            secondary: scopeAggregate.timeProgress,
            secondaryLabel: formatPercent(scopeAggregate.timeProgress, 0),
          }));
        return {
          ...scope,
          regionSummaryRows,
          budgetSummaryRows,
          channelRows,
          promoFeeRows,
        };
      }),
    [period, region, scopeOptions],
  );

  const narrative = useMemo(
    () =>
      buildNarrative({
        current,
        previous,
        lastYear,
        regionLabel: selectedRegionLabel(region),
        regionDrivers: regionRows,
        channels,
        brands,
        merchants,
      }),
    [current, previous, lastYear, region, regionRows, channels, brands, merchants],
  );

  const generated = new Date(data.metadata.generatedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const findNamed = <T extends { name: string }>(rows: T[], name: string) =>
    rows.find((row) => row.name === name);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Carlsberg weekly retail BI</p>
          <h1>嘉士伯淘京周报数据看板</h1>
          <div className="header-meta">
            <span>{periodLabel(period)}</span>
            <span>{selectedRegionLabel(region)}</span>
            <span>数据生成 {generated}</span>
          </div>
        </div>
        <div className="status-block">
          <span>Excel 字段口径</span>
          <strong>月度总览 + 区域周报 + 渠道/品牌/活动</strong>
          <small>字段名称和指标顺序按原 Excel 周报对齐</small>
        </div>
      </header>

      <section className="control-band">
        <div className="control-group">
          <label>平台</label>
          <div className="segments">
            <SegmentButton active={platform === PLATFORM_ALL} onClick={() => setPlatform(PLATFORM_ALL)}>
              双平台
            </SegmentButton>
            {data.metadata.platforms.map((item) => (
              <SegmentButton active={platform === item.id} key={item.id} onClick={() => setPlatform(item.id)}>
                {item.label}
              </SegmentButton>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label>周期</label>
          <div className="segments">
            {data.metadata.periods.map((item) => (
              <SegmentButton active={period === item.id} key={item.id} onClick={() => setPeriod(item.id)}>
                {item.shortLabel}
              </SegmentButton>
            ))}
          </div>
        </div>
        <div className="control-group compact">
          <label htmlFor="region-select">区域</label>
          <select id="region-select" value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value={REGION_ALL}>全国/全区域</option>
            {GROUP_ORDER.map((group) => (
              <option value={group} key={group}>
                {group}
              </option>
            ))}
            {data.metadata.regionOrder.filter((item) => !GROUP_ORDER.includes(item)).map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="core-matrix">
        {coreMetricRows.map((row) => (
          <div className={`core-scope-row ${row.variant}`} key={row.id}>
            <div className="core-scope-label">
              <span>{row.label}</span>
              <small>{row.variant === "merged" ? "双平台合并" : "平台条件"}</small>
            </div>
            <div className="core-metric-grid">
              {row.metrics.map((metric) => (
                <CoreMetricCard key={`${row.id}-${metric.label}`} metric={metric} variant={row.variant} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="report-grid">
        <Panel title="结论" kicker="区域周报自动解读">
          <ul className="narrative-list">
            {narrative.conclusions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="分析" kicker="本周驱动与风险">
          <ul className="narrative-list">
            {narrative.analysis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="行动建议" kicker="下周可执行动作">
          <ol className="narrative-list ordered">
            {narrative.actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </Panel>
      </section>

      <section className="summary-section">
        <Panel title="Summary" kicker="图形表达按当前筛选区分合并条件与平台条件">
          <div className="summary-scope-stack">
            {summaryPanels.map((scope) => (
              <div className="summary-scope" key={scope.id}>
                <div className="summary-scope-title">
                  <span>{scope.label}</span>
                  <small>{periodLabel(period)} · {selectedRegionLabel(region)}</small>
                </div>
                <div className="summary-chart-grid">
                  <ComboBarLineChart
                    title={`${scope.label}-区域GMV及达成情况`}
                    rows={scope.regionSummaryRows}
                    barName="全量GMV"
                    primaryName="目标GMV达成率"
                    secondaryName="时间进度"
                  />
                  <ComboBarLineChart
                    title={`${scope.label}-区域预算使用情况`}
                    rows={scope.budgetSummaryRows}
                    barName="促销预算剩余金额"
                    primaryName="促销预算使用率"
                    lineMax={1}
                  />
                  <ComboBarLineChart
                    title={`${scope.label}-渠道GMV分布`}
                    rows={scope.channelRows}
                    barName="全量GMV"
                    primaryName="全量GMV占比"
                    secondaryName="时间进度"
                    lineMax={nicePercentMax(scope.channelRows.flatMap((row) => [row.primary, row.secondary]), 0.6)}
                  />
                  <SimpleBarChart
                    title={`${scope.label}-区域促销费比`}
                    rows={scope.promoFeeRows}
                    barName="促销费比"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="unit-note">
            单位说明：金额源表单位为元，页面按元/万/亿自动缩写；占比、达成率、费比、折扣率均为百分比；
            百分比差值使用 pp，即两个百分比的直接差值；活动ROI单位为倍，核券量单位为张。
          </p>
        </Panel>
      </section>

      <section className="table-section">
        <Panel title="月度总览" kicker="字段与 Excel 顶部总览保持一致">
          <div className="table-scroll">
            <table className="metric-table compact">
              <thead>
                <tr>
                  <th>月份</th>
                  <th>当月时间进度</th>
                  <th>全量GMV</th>
                  <th>GMV目标达成率</th>
                  <th>{colLabel("环比", "全量GMV")}</th>
                  <th>{colLabel("同比", "全量GMV")}</th>
                  <th>实际TM费比</th>
                  <th>实际促销费比</th>
                  <th>目标促销费比</th>
                  <th>促销费</th>
                  <th>{colLabel("环比", "促销费比")}</th>
                  <th>{colLabel("同比", "促销费比")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{periodMonthText(period)}</td>
                  <td>{formatPercent(current.timeProgress)}</td>
                  <td>{formatMoney(current.gmv)}</td>
                  <td>{formatPercent(current.targetAchievement)}</td>
                  <td className={trendTone(wow)}>{formatDelta(wow)}</td>
                  <td className={trendTone(yoy)}>{formatDelta(yoy)}</td>
                  <td>{formatPercent(current.actualTmFeeRatio)}</td>
                  <td>{formatPercent(current.promoFeeRatio)}</td>
                  <td>{formatPercent(current.targetPromoFeeRatio)}</td>
                  <td>{formatMoney(current.subsidy)}</td>
                  <td className={trendTone(promoWow, true)}>{formatPointDelta(promoWow)}</td>
                  <td className={trendTone(promoYoy, true)}>{formatPointDelta(promoYoy)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="table-section">
        <Panel title="区域周报" kicker="MTD 与 WTD 字段、顺序按 Excel 对齐；点击区域可下钻">
          <div className="table-scroll">
            <table className="metric-table region-weekly-table">
              <thead>
                <tr>
                  <th rowSpan={2}>区域</th>
                  <th colSpan={5}>MTD（{periodLabel(period).replace("WTD ", "")}）</th>
                  <th colSpan={7}>WTD（{periodLabel(period).replace("WTD ", "")}）</th>
                </tr>
                <tr>
                  <th>全量GMV</th>
                  <th>{colLabel("目标GMV", "达成率")}</th>
                  <th>{colLabel("促销预算", "使用率")}</th>
                  <th>{colLabel("促销预算", "剩余金额")}</th>
                  <th>促销费比</th>
                  <th>全量GMV</th>
                  <th>{colLabel("环比", "全量GMV")}</th>
                  <th>{colLabel("同比", "全量GMV")}</th>
                  <th>活动GMV</th>
                  <th>活动GMV占比</th>
                  <th>促销费比</th>
                  <th>活动折扣率</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map(({ node, current: row, previous: rowPrev, lastYear: rowLastYear }) => {
                  const rowWow = comparisonEnabled ? compareAggregate(row, rowPrev) : null;
                  const rowYoy = comparisonEnabled ? compareAggregate(row, rowLastYear) : null;
                  const clickable = node !== "总计";
                  return (
                    <tr
                      className={clickable ? "clickable-row" : "total-row"}
                      key={node}
                      onClick={() => clickable && setRegion(node)}
                    >
                      <th>{node}</th>
                      <td>{formatMoney(row.gmv)}</td>
                      <td>{formatPercent(row.targetAchievement)}</td>
                      <td>{formatPercent(row.promoBudgetUsage)}</td>
                      <td>{formatMoney(row.promoBudgetRemaining)}</td>
                      <td>{formatPercent(row.promoFeeRatio)}</td>
                      <td>{formatMoney(row.gmv)}</td>
                      <td className={trendTone(rowWow)}>{formatDelta(rowWow)}</td>
                      <td className={trendTone(rowYoy)}>{formatDelta(rowYoy)}</td>
                      <td>{formatMoney(row.activityGmv)}</td>
                      <td>{formatPercent(row.activityShare)}</td>
                      <td>{formatPercent(row.promoFeeRatio)}</td>
                      <td>{formatPercent(row.activityDiscount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="detail-grid">
        <Panel title="嘉士伯渠道" kicker={`WTD（${periodLabel(period).replace("WTD ", "")}）`}>
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>嘉士伯渠道</th>
                  <th>全量GMV</th>
                  <th>{colLabel("全量GMV", "占比")}</th>
                  <th>{colLabel("环比", "全量GMV")}</th>
                  <th>{colLabel("同比", "全量GMV")}</th>
                  <th>活动GMV</th>
                  <th>活动GMV占比</th>
                  <th>促销费用</th>
                  <th>{colLabel("环比", "促销费比")}</th>
                  <th>{colLabel("同比", "促销费比")}</th>
                  <th>促销费比</th>
                  <th>活动折扣率</th>
                </tr>
              </thead>
              <tbody>
                {channels.slice(0, 12).map((row) => {
                  const prev = findNamed(previousChannels, row.name);
                  const last = findNamed(lastYearChannels, row.name);
                  return (
                    <tr key={row.name}>
                      <th>{row.name}</th>
                      <td>{formatMoney(row.gmv)}</td>
                      <td>{formatPercent(safeRatio(row.gmv, current.gmv))}</td>
                      <td className={trendTone(compareAggregate(row, prev ?? aggregateRows([])))}>{formatDelta(prev ? compareAggregate(row, prev) : null)}</td>
                      <td className={trendTone(compareAggregate(row, last ?? aggregateRows([])))}>{formatDelta(last ? compareAggregate(row, last) : null)}</td>
                      <td>{formatMoney(row.activityGmv)}</td>
                      <td>{formatPercent(row.activityShare)}</td>
                      <td>{formatMoney(row.subsidy)}</td>
                      <td className={trendTone(prev ? promoRatioChange(row, prev) : null, true)}>{formatPointDelta(prev ? promoRatioChange(row, prev) : null)}</td>
                      <td className={trendTone(last ? promoRatioChange(row, last) : null, true)}>{formatPointDelta(last ? promoRatioChange(row, last) : null)}</td>
                      <td>{formatPercent(row.promoFeeRatio)}</td>
                      <td>{formatPercent(row.activityDiscount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="detail-grid">
        <Panel title="品牌" kicker={`GMV表现（${periodLabel(period).replace("WTD ", "")}）`}>
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>全量GMV</th>
                  <th>费比</th>
                  <th>{colLabel("环比", "全量GMV")}</th>
                  <th>{colLabel("同比", "全量GMV")}</th>
                  <th>{colLabel("全量GMV", "占比")}</th>
                  <th>活动GMV</th>
                  <th>活动GMV占比</th>
                  <th>活动折扣率</th>
                </tr>
              </thead>
              <tbody>
                {brands.slice(0, 14).map((row) => {
                  const prev = findNamed(previousBrands, row.name);
                  const last = findNamed(lastYearBrands, row.name);
                  return (
                    <tr key={row.name}>
                      <th>{row.name}</th>
                      <td>{formatMoney(row.gmv)}</td>
                      <td>{formatPercent(row.promoFeeRatio)}</td>
                      <td className={trendTone(prev ? compareAggregate(row, prev) : null)}>{formatDelta(prev ? compareAggregate(row, prev) : null)}</td>
                      <td className={trendTone(last ? compareAggregate(row, last) : null)}>{formatDelta(last ? compareAggregate(row, last) : null)}</td>
                      <td>{formatPercent(safeRatio(row.gmv, current.gmv))}</td>
                      <td>{formatMoney(row.activityGmv)}</td>
                      <td>{formatPercent(row.activityShare)}</td>
                      <td>{formatPercent(row.activityDiscount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="detail-grid">
        <Panel title="活动名称" kicker={`WTD（${periodLabel(period).replace("WTD ", "")}）`}>
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>活动名称</th>
                  <th>核销金额</th>
                  <th>活动GMV</th>
                  <th>促销费比</th>
                  <th>活动ROI</th>
                  <th>核券量</th>
                </tr>
              </thead>
              <tbody>
                {activities.slice(0, 15).map((row) => (
                  <tr key={row.activityName}>
                    <th>{row.activityName}</th>
                    <td>{formatMoney(row.redemptionAmount)}</td>
                    <td>{formatMoney(row.activityGmv)}</td>
                    <td>{formatPercent(row.promoFeeRatio)}</td>
                    <td>{formatRoi(row.activityRoi)}</td>
                    <td>{formatCount(row.couponCount, "张")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className="source-band">
        <details>
          <summary>数据来源与校验口径</summary>
          <div className="source-content">
            <p>
              字段展示按 Excel 原表结构对齐。全量GMV取全量明细，活动GMV与促销费取账单明细，目标和预算取
              <code>目标GMV.xlsx</code> 与 <code>分BU预算金额.xlsx</code>。区域按 <code>清洗_大区</code> 匹配。
            </p>
            <div className="recon-grid">
              {data.reconciliation.map((item) => (
                <span key={`${item.platformId}-${item.periodId}`}>
                  {item.platformLabel as string} {item.periodId as string}: 差异 {formatMoney(Number(item.gmvDiff))}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}
