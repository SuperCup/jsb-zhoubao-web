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

type Aggregate = {
  gmv: number;
  quantity: number;
  orders: number;
  users: number;
  activityGmv: number;
  subsidy: number;
  budget: number;
  target: number;
  targetGmv: number;
  timeProgress: number | null;
  activityShare: number | null;
  promoFeeRatio: number | null;
  activityDiscount: number | null;
  budgetUsage: number | null;
  targetAchievement: number | null;
  paceAchievement: number | null;
  budgetRemaining: number | null;
};

const data = dashboardData as {
  metadata: {
    title: string;
    generatedAt: string;
    sourceRoot: string;
    currentPeriodId: string;
    previousPeriodId: string;
    lastYearPeriodId: string;
    periods: Array<{
      id: string;
      label: string;
      shortLabel: string;
      kind: string;
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
  };
  reconciliation: Array<Record<string, string | number>>;
};

const PLATFORM_ALL = "all";
const REGION_ALL = "all";
const GROUP_ORDER = ["CBC", "CIB", "NX", "XJ", "YN", "华中", "未识别"];

function safeRatio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

function aggregateRows(rows: MetricRow[]): Aggregate {
  const total = rows.reduce(
    (acc, row) => {
      acc.gmv += row.gmv || 0;
      acc.quantity += row.quantity || 0;
      acc.orders += row.orders || 0;
      acc.users += row.users || 0;
      acc.activityGmv += row.activityGmv || 0;
      acc.subsidy += row.subsidy || 0;
      acc.budget += row.budget || 0;
      acc.target += row.buTarget || 0;
      acc.targetGmv += row.targetGmv || 0;
      if (row.timeProgress && !acc.timeProgress) {
        acc.timeProgress = row.timeProgress;
      }
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
      targetGmv: 0,
      timeProgress: null as number | null,
    },
  );

  const targetAchievement = safeRatio(total.gmv, total.target);
  return {
    ...total,
    activityShare: safeRatio(total.activityGmv, total.gmv),
    promoFeeRatio: safeRatio(total.subsidy, total.gmv),
    activityDiscount:
      total.activityGmv > 0 ? 1 - total.subsidy / total.activityGmv : null,
    budgetUsage: safeRatio(total.subsidy, total.budget),
    targetAchievement,
    paceAchievement:
      targetAchievement !== null && total.timeProgress
        ? targetAchievement / total.timeProgress
        : null,
    budgetRemaining: total.budget ? total.budget - total.subsidy : null,
  };
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

function leavesFor(region: string): string[] {
  if (region === REGION_ALL) return data.metadata.regionOrder;
  return data.metadata.regionGroups[region] ?? [region];
}

function platformIds(platform: string): string[] {
  if (platform === PLATFORM_ALL) return data.metadata.platforms.map((item) => item.id);
  return [platform];
}

function periodLabel(periodId: string): string {
  return data.metadata.periods.find((period) => period.id === periodId)?.label ?? periodId;
}

function selectedRegionLabel(region: string): string {
  return region === REGION_ALL ? "全国/全区域" : region;
}

function buildAggregate(
  periodId: string,
  platform: string,
  region: string,
): Aggregate {
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

function barPercent(value: number, max: number): string {
  if (!max) return "0%";
  return `${Math.max(2, Math.min(100, (value / max) * 100))}%`;
}

function KpiCard({
  label,
  value,
  sub,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  meta?: string;
  tone?: "good" | "bad" | "neutral" | "warn";
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
      {meta ? <div className="kpi-meta">{meta}</div> : null}
    </article>
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

function Panel({
  title,
  kicker,
  children,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "panel wide" : "panel"}>
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

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className={`metric-pill ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function BarList({
  rows,
  nameKey,
  valueKey = "gmv",
  maxRows = 8,
}: {
  rows: Array<Record<string, string | number | null | undefined>>;
  nameKey: string;
  valueKey?: string;
  maxRows?: number;
}) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(...visible.map((row) => Number(row[valueKey]) || 0), 0);
  if (!visible.length) {
    return <div className="empty-state">当前筛选下暂无明细</div>;
  }
  return (
    <div className="bar-list">
      {visible.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <div className="bar-row" key={`${row[nameKey]}-${value}`}>
            <div className="bar-row-top">
              <span>{String(row[nameKey] ?? "未识别")}</span>
              <strong>{formatMoney(value)}</strong>
            </div>
            <div className="bar-track">
              <span style={{ width: barPercent(value, max) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [platform, setPlatform] = useState(PLATFORM_ALL);
  const [period, setPeriod] = useState(data.metadata.currentPeriodId);
  const [region, setRegion] = useState(REGION_ALL);

  const current = useMemo(
    () => buildAggregate(period, platform, region),
    [period, platform, region],
  );
  const previous = useMemo(
    () => buildAggregate(data.metadata.previousPeriodId, platform, region),
    [platform, region],
  );
  const lastYear = useMemo(
    () => buildAggregate(data.metadata.lastYearPeriodId, platform, region),
    [platform, region],
  );

  const selectedLeaves = useMemo(() => new Set(leavesFor(region)), [region]);
  const selectedPlatforms = useMemo(() => new Set(platformIds(platform)), [platform]);

  const wow = period === data.metadata.currentPeriodId ? safeRatio(current.gmv - previous.gmv, previous.gmv) : null;
  const yoy = period === data.metadata.currentPeriodId ? safeRatio(current.gmv - lastYear.gmv, lastYear.gmv) : null;
  const feeDelta =
    period === data.metadata.currentPeriodId &&
    current.promoFeeRatio !== null &&
    previous.promoFeeRatio !== null
      ? current.promoFeeRatio - previous.promoFeeRatio
      : null;

  const regionNodes = useMemo(() => {
    if (region === REGION_ALL) return GROUP_ORDER;
    const children = data.metadata.regionGroups[region];
    if (children && children.length > 1) return children;
    const parent = data.metadata.regionParent[region];
    return data.metadata.regionOrder.filter((item) => data.metadata.regionParent[item] === parent);
  }, [region]);

  const regionRows = useMemo(() => {
    return regionNodes
      .map((node) => ({
        node,
        rows: data.records.filter(
          (row) =>
            row.periodId === period &&
            selectedPlatforms.has(row.platformId) &&
            leavesFor(node).includes(row.region),
        ),
      }))
      .map(({ node, rows }) => ({ node, aggregate: aggregateRows(rows) }))
      .sort((a, b) => b.aggregate.gmv - a.aggregate.gmv);
  }, [period, regionNodes, selectedPlatforms]);

  const platformMix = useMemo(() => {
    const platformRows = platform === PLATFORM_ALL ? data.metadata.platforms : data.metadata.platforms.filter((item) => item.id === platform);
    return platformRows.map((item) => ({
      name: item.label,
      aggregate: buildAggregate(period, item.id, region),
    }));
  }, [period, platform, region]);

  const breakdown = useMemo(() => {
    const collect = (rows: BreakdownRow[], key: "channel" | "brand" | "merchant" | "product") => {
      const grouped = new Map<string, MetricRow[]>();
      rows
        .filter(
          (row) =>
            row.periodId === period &&
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
        .map(([name, rowsForName]) => ({
          name,
          ...aggregateRows(rowsForName),
        }))
        .sort((a, b) => b.gmv - a.gmv);
    };
    return {
      channels: collect(data.breakdowns.channels, "channel"),
      brands: collect(data.breakdowns.brands, "brand"),
      merchants: collect(data.breakdowns.merchants, "merchant"),
      products: collect(data.breakdowns.products, "product"),
    };
  }, [period, selectedLeaves, selectedPlatforms]);

  const maxRegionGmv = Math.max(...regionRows.map((row) => row.aggregate.gmv), 0);
  const maxPlatformGmv = Math.max(...platformMix.map((row) => row.aggregate.gmv), 0);
  const generated = new Date(data.metadata.generatedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

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
          <span>当前口径</span>
          <strong>全量 GMV + 账单促销</strong>
          <small>区域、平台、周期可联动下钻</small>
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
          label="全量 GMV"
          value={formatMoney(current.gmv)}
          sub={`周环比 ${formatDelta(wow)} / 同比 ${formatDelta(yoy)}`}
          meta={`活动 GMV ${formatMoney(current.activityGmv)}`}
          tone={trendTone(wow) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="目标进度"
          value={formatPercent(current.targetAchievement)}
          sub={`进度校正 ${formatPercent(current.paceAchievement)}`}
          meta={`BU 目标 ${formatMoney(current.target)}`}
          tone={trendTone((current.paceAchievement ?? 0) - 1) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="促销费"
          value={formatMoney(current.subsidy)}
          sub={`促销费比 ${formatPercent(current.promoFeeRatio)}`}
          meta={`较上周期 ${feeDelta === null ? "-" : `${(feeDelta * 100).toFixed(1)}pct`}`}
          tone={trendTone(feeDelta, true) as "good" | "bad" | "neutral"}
        />
        <KpiCard
          label="活动覆盖"
          value={formatPercent(current.activityShare)}
          sub={`活动折扣率 ${formatPercent(current.activityDiscount)}`}
          meta={`活动订单 ${formatNumber(current.orders)}`}
          tone="warn"
        />
        <KpiCard
          label="预算消耗"
          value={formatPercent(current.budgetUsage)}
          sub={`剩余 ${formatMoney(current.budgetRemaining)}`}
          meta={`预算 ${formatMoney(current.budget)}`}
          tone={trendTone((current.budgetUsage ?? 0) - (current.timeProgress ?? 0), true) as "good" | "bad" | "neutral"}
        />
      </section>

      <section className="overview-grid">
        <Panel
          title="区域表现"
          kicker={region === REGION_ALL ? "点击 BU 进入区域下钻" : "点击区域继续切换"}
          wide
        >
          <div className="region-table">
            {regionRows.map(({ node, aggregate }) => (
              <button className="region-row" key={node} onClick={() => setRegion(node)}>
                <span className="region-name">{node}</span>
                <span className="region-bar">
                  <i style={{ width: barPercent(aggregate.gmv, maxRegionGmv) }} />
                </span>
                <strong>{formatMoney(aggregate.gmv)}</strong>
                <em className={trendTone(safeRatio(aggregate.gmv - buildAggregate(data.metadata.previousPeriodId, platform, node).gmv, buildAggregate(data.metadata.previousPeriodId, platform, node).gmv))}>
                  {formatDelta(safeRatio(aggregate.gmv - buildAggregate(data.metadata.previousPeriodId, platform, node).gmv, buildAggregate(data.metadata.previousPeriodId, platform, node).gmv))}
                </em>
              </button>
            ))}
          </div>
          {region !== REGION_ALL ? (
            <button className="text-button" onClick={() => setRegion(REGION_ALL)}>
              返回全国/全区域
            </button>
          ) : null}
        </Panel>

        <Panel title="平台结构" kicker="当前筛选下的 GMV 占比">
          <div className="platform-bars">
            {platformMix.map(({ name, aggregate }) => (
              <div className="platform-line" key={name}>
                <div className="platform-line-top">
                  <span>{name}</span>
                  <strong>{formatMoney(aggregate.gmv)}</strong>
                </div>
                <div className="bar-track">
                  <span style={{ width: barPercent(aggregate.gmv, maxPlatformGmv) }} />
                </div>
                <small>促销费比 {formatPercent(aggregate.promoFeeRatio)}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="经营信号" kicker="目标、预算、促销效率">
          <div className="signal-stack">
            <MetricPill label="时间进度" value={formatPercent(current.timeProgress)} />
            <MetricPill label="目标达成" value={formatPercent(current.targetAchievement)} tone={trendTone((current.targetAchievement ?? 0) - (current.timeProgress ?? 0))} />
            <MetricPill label="预算使用" value={formatPercent(current.budgetUsage)} tone={trendTone((current.budgetUsage ?? 0) - (current.timeProgress ?? 0), true)} />
            <MetricPill label="活动占比" value={formatPercent(current.activityShare)} />
            <MetricPill label="订单量" value={formatNumber(current.orders)} />
            <MetricPill label="销量" value={formatNumber(current.quantity)} />
          </div>
        </Panel>
      </section>

      <section className="drilldown-header">
        <div>
          <p className="eyebrow">Drilldown</p>
          <h2>{selectedRegionLabel(region)} 下钻明细</h2>
        </div>
        <div className="drilldown-summary">
          <MetricPill label="GMV" value={formatMoney(current.gmv)} />
          <MetricPill label="促销费" value={formatMoney(current.subsidy)} />
          <MetricPill label="预算剩余" value={formatMoney(current.budgetRemaining)} />
        </div>
      </section>

      <section className="drill-grid">
        <Panel title="渠道 GMV" kicker="全量表 GMV + 账单促销">
          <BarList rows={breakdown.channels} nameKey="name" maxRows={9} />
        </Panel>
        <Panel title="品牌 GMV" kicker="按清洗品牌聚合">
          <BarList rows={breakdown.brands} nameKey="name" maxRows={9} />
        </Panel>
        <Panel title="商户 Top" kicker="区域内 GMV 排名">
          <div className="rank-table">
            {breakdown.merchants.slice(0, 10).map((row, index) => (
              <div className="rank-row" key={`${row.name}-${index}`}>
                <span>{index + 1}</span>
                <strong>{row.name}</strong>
                <em>{formatMoney(row.gmv)}</em>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="商品 Top" kicker="按清洗商品名聚合">
          <div className="rank-table">
            {breakdown.products.slice(0, 10).map((row, index) => (
              <div className="rank-row" key={`${row.name}-${index}`}>
                <span>{index + 1}</span>
                <strong>{row.name}</strong>
                <em>{formatMoney(row.gmv)}</em>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="source-band">
        <details>
          <summary>数据来源与校验口径</summary>
          <div className="source-content">
            <p>
              全量 GMV 取自各平台全量数据明细；活动 GMV 与促销费取自账单数据明细；目标和预算分别取自
              目标 GMV 与分 BU 预算表。区域按 <code>清洗_大区</code> 匹配，空区域保留为 <code>未识别</code>。
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
