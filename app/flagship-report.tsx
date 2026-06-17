"use client";

import { useEffect, useState } from "react";

declare const __DATA_CACHE_VERSION__: string | undefined;

type Summary = {
  gmv?: number | null;
  quantity?: number | null;
  orders?: number | null;
  users?: number | null;
  activityGmv?: number | null;
  subsidy?: number | null;
  couponCount?: number | null;
  naturalGmv?: number | null;
  activityShare?: number | null;
  promoFeeRatio?: number | null;
  activityRoi?: number | null;
};

type Breakdown = Summary & {
  platform?: string;
  region?: string;
  channel?: string;
  merchant?: string;
  brand?: string;
  product?: string;
  activityName?: string;
};

type FlagshipData = {
  metadata: {
    title: string;
    generatedAt: string;
    definition: string;
    period: {
      id: string;
      label: string;
      start: string;
      end: string;
    };
    channelOrder: string[];
    detailFiles: {
      full: string;
      bill: string;
    };
    sourceStats: Array<{
      platformLabel: string;
      fullRows: number;
      billRows: number;
      fullGmv: number;
      billActivityGmv: number;
      billSubsidy: number;
    }>;
  };
  summary: Summary;
  breakdowns: {
    platforms: Breakdown[];
    regions: Breakdown[];
    channels: Breakdown[];
    merchants: Breakdown[];
    brands: Breakdown[];
    activities: Breakdown[];
    products: Breakdown[];
  };
};

const DATA_CACHE_VERSION =
  typeof __DATA_CACHE_VERSION__ === "string" ? __DATA_CACHE_VERSION__ : "local";
const DATA_FILE = "flagship-data.json";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
  return response.json() as Promise<T>;
}

function publicDataUrl(file: string): string {
  const cleanFile = file.replace(/^\/+/, "");
  const withVersion = (url: string) => {
    const dataUrl = new URL(url, window.location.href);
    dataUrl.searchParams.set("v", DATA_CACHE_VERSION);
    return `${dataUrl.pathname}${dataUrl.search}${dataUrl.hash}`;
  };
  const script = document.querySelector<HTMLScriptElement>('script[src*="/assets/"]');
  const assetPath = script ? new URL(script.src, window.location.href).pathname : "";
  const marker = "/assets/";
  const assetIndex = assetPath.indexOf(marker);
  if (assetIndex >= 0) return withVersion(`${assetPath.slice(0, assetIndex + 1)}data/${cleanFile}`);

  const { pathname } = window.location;
  const currentBase = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withVersion(`${currentBase}../data/${cleanFile}`);
}

function isRealNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMoney(value: number | null | undefined): string {
  if (!isRealNumber(value)) return "";
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function formatNumber(value: number | null | undefined): string {
  if (!isRealNumber(value)) return "";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined): string {
  if (!isRealNumber(value)) return "";
  return `${(value * 100).toFixed(1)}%`;
}

function formatRoi(value: number | null | undefined): string {
  if (!isRealNumber(value)) return "";
  return `${value.toFixed(1)}x`;
}

function generatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Panel({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <p>{subtitle ?? "淘宝闪购 · 官旗四渠道 · 6月1-14日"}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <article className="core-metric-card merged neutral">
      <div className="core-metric-topline">
        <div className="core-metric-label">{label}</div>
      </div>
      <div className="core-metric-value">{value}</div>
      <div className="core-metric-sub">{sub ?? ""}</div>
    </article>
  );
}

function tableRows(rows: Breakdown[], key: keyof Breakdown, limit = 10) {
  return rows
    .filter((row) => String(row[key] ?? "").trim())
    .slice(0, limit);
}

function SummaryTable({ rows, nameKey }: { rows: Breakdown[]; nameKey: keyof Breakdown }) {
  return (
    <div className="table-scroll">
      <table className="metric-table compact">
        <thead>
          <tr>
            <th>{nameKey === "activityName" ? "活动" : "名称"}</th>
            <th>全量GMV</th>
            <th>活动GMV</th>
            <th>活动GMV占比</th>
            <th>促销费</th>
            <th>促销费比</th>
            <th>ROI</th>
            <th>订单/核券量</th>
          </tr>
        </thead>
        <tbody>
          {tableRows(rows, nameKey).map((row) => (
            <tr key={`${nameKey}-${String(row[nameKey])}`}>
              <td>{String(row[nameKey] ?? "")}</td>
              <td>{formatMoney(row.gmv)}</td>
              <td>{formatMoney(row.activityGmv)}</td>
              <td>{formatPercent(row.activityShare)}</td>
              <td>{formatMoney(row.subsidy)}</td>
              <td>{formatPercent(row.promoFeeRatio)}</td>
              <td>{formatRoi(row.activityRoi)}</td>
              <td>{formatNumber(nameKey === "activityName" ? row.couponCount : row.orders)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildNotes(data: FlagshipData): string[] {
  const topChannel = data.breakdowns.channels[0];
  const topActivity = data.breakdowns.activities[0];
  return [
    topChannel
      ? `1. ${topChannel.channel}贡献最高，GMV ${formatMoney(topChannel.gmv)}，活动GMV ${formatMoney(topChannel.activityGmv)}。`
      : "",
    topActivity
      ? `2. TOP活动为${topActivity.activityName}，活动GMV ${formatMoney(topActivity.activityGmv)}。`
      : "",
  ].filter(Boolean);
}

function DetailLinks({ data }: { data: FlagshipData }) {
  const fullUrl = publicDataUrl(data.metadata.detailFiles.full);
  const billUrl = publicDataUrl(data.metadata.detailFiles.bill);
  return (
    <div className="download-links">
      <a href={fullUrl} download>
        下载全量明细 CSV
      </a>
      <a href={billUrl} download>
        下载账单明细 CSV
      </a>
    </div>
  );
}

export default function FlagshipReport() {
  const [data, setData] = useState<FlagshipData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<FlagshipData>(publicDataUrl(DATA_FILE))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "数据加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <main className="dashboard-shell">
        <section className="loading-state">
          <h1>嘉士伯官旗即时零售周报</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="dashboard-shell">
        <section className="loading-state">
          <h1>嘉士伯官旗即时零售周报</h1>
          <p>正在加载数据...</p>
        </section>
      </main>
    );
  }

  const notes = buildNotes(data);
  const generated = generatedLabel(data.metadata.generatedAt);

  return (
    <main className="dashboard-shell flagship-report">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Carlsberg flagship weekly BI</p>
          <h1>嘉士伯官旗即时零售周报</h1>
          <p className="header-subtitle">淘宝闪购｜{data.metadata.period.label}</p>
          <div className="header-meta">
            <span>酒小二 / 惠宜选 / 永辉 / 西菲狸</span>
            <span>6月1-14日</span>
            <span>数据生成 {generated}</span>
          </div>
        </div>
      </header>

      <section className="view-context">{data.metadata.definition}</section>

      <section className="core-matrix">
        <div className="metric-scope-block merged">
          <div className="metric-scope-title">官旗经营总览</div>
          <div className="core-metric-grid">
            <MetricCard label="全量GMV" value={formatMoney(data.summary.gmv)} sub="目标达成率 " />
            <MetricCard label="活动GMV" value={formatMoney(data.summary.activityGmv)} sub={`占比 ${formatPercent(data.summary.activityShare)}`} />
            <MetricCard label="自然GMV" value={formatMoney(data.summary.naturalGmv)} sub="全量GMV - 活动GMV" />
            <MetricCard label="促销费" value={formatMoney(data.summary.subsidy)} sub={`费比 ${formatPercent(data.summary.promoFeeRatio)}`} />
            <MetricCard label="活动ROI" value={formatRoi(data.summary.activityRoi)} sub={`核券量 ${formatNumber(data.summary.couponCount)}`} />
          </div>
        </div>
      </section>

      <section className="overview-grid">
        <Panel title="生意小结">
          <ul className="table-notes-list">
            {notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="重点关注">
          <p className="empty-note">目标、预算和环同比数据暂未接入官旗口径，先保留为空白。</p>
        </Panel>
        <Panel title="行动建议">
          <p className="empty-note">先用官旗全量明细与账单明细核对商户、商品和活动口径，再补充目标和预算。</p>
        </Panel>
      </section>

      <section className="table-section">
        <Panel title="月度总览">
          <div className="table-scroll">
            <table className="metric-table compact">
              <thead>
                <tr>
                  <th>周期</th>
                  <th>全量GMV</th>
                  <th>活动GMV</th>
                  <th>自然GMV</th>
                  <th>活动GMV占比</th>
                  <th>促销费</th>
                  <th>促销费比</th>
                  <th>活动ROI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{data.metadata.period.label}</td>
                  <td>{formatMoney(data.summary.gmv)}</td>
                  <td>{formatMoney(data.summary.activityGmv)}</td>
                  <td>{formatMoney(data.summary.naturalGmv)}</td>
                  <td>{formatPercent(data.summary.activityShare)}</td>
                  <td>{formatMoney(data.summary.subsidy)}</td>
                  <td>{formatPercent(data.summary.promoFeeRatio)}</td>
                  <td>{formatRoi(data.summary.activityRoi)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="区域表">
          <SummaryTable rows={data.breakdowns.regions} nameKey="region" />
        </Panel>

        <Panel title="渠道表">
          <SummaryTable rows={data.breakdowns.channels} nameKey="channel" />
        </Panel>

        <Panel title="品牌表">
          <SummaryTable rows={data.breakdowns.brands} nameKey="brand" />
        </Panel>

        <Panel title="TOP10活动表">
          <SummaryTable rows={data.breakdowns.activities} nameKey="activityName" />
        </Panel>

        <Panel title="官旗数据明细">
          <DetailLinks data={data} />
        </Panel>
      </section>
    </main>
  );
}
