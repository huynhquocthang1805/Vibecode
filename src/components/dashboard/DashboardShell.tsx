'use client';

// Owner: frontend-dashboard (Trường) — FD-01. Chỉ bố cục; nội dung do app/DashboardPage truyền vào qua slot.
import * as React from 'react';

export interface DashboardShellProps {
  controls: React.ReactNode; // chiến dịch, khoảng ngày, grain, live
  kpis: React.ReactNode;
  chart: React.ReactNode;
  forecast: React.ReactNode;
  insight: React.ReactNode;
  anomalies: React.ReactNode;
  data: React.ReactNode; // tabs nhập / bảng / import / dữ liệu
}

export function DashboardShell({ controls, kpis, chart, forecast, insight, anomalies, data }: DashboardShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">KPI Mini</h1>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">{controls}</div>
      </header>
      <section aria-label="Chỉ số tổng quan">{kpis}</section>
      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-label="Biểu đồ" className="lg:col-span-2">
          {chart}
        </section>
        <section aria-label="Dự báo">{forecast}</section>
        <section aria-label="Nhận xét AI" className="lg:col-span-2">
          {insight}
        </section>
        <section aria-label="Cảnh báo bất thường">{anomalies}</section>
      </div>
      <section aria-label="Dữ liệu">{data}</section>
    </div>
  );
}
