import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { todosApi, projectsApi } from '../lib/api';
import { formatDate } from '../lib/utils';

type TodoPriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface TodoWithProject {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    clientName: string | null;
    status: string;
  };
}

export default function Todos() {
  const queryClient = useQueryClient();
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [completedFilter, setCompletedFilter] = useState<string>('');
  const [overdueFilter, setOverdueFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('');

  // Get projects for filter
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectsApi.getAll();
      return res.data.data;
    },
  });

  // Get todos
  const { data: todos, isLoading } = useQuery({
    queryKey: ['todos', projectFilter, priorityFilter, completedFilter, overdueFilter, sortBy],
    queryFn: async () => {
      const params: any = {};
      if (projectFilter) params.projectId = projectFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (completedFilter) params.completed = completedFilter;
      if (overdueFilter === 'true') params.overdue = 'true';
      if (sortBy) params.sortBy = sortBy;
      const res = await todosApi.getAll(params);
      return res.data.data;
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      todosApi.update(id, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      toast.success('Todo updated!');
    },
    onError: () => {
      toast.error('Failed to update todo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => todosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Todo deleted!');
    },
    onError: () => {
      toast.error('Failed to delete todo');
    },
  });

  const priorityColors: Record<TodoPriority, string> = {
    LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const priorityLabels: Record<TodoPriority, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  };

  const isOverdue = (todo: TodoWithProject) => {
    if (todo.completed || !todo.dueDate) return false;
    return new Date(todo.dueDate) < new Date();
  };

  const handleToggleComplete = (todo: TodoWithProject) => {
    toggleCompleteMutation.mutate({ id: todo.id, completed: !todo.completed });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this todo?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">
            Todos
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage all your todos across projects
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-4 mb-6"
      >
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Projects</option>
          {projects?.map((project: any) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select
          value={completedFilter}
          onChange={(e) => setCompletedFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Status</option>
          <option value="false">Open</option>
          <option value="true">Completed</option>
        </select>
        <select
          value={overdueFilter}
          onChange={(e) => setOverdueFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All</option>
          <option value="true">Overdue Only</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="select w-auto"
        >
          <option value="">Sort by...</option>
          <option value="priority">Priority</option>
          <option value="dueDate">Due Date</option>
          <option value="project">Project</option>
        </select>
      </motion.div>

      {/* Todos List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
        </div>
      ) : todos?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-12 text-center"
        >
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No todos found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            {projectFilter || priorityFilter || completedFilter || overdueFilter
              ? 'Try adjusting your filters to see more todos.'
              : 'Create todos in your projects to see them here.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {todos?.map((todo: TodoWithProject, index: number) => (
            <motion.div
              key={todo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className={`card ${todo.completed ? 'opacity-60' : ''}`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(todo)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      todo.completed
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-amber-500'
                    }`}
                  >
                    {todo.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-lg font-semibold mb-1 ${
                            todo.completed
                              ? 'line-through text-slate-500 dark:text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {todo.title}
                        </h3>
                        {todo.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {todo.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge ${priorityColors[todo.priority]}`}>
                          {priorityLabels[todo.priority]}
                        </span>
                        {isOverdue(todo) && (
                          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
                      <Link
                        to={`/projects/${todo.project.id}`}
                        className="hover:text-amber-500 transition-colors font-medium"
                      >
                        {todo.project.name}
                      </Link>
                      {todo.project.clientName && (
                        <>
                          <span>•</span>
                          <span>{todo.project.clientName}</span>
                        </>
                      )}
                      {todo.dueDate && (
                        <>
                          <span>•</span>
                          <span className={isOverdue(todo) ? 'text-red-500 font-medium' : ''}>
                            Due: {formatDate(todo.dueDate)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleDelete(todo.id)}
                        className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                      {todo.completed && todo.completedAt && (
                        <span className="text-xs text-slate-400 ml-auto">
                          Completed {formatDate(todo.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

