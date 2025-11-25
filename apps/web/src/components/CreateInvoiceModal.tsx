import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { invoicesApi, projectsApi } from '../lib/api';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InvoiceForm {
  projectId?: string;
  issueDate: string;
  dueDate?: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';
  externalNumber?: string;
  notes?: string;
}

export default function CreateInvoiceModal({ isOpen, onClose }: CreateInvoiceModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    defaultValues: {
      currency: 'EUR',
      status: 'DRAFT',
      issueDate: new Date().toISOString().split('T')[0],
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectsApi.getAll();
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InvoiceForm) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully!');
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create invoice');
    },
  });

  const onSubmit = (data: InvoiceForm) => {
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

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
                Create Invoice
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
                <label className="label">Project (Optional)</label>
                <select className="select" {...register('projectId')}>
                  <option value="">No project</option>
                  {projects?.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Issue Date *</label>
                  <input
                    type="date"
                    className="input"
                    {...register('issueDate', { required: 'Issue date is required' })}
                  />
                  {errors.issueDate && (
                    <p className="mt-1.5 text-sm text-red-500">{errors.issueDate.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" {...register('dueDate')} />
                </div>
              </div>

              <div>
                <label className="label">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input pl-8"
                    placeholder="1000.00"
                    {...register('amount', {
                      required: 'Amount is required',
                      valueAsNumber: true,
                      min: { value: 0.01, message: 'Amount must be positive' },
                    })}
                  />
                </div>
                {errors.amount && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <label className="label">Invoice Number</label>
                <input
                  type="text"
                  className="input"
                  placeholder="INV-001"
                  {...register('externalNumber')}
                />
              </div>

              <div>
                <label className="label">Status</label>
                <select className="select" {...register('status')}>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Additional notes..."
                  {...register('notes')}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

