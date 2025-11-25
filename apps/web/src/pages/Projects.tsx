import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { projectsApi } from '../lib/api';
import { formatCurrency, formatNumber, getBillingModeLabel } from '../lib/utils';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Projects() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [billingFilter, setBillingFilter] = useState<string>('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', statusFilter, billingFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (billingFilter) params.billingMode = billingFilter;
      const res = await projectsApi.getAll(params);
      return res.data.data;
    },
  });

  const statusColorMap: Record<string, string> = {
    ACTIVE: 'badge-success',
    PAUSED: 'badge-warning',
    ARCHIVED: 'badge-default bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
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
            Projects
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your freelance projects
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-4 mb-6"
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={billingFilter}
          onChange={(e) => setBillingFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Billing</option>
          <option value="FIXED_TOTAL">Fixed Total</option>
          <option value="RECURRING_PERIOD">Recurring</option>
          <option value="HOURLY">Hourly</option>
        </select>
      </motion.div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
        </div>
      ) : projects?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-12 text-center"
        >
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No projects yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Create your first project to start tracking time and managing your freelance work.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create Your First Project
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project: any, index: number) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Link
                to={`/projects/${project.id}`}
                className="card block hover:border-amber-500/50 transition-all duration-200 group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {project.name[0]}
                    </div>
                    <span className={`badge ${statusColorMap[project.status]}`}>
                      {project.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {project.clientName || 'No client'}
                  </p>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="badge badge-info text-xs">
                      {getBillingModeLabel(project.billingMode)}
                    </span>
                    {project.activeTimeEntry && (
                      <span className="badge badge-success text-xs flex items-center gap-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Timer Running
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Hours</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatNumber(project.totalHours)}h
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Income</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(project.totalIncome)}
                      </p>
                    </div>
                  </div>

                  {project.effectiveHourlyRate !== null && (
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Effective Rate</p>
                      <p className="text-lg font-semibold text-amber-500">
                        {formatCurrency(project.effectiveHourlyRate)}/h
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

