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
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatPointDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}pct`;
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

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad" | "neutral" | "warn";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
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

function collectBreakdown(
  rows: BreakdownRow[],
  key: "channel" | "brand",
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
}: {
  current: Aggregate;
  previous: Aggregate;
  lastYear: Aggregate;
  regionLabel: string;
  regionDrivers: Array<{ node: string; current: Aggregate; previous: Aggregate }>;
  channels: Array<{ name: string } & Aggregate>;
  brands: Array<{ name: string } & Aggregate>;
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
  const highFeeChannel = channels
    .filter((item) => item.gmv > current.gmv * 0.03 && item.promoFeeRatio !== null)
    .sort((a, b) => (b.promoFeeRatio ?? 0) - (a.promoFeeRatio ?? 0))[0];

  const conclusions = [
    `${regionLabel}本周全量GMV ${formatMoney(current.gmv)}，环比${formatDelta(wow)}，同比${formatDelta(yoy)}。`,
    `GMV目标达成率 ${formatPercent(current.targetAchievement)}，当月时间进度 ${formatPercent(current.timeProgress)}，当前节奏${targetGap >= 0 ? "领先" : "落后"} ${formatPointDelta(Math.abs(targetGap))}。`,
    `实际促销费比 ${formatPercent(current.promoFeeRatio)}，促销预算使用率 ${formatPercent(current.promoBudgetUsage)}，预算消耗${budgetPressure > 0 ? "快于" : "慢于"}时间进度 ${formatPointDelta(Math.abs(budgetPressure))}。`,
  ];

  const analysis = [
    topDriver
      ? `${topDriver.node}是本周主要增量来源，较上周增加 ${formatMoney(topDriver.inc)}，需要优先复盘该区域渠道和活动组合。`
      : `本周区域增量来源不集中，需要继续观察各区域拆分表现。`,
    topChannel && topBrand
      ? `渠道侧以${topChannel.name}贡献最高，全量GMV ${formatMoney(topChannel.gmv)}；品牌侧以${topBrand.name}贡献最高，全量GMV ${formatMoney(topBrand.gmv)}。`
      : `渠道和品牌结构数据不足以形成明确主贡献判断。`,
    highFeeChannel
      ? `${highFeeChannel.name}促销费比达到 ${formatPercent(highFeeChannel.promoFeeRatio)}，若继续放量，需要同步检查ROI和活动折扣率。`
      : `当前高费比渠道没有明显异常，促销效率风险主要来自预算节奏。`,
  ];

  const actions = [
    targetGap < 0
      ? `补 GMV：优先加码${topChannel?.name ?? "高GMV渠道"}与${topBrand?.name ?? "核心品牌"}，目标是把GMV目标达成率追平时间进度。`
      : `稳 GMV：保留当前高贡献渠道资源，避免因过早收缩活动导致下周基盘回落。`,
    budgetPressure > 0
      ? `控费比：对${highFeeChannel?.name ?? "高费比渠道"}设置费用上限或改低门槛券，优先保留活动ROI高的活动。`
      : `扩效率：预算节奏仍有空间，可以把新增预算投向GMV占比高且促销费比低的渠道。`,
    topDriver
      ? `区域动作：沉淀${topDriver.node}的有效活动和商户组合，复制到同 BU 内低增长区域。`
      : `区域动作：建立区域周度复盘清单，逐区跟踪全量GMV、促销费比、活动GMV占比三项指标。`,
  ];

  return { conclusions, analysis, actions };
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
      }),
    [current, previous, lastYear, region, regionRows, channels, brands],
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

      <section className="kpi-grid">
        <KpiCard
          label="全量GMV"
          value={formatMoney(current.gmv)}
          sub={`环比全量GMV ${formatDelta(wow)} / 同比全量GMV ${formatDelta(yoy)}`}
          tone={trendTone(wow) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="GMV目标达成率"
          value={formatPercent(current.targetAchievement)}
          sub={`当月时间进度 ${formatPercent(current.timeProgress)} / 进度校正 ${formatPercent(current.paceAchievement)}`}
          tone={trendTone((current.targetAchievement ?? 0) - (current.timeProgress ?? 0)) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="实际促销费比"
          value={formatPercent(current.promoFeeRatio)}
          sub={`环比促销费比 ${formatPointDelta(promoWow)} / 同比促销费比 ${formatPointDelta(promoYoy)}`}
          tone={trendTone(promoWow, true) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="促销费"
          value={formatMoney(current.subsidy)}
          sub={`促销预算使用率 ${formatPercent(current.promoBudgetUsage)} / 剩余 ${formatMoney(current.promoBudgetRemaining)}`}
          tone={trendTone((current.promoBudgetUsage ?? 0) - (current.timeProgress ?? 0), true) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="活动GMV占比"
          value={formatPercent(current.activityShare)}
          sub={`活动GMV ${formatMoney(current.activityGmv)} / 活动折扣率 ${formatPercent(current.activityDiscount)}`}
          tone="warn"
        />
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
                    <td>{row.activityRoi ? row.activityRoi.toFixed(1) : "-"}</td>
                    <td>{formatNumber(row.couponCount)}</td>
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
