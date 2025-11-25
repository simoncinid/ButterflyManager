import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { invoicesApi, paymentsApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import CreatePaymentModal from '../components/CreatePaymentModal';

export default function Invoices() {
  const queryClient = useQueryClient();
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.getAll(params);
      return res.data.data;
    },
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await paymentsApi.getAll();
      return res.data.data;
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => invoicesApi.delete(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted!');
    },
    onError: () => {
      toast.error('Failed to delete invoice');
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.delete(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment deleted!');
    },
    onError: () => {
      toast.error('Failed to delete payment');
    },
  });

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
            Invoices
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your invoices and payments
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCreatePayment(true)} className="btn-secondary">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Record Payment
          </button>
          <button onClick={() => setShowCreateInvoice(true)} className="btn-primary">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit"
      >
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'invoices'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'payments'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Payments
        </button>
      </motion.div>

      {activeTab === 'invoices' && (
        <>
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 mb-6"
          >
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select w-auto"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </motion.div>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
        </div>
      ) : invoices?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-12 text-center"
        >
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No invoices yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Create your first invoice to start tracking your income.
          </p>
          <button onClick={() => setShowCreateInvoice(true)} className="btn-primary">
            Create Your First Invoice
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {invoices?.map((invoice: any) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {invoice.externalNumber || `INV-${invoice.id.slice(0, 8)}`}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 dark:text-slate-400">
                        {invoice.project?.name || 'No project'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 dark:text-slate-400">
                        {formatDate(invoice.issueDate)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(Number(invoice.amount))}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${statusColors[invoice.status]}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p
                        className={`font-medium ${
                          invoice.outstandingAmount > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(invoice.outstandingAmount)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowCreatePayment(true);
                            }}
                            className="text-amber-500 hover:text-amber-600 text-sm font-medium"
                          >
                            Add Payment
                          </button>
                        )}
                        <button
                          onClick={() => setEditingInvoice(invoice)}
                          className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this invoice?')) {
                              deleteInvoiceMutation.mutate(invoice.id);
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
        </>
      )}

      {activeTab === 'payments' && (
        <>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
            </div>
          ) : payments?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-12 text-center"
            >
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No payments yet
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Record your first payment to track your income.
              </p>
              <button onClick={() => setShowCreatePayment(true)} className="btn-primary">
                Record Your First Payment
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {payments?.map((payment: any) => (
                      <tr
                        key={payment.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-slate-900 dark:text-white">
                            {formatDate(payment.paymentDate)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-600 dark:text-slate-400">
                            {payment.invoice?.externalNumber || `INV-${payment.invoiceId.slice(0, 8)}`}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-600 dark:text-slate-400">
                            {payment.project?.name || 'No project'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(Number(payment.amount))}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-600 dark:text-slate-400">
                            {payment.method || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingPayment(payment)}
                              className="p-1.5 text-slate-500 hover:text-blue-500 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this payment?')) {
                                  deletePaymentMutation.mutate(payment.id);
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
      />

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          isOpen={!!editingInvoice}
          onClose={() => setEditingInvoice(null)}
          invoice={editingInvoice}
        />
      )}

      {/* Create Payment Modal */}
      <CreatePaymentModal
        isOpen={showCreatePayment}
        onClose={() => {
          setShowCreatePayment(false);
          setSelectedInvoice(null);
        }}
        preselectedInvoice={selectedInvoice}
      />

      {/* Edit Payment Modal */}
      {editingPayment && (
        <EditPaymentModal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          payment={editingPayment}
        />
      )}
    </div>
  );
}

// Edit Invoice Modal Component
function EditInvoiceModal({ isOpen, onClose, invoice }: { isOpen: boolean; onClose: () => void; invoice: any }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    projectId: invoice.projectId || '',
    issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : '',
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
    amount: invoice.amount,
    currency: invoice.currency || 'EUR',
    status: invoice.status,
    externalNumber: invoice.externalNumber || '',
    notes: invoice.notes || '',
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { projectsApi } = await import('../lib/api');
      const res = await projectsApi.getAll();
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.update(invoice.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Invoice updated!');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update invoice');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      projectId: formData.projectId || null,
      dueDate: formData.dueDate || null,
      externalNumber: formData.externalNumber || null,
      notes: formData.notes || null,
    });
  };

  if (!isOpen) return null;

  return (
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
              Edit Invoice
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

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="label">Project (Optional)</label>
              <select
                className="select"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              >
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
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
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
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Invoice Number</label>
              <input
                type="text"
                className="input"
                value={formData.externalNumber}
                onChange={(e) => setFormData({ ...formData, externalNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[80px]"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary flex-1"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

// Edit Payment Modal Component
function EditPaymentModal({ isOpen, onClose, payment }: { isOpen: boolean; onClose: () => void; payment: any }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '',
    amount: payment.amount,
    currency: payment.currency || 'EUR',
    method: payment.method || '',
    notes: payment.notes || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.update(payment.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment updated!');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      method: formData.method || null,
      notes: formData.notes || null,
    });
  };

  if (!isOpen) return null;

  return (
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
              Edit Payment
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

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                className="input"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                <input
                  type="number"
                  step="0.01"
                  className="input pl-8"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Payment Method</label>
              <select
                className="select"
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              >
                <option value="">Select method</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Crypto">Crypto</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[80px]"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary flex-1"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

