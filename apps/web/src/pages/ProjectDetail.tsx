import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { projectsApi, todosApi } from '../lib/api';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatMinutesToHours,
  getBillingModeLabel,
  formatDuration,
  getPriorityLabel,
} from '../lib/utils';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'time' | 'todos' | 'billing'>('overview');
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [stopNote, setStopNote] = useState('');
  const [showStopModal, setShowStopModal] = useState(false);

  // Fetch project data
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await projectsApi.getOne(projectId!);
      return res.data.data;
    },
    enabled: !!projectId,
  });

  // Timer effect
  useEffect(() => {
    if (!project?.activeTimeEntry) {
      setTimerElapsed(0);
      return;
    }

    const startTime = new Date(project.activeTimeEntry.startedAt).getTime();
    const updateElapsed = () => {
      setTimerElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [project?.activeTimeEntry]);

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: () => projectsApi.startTimer(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      toast.success('Timer started!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to start timer');
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: ({ timeEntryId, note }: { timeEntryId: string; note?: string }) =>
      projectsApi.stopTimer(projectId!, timeEntryId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      setStopNote('');
      setShowStopModal(false);
      toast.success('Timer stopped!');
    },
    onError: () => {
      toast.error('Failed to stop timer');
    },
  });

  // Todo mutations
  const toggleTodoMutation = useMutation({
    mutationFn: ({ todoId, completed }: { todoId: string; completed: boolean }) =>
      todosApi.update(todoId, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const createTodoMutation = useMutation({
    mutationFn: (data: { title: string; priority?: string }) =>
      projectsApi.createTodo(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Todo created!');
    },
  });

  const [newTodoTitle, setNewTodoTitle] = useState('');

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    createTodoMutation.mutate({ title: newTodoTitle.trim() });
    setNewTodoTitle('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Project not found
        </h2>
        <button onClick={() => navigate('/projects')} className="btn-primary">
          Back to Projects
        </button>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <button
          onClick={() => navigate('/projects')}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 mb-4 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              {project.name[0]}
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">
                {project.name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {project.clientName || 'No client'} • {getBillingModeLabel(project.billingMode)}
              </p>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-4">
            {project.activeTimeEntry ? (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Timer Running</p>
                  <p className="text-2xl font-mono font-bold text-amber-500">
                    {formatDuration(timerElapsed)}
                  </p>
                </div>
                <button
                  onClick={() => setShowStopModal(true)}
                  className="px-6 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop
                </button>
              </div>
            ) : (
              <button
                onClick={() => startTimerMutation.mutate()}
                disabled={startTimerMutation.isPending}
                className="px-6 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Timer
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['overview', 'time', 'todos', 'billing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="card p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Hours</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatNumber(project.totalHours)}h
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Income</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(project.totalIncome)}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Effective Rate</p>
              <p className="text-3xl font-bold text-amber-500">
                {project.effectiveHourlyRate
                  ? `${formatCurrency(project.effectiveHourlyRate)}/h`
                  : '-'}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
              <span
                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  project.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : project.status === 'PAUSED'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                {project.status}
              </span>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {project.timeEntries?.slice(0, 5).map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {entry.note || 'Time tracked'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(entry.startedAt)}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {entry.durationMinutes ? formatMinutesToHours(entry.durationMinutes) : 'Running...'}
                  </p>
                </div>
              ))}
              {(!project.timeEntries || project.timeEntries.length === 0) && (
                <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                  No time entries yet
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'time' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Time Entries</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {project.timeEntries?.map((entry: any) => (
              <div key={entry.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {entry.note || 'No description'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatDateTime(entry.startedAt)}
                    {entry.endedAt && ` - ${formatDateTime(entry.endedAt)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {entry.durationMinutes ? formatMinutesToHours(entry.durationMinutes) : 'Running...'}
                  </p>
                  {project.billingMode === 'HOURLY' && entry.durationMinutes && (
                    <p className="text-sm text-amber-500">
                      {formatCurrency((Number(project.hourlyRate) || 0) * (entry.durationMinutes / 60))}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {(!project.timeEntries || project.timeEntries.length === 0) && (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-500 dark:text-slate-400">
                  No time entries yet. Start the timer to begin tracking!
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'todos' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Project Todos</h3>
          </div>
          <div className="p-6">
            {/* Add Todo Form */}
            <form onSubmit={handleCreateTodo} className="flex gap-3 mb-6">
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="Add a new todo..."
                className="input flex-1"
              />
              <button type="submit" className="btn-primary">
                Add
              </button>
            </form>

            {/* Todo List */}
            <div className="space-y-3">
              {project.todos?.map((todo: any) => (
                <div
                  key={todo.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    todo.completed
                      ? 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <button
                    onClick={() =>
                      toggleTodoMutation.mutate({ todoId: todo.id, completed: !todo.completed })
                    }
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                    }`}
                  >
                    {todo.completed && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        todo.completed
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {todo.description}
                      </p>
                    )}
                  </div>
                  <span className={`badge text-xs ${priorityColors[todo.priority]}`}>
                    {getPriorityLabel(todo.priority)}
                  </span>
                </div>
              ))}
              {(!project.todos || project.todos.length === 0) && (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No todos yet. Add one above!
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'billing' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Billing Info */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Billing Settings</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Billing Mode</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {getBillingModeLabel(project.billingMode)}
                </p>
              </div>
              {project.billingMode === 'HOURLY' && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Hourly Rate</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {formatCurrency(Number(project.hourlyRate) || 0)}/h
                  </p>
                </div>
              )}
              {project.billingMode === 'FIXED_TOTAL' && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Fixed Total</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {formatCurrency(Number(project.fixedTotalAmount) || 0)}
                  </p>
                </div>
              )}
              {project.billingMode === 'RECURRING_PERIOD' && (
                <>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Recurring Amount</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(Number(project.recurringAmount) || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Period Type</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {project.recurringPeriodType}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Invoices Summary */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Invoices & Payments</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <p className="text-slate-500 dark:text-slate-400">Total Invoiced</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(
                    project.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0) || 0
                  )}
                </p>
              </div>
              <div className="flex justify-between">
                <p className="text-slate-500 dark:text-slate-400">Total Paid</p>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(project.totalIncome)}
                </p>
              </div>
              <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400">Outstanding</p>
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(
                    (project.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0) || 0) -
                      project.totalIncome
                  )}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stop Timer Modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowStopModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Stop Timer
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Add a note to describe what you worked on (optional)
            </p>
            <textarea
              value={stopNote}
              onChange={(e) => setStopNote(e.target.value)}
              placeholder="e.g., Implemented user authentication..."
              className="input min-h-[100px] mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowStopModal(false)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  stopTimerMutation.mutate({
                    timeEntryId: project.activeTimeEntry.id,
                    note: stopNote,
                  })
                }
                disabled={stopTimerMutation.isPending}
                className="btn-primary flex-1 bg-red-500 hover:bg-red-600"
              >
                {stopTimerMutation.isPending ? 'Stopping...' : 'Stop Timer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

