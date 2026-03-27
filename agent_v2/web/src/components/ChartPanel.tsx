import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import type { ChartSpec } from '../types/api';

interface ChartPanelProps {
  charts: ChartSpec[];
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export function ChartPanel({ charts }: ChartPanelProps) {
  return (
    <div className="space-y-3">
      {charts.map((chart, i) => (
        <div key={i} className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
          <h4 className="text-xs font-medium text-gray-400 mb-2">{chart.title}</h4>
          {chart.type === 'pie' && <PieChartView data={chart.data as Record<string, number>} />}
          {chart.type === 'bar' && <BarChartView data={chart.data as Record<string, number>} />}
        </div>
      ))}
    </div>
  );
}

function PieChartView({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          dataKey="value"
          label={(props: PieLabelRenderProps) =>
            `${String(props.name ?? '')} ${(((props.percent ?? 0) as number) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name: truncLabel(name, 15), value, fullName: name }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} width={50} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function truncLabel(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '..' : s;
}
