'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface UserGrowthChartProps {
  data: { month: string; users: number }[]
}

export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
      <h4 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
        User Growth (Last 6 Months)
      </h4>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-zinc-400">No user data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              axisLine={{ stroke: 'var(--color-border)' }}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(value: any) => [Number(value), 'Users']}
              contentStyle={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                borderRadius: '12px',
                fontSize: '13px',
              }}
            />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#e11d48"
              strokeWidth={3}
              dot={{ r: 5, fill: '#e11d48', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
