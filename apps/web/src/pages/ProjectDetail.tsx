import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { projectsApi, todosApi } from '../lib/api';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMinutesToHours,
  getBillingModeLabel,
  formatDuration,
  getPriorityLabel,
  formatHoursMinutes,
} from '../lib/utils';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'time' | 'todos' | 'billing'>('overview');
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [stopNote, setStopNote] = useState('');
  const [showStopModal, setShowStopModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editingTimeEntry, setEditingTimeEntry] = useState<any>(null);

  // Fetch project data
  const { data: project, isLoading, refetch: refetchProject } = useQuery({
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

  // Resume timer mutation
  const resumeTimerMutation = useMutation({
    mutationFn: (timeEntryId: string) => projectsApi.resumeTimer(projectId!, timeEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      toast.success('Timer resumed!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to resume timer');
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: ({ timeEntryId, note }: { timeEntryId: string; note?: string }) =>
      projectsApi.stopTimer(projectId!, timeEntryId, note),
    onSuccess: async () => {
      setTimerElapsed(0);
      setStopNote('');
      setShowStopModal(false);
      // Immediately refetch to get updated data
      await refetchProject();
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
    mutationFn: (data: { title: string; description?: string; priority?: string; dueDate?: string }) =>
      projectsApi.createTodo(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Todo created!');
      setNewTodoTitle('');
      setNewTodoDescription('');
      setNewTodoPriority('MEDIUM');
      setNewTodoDueDate('');
    },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ todoId, data }: { todoId: string; data: any }) =>
      todosApi.update(todoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingTodo(null);
      toast.success('Todo updated!');
    },
    onError: () => {
      toast.error('Failed to update todo');
    },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (todoId: string) => todosApi.delete(todoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Todo deleted!');
    },
    onError: () => {
      toast.error('Failed to delete todo');
    },
  });

  const updateTimeEntryMutation = useMutation({
    mutationFn: ({ timeEntryId, data }: { timeEntryId: string; data: any }) =>
      projectsApi.updateTimeEntry(projectId!, timeEntryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingTimeEntry(null);
      toast.success('Time entry updated!');
    },
    onError: () => {
      toast.error('Failed to update time entry');
    },
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: (timeEntryId: string) =>
      projectsApi.deleteTimeEntry(projectId!, timeEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Time entry deleted!');
    },
    onError: () => {
      toast.error('Failed to delete time entry');
    },
  });

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('MEDIUM');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    createTodoMutation.mutate({
      title: newTodoTitle.trim(),
      description: newTodoDescription.trim() || undefined,
      priority: newTodoPriority,
      dueDate: newTodoDueDate || undefined,
    });
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
                {formatHoursMinutes(project.totalHours)}h
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
                    {entry.endedAt 
                      ? (entry.durationMinutes ? formatMinutesToHours(entry.durationMinutes) : '< 1m')
                      : 'Running...'}
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
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {entry.note || 'No description'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatDateTime(entry.startedAt)}
                    {entry.endedAt && ` - ${formatDateTime(entry.endedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {entry.endedAt 
                        ? (entry.durationMinutes ? formatMinutesToHours(entry.durationMinutes) : '< 1m')
                        : 'Running...'}
                    </p>
                    {project.billingMode === 'HOURLY' && entry.durationMinutes && (
                      <p className="text-sm text-amber-500">
                        {formatCurrency((Number(project.hourlyRate) || 0) * (entry.durationMinutes / 60))}
                      </p>
                    )}
                  </div>
                  {entry.endedAt && !project.activeTimeEntry && (
                    <button
                      onClick={() => resumeTimerMutation.mutate(entry.id)}
                      disabled={resumeTimerMutation.isPending}
                      className="p-1.5 text-slate-500 hover:text-emerald-500 transition-colors"
                      title="Resume this timer"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                  {entry.endedAt && (
                    <>
                      <button
                        onClick={() => setEditingTimeEntry(entry)}
                        className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this time entry?')) {
                            deleteTimeEntryMutation.mutate(entry.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
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
            <form onSubmit={handleCreateTodo} className="space-y-3 mb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="Todo title..."
                  className="input flex-1"
                  required
                />
                <button type="submit" className="btn-primary">
                  Add
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <textarea
                  value={newTodoDescription}
                  onChange={(e) => setNewTodoDescription(e.target.value)}
                  placeholder="Description (optional)..."
                  className="input md:col-span-2"
                  rows={2}
                />
                <div className="flex gap-2">
                  <select
                    value={newTodoPriority}
                    onChange={(e) => setNewTodoPriority(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <input
                    type="date"
                    value={newTodoDueDate}
                    onChange={(e) => setNewTodoDueDate(e.target.value)}
                    className="input flex-1"
                    placeholder="Due date"
                  />
                </div>
              </div>
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
                    {todo.dueDate && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Due: {formatDate(todo.dueDate)}
                        {new Date(todo.dueDate) < new Date() && !todo.completed && (
                          <span className="ml-2 text-red-500">Overdue</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${priorityColors[todo.priority]}`}>
                      {getPriorityLabel(todo.priority)}
                    </span>
                    <button
                      onClick={() => setEditingTodo(todo)}
                      className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this todo?')) {
                          deleteTodoMutation.mutate(todo.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setEditingTodo(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Edit Todo
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingTodo.title}
                  onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editingTodo.description || ''}
                  onChange={(e) => setEditingTodo({ ...editingTodo, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={editingTodo.priority}
                    onChange={(e) => setEditingTodo({ ...editingTodo, priority: e.target.value })}
                    className="input w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingTodo.dueDate ? new Date(editingTodo.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingTodo({ ...editingTodo, dueDate: e.target.value || null })}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="completed"
                  checked={editingTodo.completed}
                  onChange={(e) => setEditingTodo({ ...editingTodo, completed: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="completed" className="text-sm text-slate-700 dark:text-slate-300">
                  Completed
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTodo(null)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateTodoMutation.mutate({
                    todoId: editingTodo.id,
                    data: {
                      title: editingTodo.title,
                      description: editingTodo.description || null,
                      priority: editingTodo.priority,
                      dueDate: editingTodo.dueDate ? new Date(editingTodo.dueDate).toISOString() : null,
                      completed: editingTodo.completed,
                    },
                  });
                }}
                disabled={updateTodoMutation.isPending}
                className="btn-primary flex-1"
              >
                {updateTodoMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Time Entry Modal */}
      {editingTimeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setEditingTimeEntry(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Edit Time Entry
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Note
                </label>
                <textarea
                  value={editingTimeEntry.note || ''}
                  onChange={(e) => setEditingTimeEntry({ ...editingTimeEntry, note: e.target.value })}
                  className="input w-full"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={new Date(editingTimeEntry.startedAt).toISOString().slice(0, 16)}
                    onChange={(e) => setEditingTimeEntry({ ...editingTimeEntry, startedAt: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editingTimeEntry.endedAt ? new Date(editingTimeEntry.endedAt).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingTimeEntry({ ...editingTimeEntry, endedAt: e.target.value || null })}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingTimeEntry.durationMinutes || ''}
                  onChange={(e) => setEditingTimeEntry({ ...editingTimeEntry, durationMinutes: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  placeholder="Auto-calculated from times"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTimeEntry(null)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateTimeEntryMutation.mutate({
                    timeEntryId: editingTimeEntry.id,
                    data: {
                      startedAt: new Date(editingTimeEntry.startedAt).toISOString(),
                      endedAt: editingTimeEntry.endedAt ? new Date(editingTimeEntry.endedAt).toISOString() : null,
                      durationMinutes: editingTimeEntry.durationMinutes,
                      note: editingTimeEntry.note || null,
                    },
                  });
                }}
                disabled={updateTimeEntryMutation.isPending}
                className="btn-primary flex-1"
              >
                {updateTimeEntryMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

