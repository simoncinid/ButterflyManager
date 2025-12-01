import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { projectsApi } from '../lib/api';
import { formatCurrency } from '../lib/utils';

// Funzione per formattare con 3 decimali
function formatCurrencyWith3Decimals(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

interface MonthlyProject {
  id: string;
  name: string;
  clientName: string | null;
  recurringAmount: number | null;
  currency: string;
}

export default function Ticker() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentAmount, setCurrentAmount] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectsApi.getAll();
      return res.data.data;
    },
  });

  // Filtra progetti monthly attivi
  const monthlyProjects: MonthlyProject[] = projects
    ?.filter(
      (p: any) =>
        p.status === 'ACTIVE' &&
        p.billingMode === 'RECURRING_PERIOD' &&
        p.recurringPeriodType === 'MONTHLY' &&
        p.recurringAmount !== null
    )
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      recurringAmount: Number(p.recurringAmount),
      currency: p.currency || 'EUR',
    })) || [];

  // Calcola guadagno giornaliero totale
  const totalMonthlyAmount = monthlyProjects.reduce(
    (sum, p) => sum + (p.recurringAmount || 0),
    0
  );
  const dailyAmount = totalMonthlyAmount / 31;

  // Calcola quanto guadagnato fino ad ora oggi
  useEffect(() => {
    if (monthlyProjects.length === 0) {
      setCurrentAmount(0);
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Calcola ore e minuti trascorsi oggi
    const msElapsed = now.getTime() - startOfDay.getTime();
    const hoursElapsed = msElapsed / (1000 * 60 * 60); // ore con decimali

    // Calcola quanto guadagnato fino ad ora
    const earnedToday = (dailyAmount * hoursElapsed) / 24;

    // Imposta il valore iniziale
    setCurrentAmount(earnedToday);
    startTimeRef.current = now;

    // Aggiorna ogni secondo
    intervalRef.current = setInterval(() => {
      const currentTime = new Date();
      const msSinceStart = currentTime.getTime() - startOfDay.getTime();
      const hoursSinceStart = msSinceStart / (1000 * 60 * 60);
      const newAmount = (dailyAmount * hoursSinceStart) / 24;
      setCurrentAmount(newAmount);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [dailyAmount, monthlyProjects.length]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Gestisci cambio fullscreen da tastiera
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-900 dark:bg-slate-950'
          : 'p-6 lg:p-8 max-w-7xl mx-auto'
      }`}
    >
      <div
        className={`${
          isFullscreen
            ? 'h-full flex flex-col items-center justify-center'
            : ''
        }`}
      >
        {/* Header - solo se non in fullscreen */}
        {!isFullscreen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 dark:text-white">
              Ticker
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Contatore guadagni giornalieri da progetti monthly
            </p>
          </motion.div>
        )}

        {/* Contatore principale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${
            isFullscreen
              ? 'text-center mb-8'
              : 'card p-8 mb-6 text-center'
          }`}
        >
          <div
            className={`${
              isFullscreen
                ? 'text-7xl lg:text-9xl font-bold text-white mb-4'
                : 'text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white mb-2'
            }`}
          >
            {formatCurrencyWith3Decimals(currentAmount, monthlyProjects[0]?.currency || 'EUR')}
          </div>
          <div
            className={`${
              isFullscreen
                ? 'text-xl text-slate-300'
                : 'text-lg text-slate-600 dark:text-slate-400'
            }`}
          >
            Guadagnato oggi
          </div>
          <div
            className={`${
              isFullscreen
                ? 'text-sm text-slate-400 mt-2'
                : 'text-sm text-slate-500 dark:text-slate-500 mt-1'
            }`}
          >
            {formatCurrency(dailyAmount, monthlyProjects[0]?.currency || 'EUR')} / giorno
          </div>
        </motion.div>

        {/* Lista progetti - solo se non in fullscreen */}
        {!isFullscreen && monthlyProjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Progetti Monthly Attivi
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {monthlyProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {project.name}
                    </p>
                    {project.clientName && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {project.clientName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(project.recurringAmount || 0, project.currency)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      / mese
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messaggio se non ci sono progetti monthly */}
        {monthlyProjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center"
          >
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Nessun progetto monthly attivo. Crea un progetto con pagamento ricorrente mensile per vedere il ticker.
            </p>
          </motion.div>
        )}

        {/* Pulsante fullscreen */}
        {monthlyProjects.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={toggleFullscreen}
            className={`${
              isFullscreen
                ? 'fixed top-4 right-4 z-50'
                : 'mt-6 mx-auto block'
            } btn-primary`}
          >
            {isFullscreen ? (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Esci da fullscreen
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                Modalità fullscreen
              </>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
}

