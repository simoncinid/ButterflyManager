import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { paymentsApi, invoicesApi } from '../lib/api';
import { formatCurrency } from '../lib/utils';

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedInvoice?: any;
}

interface PaymentForm {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  currency: string;
  method?: string;
  notes?: string;
}

export default function CreatePaymentModal({
  isOpen,
  onClose,
  preselectedInvoice,
}: CreatePaymentModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentForm>({
    defaultValues: {
      currency: 'EUR',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedInvoiceId = watch('invoiceId');

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await invoicesApi.getAll();
      return res.data.data;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (preselectedInvoice) {
      setValue('invoiceId', preselectedInvoice.id);
      setValue('amount', preselectedInvoice.outstandingAmount);
    }
  }, [preselectedInvoice, setValue]);

  const selectedInvoice = invoices?.find((inv: any) => inv.id === selectedInvoiceId);

  const createMutation = useMutation({
    mutationFn: (data: PaymentForm) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment recorded successfully!');
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    },
  });

  const onSubmit = (data: PaymentForm) => {
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
                Record Payment
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
                <label className="label">Invoice *</label>
                <select
                  className="select"
                  {...register('invoiceId', { required: 'Invoice is required' })}
                >
                  <option value="">Select invoice</option>
                  {invoices
                    ?.filter((inv: any) => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
                    .map((invoice: any) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.externalNumber || `INV-${invoice.id.slice(0, 8)}`} -{' '}
                        {formatCurrency(Number(invoice.amount))} ({invoice.project?.name || 'No project'})
                      </option>
                    ))}
                </select>
                {errors.invoiceId && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.invoiceId.message}</p>
                )}
              </div>

              {selectedInvoice && (
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-500 dark:text-slate-400">Invoice Amount</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(Number(selectedInvoice.amount))}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-500 dark:text-slate-400">Already Paid</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(selectedInvoice.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-slate-500 dark:text-slate-400">Outstanding</span>
                    <span className="font-medium text-amber-600">
                      {formatCurrency(selectedInvoice.outstandingAmount)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Payment Date *</label>
                  <input
                    type="date"
                    className="input"
                    {...register('paymentDate', { required: 'Payment date is required' })}
                  />
                  {errors.paymentDate && (
                    <p className="mt-1.5 text-sm text-red-500">{errors.paymentDate.message}</p>
                  )}
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
              </div>

              <div>
                <label className="label">Payment Method</label>
                <select className="select" {...register('method')}>
                  <option value="">Select method</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
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
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

