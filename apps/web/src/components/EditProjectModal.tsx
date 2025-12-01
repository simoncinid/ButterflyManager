import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { projectsApi } from '../lib/api';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
}

interface ProjectForm {
  name: string;
  clientName?: string;
  description?: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  billingMode: 'FIXED_TOTAL' | 'RECURRING_PERIOD' | 'HOURLY';
  fixedTotalAmount?: number;
  recurringAmount?: number;
  recurringPeriodType?: 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
  hourlyRate?: number;
  currency: string;
}

export default function EditProjectModal({ isOpen, onClose, project }: EditProjectModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectForm>({
    defaultValues: project
      ? {
          name: project.name || '',
          clientName: project.clientName || '',
          description: project.description || '',
          status: project.status || 'ACTIVE',
          billingMode: project.billingMode || 'HOURLY',
          fixedTotalAmount: project.fixedTotalAmount ? Number(project.fixedTotalAmount) : undefined,
          recurringAmount: project.recurringAmount ? Number(project.recurringAmount) : undefined,
          recurringPeriodType: project.recurringPeriodType || 'MONTHLY',
          hourlyRate: project.hourlyRate ? Number(project.hourlyRate) : undefined,
          currency: project.currency || 'EUR',
        }
      : undefined,
  });

  const billingMode = watch('billingMode');

  const updateMutation = useMutation({
    mutationFn: (data: ProjectForm) => projectsApi.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success('Project updated successfully!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update project');
    },
  });

  const onSubmit = (data: ProjectForm) => {
    // Clean up data based on billing mode
    const cleanData = { ...data };
    if (data.billingMode !== 'FIXED_TOTAL') delete cleanData.fixedTotalAmount;
    if (data.billingMode !== 'RECURRING_PERIOD') {
      delete cleanData.recurringAmount;
      delete cleanData.recurringPeriodType;
    }
    if (data.billingMode !== 'HOURLY') delete cleanData.hourlyRate;

    updateMutation.mutate(cleanData);
  };

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Edit Project
              </h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              <div>
                <label className="label">Project Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Website Redesign"
                  {...register('name', { required: 'Project name is required' })}
                />
                {errors.name && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="label">Client Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Acme Corp"
                  {...register('clientName')}
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Project description..."
                  {...register('description')}
                />
              </div>

              <div>
                <label className="label">Status *</label>
                <select className="select" {...register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div>
                <label className="label">Billing Mode *</label>
                <select className="select" {...register('billingMode')}>
                  <option value="HOURLY">Hourly Rate</option>
                  <option value="FIXED_TOTAL">Fixed Total</option>
                  <option value="RECURRING_PERIOD">Recurring Period</option>
                </select>
              </div>

              {billingMode === 'HOURLY' && (
                <div>
                  <label className="label">Hourly Rate *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input pl-8"
                      placeholder="50.00"
                      {...register('hourlyRate', {
                        required: billingMode === 'HOURLY' ? 'Hourly rate is required' : false,
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  {errors.hourlyRate && (
                    <p className="mt-1.5 text-sm text-red-500">{errors.hourlyRate.message}</p>
                  )}
                </div>
              )}

              {billingMode === 'FIXED_TOTAL' && (
                <div>
                  <label className="label">Total Project Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input pl-8"
                      placeholder="5000.00"
                      {...register('fixedTotalAmount', {
                        required: billingMode === 'FIXED_TOTAL' ? 'Amount is required' : false,
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  {errors.fixedTotalAmount && (
                    <p className="mt-1.5 text-sm text-red-500">{errors.fixedTotalAmount.message}</p>
                  )}
                </div>
              )}

              {billingMode === 'RECURRING_PERIOD' && (
                <>
                  <div>
                    <label className="label">Recurring Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                      <input
                        type="number"
                        step="0.01"
                        className="input pl-8"
                        placeholder="1000.00"
                        {...register('recurringAmount', {
                          required: billingMode === 'RECURRING_PERIOD' ? 'Amount is required' : false,
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    {errors.recurringAmount && (
                      <p className="mt-1.5 text-sm text-red-500">{errors.recurringAmount.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Period Type</label>
                    <select className="select" {...register('recurringPeriodType')}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

