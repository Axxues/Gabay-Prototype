import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { ChartSpec } from '../../types/chart';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon } from 'lucide-react';

const PALETTE = [
  '#059669', // Emerald
  '#4f46e5', // Indigo
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0284c7', // Sky
  '#7c3aed', // Violet
  '#0d9488', // Teal
  '#ea580c', // Orange
];

interface InteractiveChartProps {
  spec: ChartSpec;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <p className="text-xs font-medium text-slate-500">{label || item.name}</p>
        <p className="text-sm font-bold text-slate-900">
          {item.name ? `${item.name}: ` : ''}
          <span className="text-emerald-600">{Number(item.value).toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const InteractiveChart: React.FC<InteractiveChartProps> = ({ spec }) => {
  if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
        No chart data available to display.
      </div>
    );
  }

  const type = (spec.type || 'bar').toLowerCase();

  const formattedData = spec.data.map((d, index) => ({
    ...d,
    fill: d.color || PALETTE[index % PALETTE.length],
  }));

  const renderIcon = () => {
    switch (type) {
      case 'pie':
        return <PieIcon className="h-4 w-4 text-emerald-600" />;
      case 'line':
        return <LineIcon className="h-4 w-4 text-indigo-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-4 shadow-sm transition-all hover:shadow-md">
      {spec.title && (
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-1.5 ring-1 ring-emerald-200/60">
              {renderIcon()}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{spec.title}</h4>
              {spec.description && (
                <p className="text-xs text-slate-500">{spec.description}</p>
              )}
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
            {type} chart
          </span>
        </div>
      )}

      <div className="h-64 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs font-medium text-slate-700">{value}</span>
                )}
              />
              <Pie
                data={formattedData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={36}
                paddingAngle={3}
                animationDuration={600}
              >
                {formattedData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={formattedData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ fill: '#4f46e5', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#059669' }}
                animationDuration={600}
              />
            </LineChart>
          ) : (
            <BarChart data={formattedData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                maxBarSize={55}
                animationDuration={600}
              >
                {formattedData.map((entry, idx) => (
                  <Cell key={`bar-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
