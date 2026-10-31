/**
 * SalesChart - Gráfica de ventas con IDENTIDAD lightcode
 * Azul eléctrico dominante, sin aspecto de librería default
 */
import { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

export default function SalesChart({ orders = [] }) {
  const [period, setPeriod] = useState('week');

  const periods = [
    { value: 'day', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
  ];

  // Procesar datos reales de órdenes
  const chartData = useMemo(() => {
    // Solo contar órdenes entregadas para el gráfico
    const deliveredOrders = orders.filter(o => o.status === 'delivered');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Datos del día (por horas) - solo hoy
    const dayData = [
      { time: '00:00', sales: 0, range: [0, 4] },
      { time: '04:00', sales: 0, range: [4, 8] },
      { time: '08:00', sales: 0, range: [8, 12] },
      { time: '12:00', sales: 0, range: [12, 16] },
      { time: '16:00', sales: 0, range: [16, 20] },
      { time: '20:00', sales: 0, range: [20, 24] },
    ];

    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.created_at);
      if (orderDate >= today) {
        const hour = orderDate.getHours();
        const slot = dayData.find(d => hour >= d.range[0] && hour < d.range[1]);
        if (slot) {
          const amount = parseFloat(order.net_amount || order.seller_credited || 0);
          slot.sales += amount;
        }
      }
    });

    // Datos de la semana (últimos 7 días)
    const weekData = [];
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      weekData.push({
        time: weekDays[date.getDay()],
        sales: 0,
        date: date.toISOString().split('T')[0]
      });
    }

    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const orderDateStr = orderDate.toISOString().split('T')[0];
      const slot = weekData.find(d => d.date === orderDateStr);
      if (slot) {
        const amount = parseFloat(order.net_amount || order.seller_credited || 0);
        slot.sales += amount;
      }
    });

    // Datos del mes (últimos 30 días agrupados por semana)
    const monthData = [];
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(thirtyDaysAgo);
      weekStart.setDate(thirtyDaysAgo.getDate() + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      
      monthData.push({
        time: `Sem ${week + 1}`,
        sales: 0,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
    }

    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const orderDateStr = orderDate.toISOString().split('T')[0];
      
      for (const week of monthData) {
        if (orderDateStr >= week.startDate && orderDateStr < week.endDate) {
          const amount = parseFloat(order.net_amount || order.seller_credited || 0);
          week.sales += amount;
          break;
        }
      }
    });

    // Si no hay datos reales, mostrar gráfico vacío
    const hasRealData = deliveredOrders.length > 0;
    
    if (!hasRealData) {
      return {
        day: [
          { time: '00:00', sales: 0 },
          { time: '04:00', sales: 0 },
          { time: '08:00', sales: 0 },
          { time: '12:00', sales: 0 },
          { time: '16:00', sales: 0 },
          { time: '20:00', sales: 0 },
        ],
        week: [
          { time: 'Lun', sales: 0 },
          { time: 'Mar', sales: 0 },
          { time: 'Mié', sales: 0 },
          { time: 'Jue', sales: 0 },
          { time: 'Vie', sales: 0 },
          { time: 'Sáb', sales: 0 },
          { time: 'Dom', sales: 0 },
        ],
        month: [
          { time: 'Sem 1', sales: 0 },
          { time: 'Sem 2', sales: 0 },
          { time: 'Sem 3', sales: 0 },
          { time: 'Sem 4', sales: 0 },
        ],
      };
    }

    return {
      day: dayData.map(({ time, sales }) => ({ time, sales: Math.round(sales * 100) / 100 })),
      week: weekData.map(({ time, sales }) => ({ time, sales: Math.round(sales * 100) / 100 })),
      month: monthData.map(({ time, sales }) => ({ time, sales: Math.round(sales * 100) / 100 })),
    };
  }, [orders]);

  const currentData = chartData[period] || chartData.week;
  
  // Calcular línea de meta (20% por encima del valor máximo)
  const maxValue = Math.max(...currentData.map(d => d.sales), 0);
  const goalLine = maxValue > 0 ? maxValue * 1.2 : 100;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">Ventas en el tiempo</h3>
        <div className="chart-filters">
          {periods.map((p) => (
            <button
              key={p.value}
              className={`chart-filter-btn ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={currentData}>
          <defs>
            <linearGradient id="lightcodeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F7CFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4F7CFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="0" 
            stroke="rgba(30, 42, 61, 0.5)" 
            vertical={false}
          />
          <XAxis 
            dataKey="time" 
            stroke="#64748B"
            style={{ fontSize: '13px', fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: '#1E2A3D' }}
          />
          <YAxis 
            stroke="#64748B"
            style={{ fontSize: '13px', fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: '#1E2A3D' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{
              background: '#0F1419',
              border: '1px solid #1E2A3D',
              borderRadius: '12px',
              color: '#F1F5F9',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              padding: '12px 16px'
            }}
            labelStyle={{
              color: '#94A3B8',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '4px'
            }}
            itemStyle={{
              color: '#4F7CFF',
              fontSize: '14px',
              fontWeight: 700
            }}
            formatter={(value) => [`$${value.toFixed(2)}`, 'Ventas']}
            cursor={{ stroke: '#4F7CFF', strokeWidth: 1, strokeDasharray: '5 5' }}
          />
          {/* Línea de meta - solo si hay datos */}
          {maxValue > 0 && (
            <ReferenceLine 
              y={goalLine} 
              stroke="#22C55E" 
              strokeDasharray="8 4" 
              strokeWidth={2}
              label={{ 
                value: 'Meta', 
                position: 'right',
                fill: '#22C55E',
                fontSize: 13,
                fontWeight: 700
              }}
            />
          )}
          <Area 
            type="monotone" 
            dataKey="sales" 
            stroke="#4F7CFF" 
            strokeWidth={3}
            fill="url(#lightcodeGradient)"
            dot={{ 
              fill: '#4F7CFF', 
              r: 4, 
              strokeWidth: 3, 
              stroke: '#0F1419'
            }}
            activeDot={{ 
              r: 6, 
              strokeWidth: 3,
              stroke: '#4F7CFF',
              fill: '#0F1419'
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
