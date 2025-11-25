import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { invoicesApi, projectsApi, paymentsApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import CreateInvoiceModal from '../components/CreateInvoiceModal';
import CreatePaymentModal from '../components/CreatePaymentModal';

export default function Invoices() {
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.getAll(params);
      return res.data.data;
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

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
      />

      {/* Create Payment Modal */}
      <CreatePaymentModal
        isOpen={showCreatePayment}
        onClose={() => {
          setShowCreatePayment(false);
          setSelectedInvoice(null);
        }}
        preselectedInvoice={selectedInvoice}
      />
    </div>
  );
}

