import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { getDashboardStats } from '../services/api';
import type { DashboardStats } from '../types/api';

const COLORS = ['#1e6bb8', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 12, padding: '10px 14px' }, labelStyle: { color: '#0f172a', fontWeight: 600 as const } };

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function StatsPage() {
  const nav = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getDashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return (
    <div className="flex-1 overflow-y-auto"><div className="max-w-[1080px] mx-auto px-6 py-8">
      <div className="skeleton w-40 h-6 mb-6 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-[72px] rounded-lg" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[280px] rounded-lg" />)}</div>
    </div></div>
  );

  if (!stats) return <div className="flex-1 flex items-center justify-center text-[var(--gray-400)]">Failed to load statistics</div>;

  const cards = [
    { l: 'Samples', v: stats.total_samples }, { l: 'Projects', v: stats.total_projects },
    { l: 'Series', v: stats.total_series }, { l: 'Cell Types', v: stats.total_celltypes },
    { l: 'Cross-Links', v: stats.total_cross_links },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-6 py-8">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--gray-900)] mb-6">Database Statistics</h1>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {cards.map(({ l, v }) => (
            <div key={l} className="card px-4 py-3 text-center">
              <div className="text-[20px] font-bold text-[var(--gray-900)] tabular-nums leading-none mb-0.5">{fmt(v)}</div>
              <div className="text-[11px] text-[var(--gray-400)]">{l}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Samples by Database">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.by_source} layout="vertical" margin={{ left: 70 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} width={65} axisLine={false} tickLine={false} />
                <Tooltip {...TT} /><Bar dataKey="samples" fill="#1e6bb8" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => nav(`/explore?source_database=${d.name}`)} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Top 20 Tissues">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.by_tissue.slice(0, 20)} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="value" tick={{ fill: '#475569', fontSize: 11 }} width={85} axisLine={false} tickLine={false} />
                <Tooltip {...TT} /><Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => nav(`/explore?tissue=${d.value}`)} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Top 20 Diseases">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.by_disease.slice(0, 20)} layout="vertical" margin={{ left: 110 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="value" tick={{ fill: '#475569', fontSize: 11 }} width={105} axisLine={false} tickLine={false} />
                <Tooltip {...TT} /><Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => nav(`/explore?disease=${d.value}`)} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Assay Distribution">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.by_assay.slice(0, 10)} dataKey="count" nameKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={35}
                  label={({ value: v, name }) => `${name}: ${fmt(v)}`} labelLine={false} strokeWidth={0}>
                  {stats.by_assay.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          {stats.submissions_by_year.length > 0 && (
            <Card title="Submissions by Year">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.submissions_by_year} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} />
                  <Tooltip {...TT} /><Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card title="Data Availability">
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'H5AD Files', v: stats.h5ad_available, t: stats.total_series, bg: 'bg-violet-50', c: 'text-violet-700' },
                { l: 'RDS Files', v: stats.rds_available, t: stats.total_series, bg: 'bg-emerald-50', c: 'text-emerald-700' },
                { l: 'With PMID', v: stats.with_pmid, t: stats.total_projects, bg: 'bg-blue-50', c: 'text-blue-700' },
                { l: 'With DOI', v: stats.with_doi, t: stats.total_projects, bg: 'bg-amber-50', c: 'text-amber-700' },
              ].map(({ l, v, t, bg, c }) => (
                <div key={l} className={`${bg} rounded-lg p-4 text-center`}>
                  <div className={`text-[18px] font-bold ${c} tabular-nums`}>{fmt(v)}</div>
                  <div className="text-[12px] text-[var(--gray-500)]">{l}</div>
                  <div className="text-[10px] text-[var(--gray-400)] mt-0.5">{t > 0 ? ((v / t) * 100).toFixed(1) : 0}% of {fmt(t)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-5"><h3 className="text-[13px] font-semibold text-[var(--gray-700)] mb-4">{title}</h3>{children}</div>;
}
