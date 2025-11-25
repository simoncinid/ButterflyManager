import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi, projectsApi } from '../lib/api';
import { formatCurrency, formatMonthYear, getBillingModeLabel, formatHoursMinutes } from '../lib/utils';

// Color palette for projects
const PROJECT_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
];

export default function Dashboard() {
  const [chartType, setChartType] = useState<'income' | 'hours'>('income');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [months, setMonths] = useState<string>('12');

  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await analyticsApi.getDashboard();
      return res.data.data;
    },
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectsApi.getAll();
      return res.data.data;
    },
  });

  const { data: timeData, isLoading: isLoadingTime } = useQuery({
    queryKey: ['analytics-time', period, selectedProjectId, months],
    queryFn: async () => {
      const params: any = {
        groupBy: 'period-project',
        period,
        months,
      };
      if (selectedProjectId) {
        params.projectId = selectedProjectId;
      }
      const res = await analyticsApi.getTime(params);
      return res.data;
    },
    enabled: chartType === 'hours',
  });

  if (isLoadingDashboard || isLoadingProjects) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
      </div>
    );
  }

  // Prepare income chart data
  const incomeChartData = dashboardData?.incomeByMonth?.map((item: any) => ({
    month: formatMonthYear(item.period),
    income: item.totalAmount,
  })) || [];

  // Prepare hours chart data (stacked bar chart)
  let hoursChartData: any[] = [];
  let projectColors: Record<string, string> = {};
  
  if (chartType === 'hours' && timeData?.data && timeData?.projects) {
    const projectsList = timeData.projects as Array<{ id: string; name: string }>;
    
    // Assign colors to projects
    projectsList.forEach((project, index) => {
      projectColors[project.id] = PROJECT_COLORS[index % PROJECT_COLORS.length];
    });

    // Transform data for stacked bar chart
    hoursChartData = timeData.data.map((item: any) => {
      const chartItem: any = {
        period: period === 'month' ? formatMonthYear(item.period) : item.period,
      };
      
      projectsList.forEach((project) => {
        chartItem[project.id] = item[project.id] || 0;
        chartItem[`${project.id}_name`] = project.name;
      });
      
      return chartItem;
    });
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Overview of your freelance business
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Income This Month</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(dashboardData?.totalIncomeMonth || 0)}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Hours This Month</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatHoursMinutes(dashboardData?.totalHoursMonth || 0)}h
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Active Projects</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {dashboardData?.activeProjectsCount || 0}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-6 mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {chartType === 'income' ? 'Income Overview' : 'Hours Worked Overview'}
          </h2>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Chart Type Switch */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setChartType('income')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'income'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => setChartType('hours')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'hours'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Hours
              </button>
            </div>

            {/* Period Filter */}
            {chartType === 'hours' && (
              <>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>

                {/* Project Filter */}
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[150px]"
                >
                  <option value="">All Projects</option>
                  {projects?.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                {/* Months Filter */}
                <select
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                  <option value="24">Last 24 months</option>
                </select>
              </>
            )}
          </div>
        </div>

        <div className="h-72">
          {chartType === 'income' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incomeChartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                  tickFormatter={(value) => `€${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #1e293b)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Income']}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {isLoadingTime ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-amber-500" />
                </div>
              ) : hoursChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                  No time data available for the selected period
                </div>
              ) : (
                <BarChart data={hoursChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis
                    dataKey="period"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #1e293b)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      const projectName = props.payload[`${name}_name`] || name;
                      return [`${formatHoursMinutes(value)}h`, projectName];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const item = hoursChartData[0];
                      return item?.[`${value}_name`] || value;
                    }}
                  />
                  {timeData?.projects?.map((project: any) => (
                    <Bar
                      key={project.id}
                      dataKey={project.id}
                      stackId="hours"
                      fill={projectColors[project.id] || PROJECT_COLORS[0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Top Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Top Projects
          </h2>
          <Link
            to="/projects"
            className="text-sm text-amber-500 hover:text-amber-600 font-medium"
          >
            View all →
          </Link>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {dashboardData?.topProjects?.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No projects yet. Create your first project to get started!
              </p>
              <Link to="/projects" className="btn-primary">
                Create Project
              </Link>
            </div>
          ) : (
            dashboardData?.topProjects?.map((project: any) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                    {project.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {project.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {project.clientName || 'No client'} • {getBillingModeLabel(project.billingMode)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(project.totalIncome)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatHoursMinutes(project.totalHours)}h tracked
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
