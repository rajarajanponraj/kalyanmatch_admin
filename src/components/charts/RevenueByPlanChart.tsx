'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface RevenueByPlanChartProps {
  data: { plan: string; revenue: number }[]
}

const COLORS = ['#71717a', '#a78bfa', '#f59e0b', '#10b981']

export default function RevenueByPlanChart({ data }: RevenueByPlanChartProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
      <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
        Revenue by Plan
      </h4>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-zinc-400">No payment data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="plan"
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <Tooltip
              formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
              contentStyle={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                borderRadius: '12px',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]} maxBarSize={60}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
