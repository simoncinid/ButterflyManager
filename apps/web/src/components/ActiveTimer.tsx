import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '../lib/utils';

interface ActiveTimerProps {
  timeEntry: {
    id: string;
    projectId: string;
    startedAt: string;
    project: {
      id: string;
      name: string;
    };
  };
}

export default function ActiveTimer({ timeEntry }: ActiveTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(timeEntry.startedAt).getTime();
    
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [timeEntry.startedAt]);

  return (
    <Link
      to={`/projects/${timeEntry.projectId}`}
      className="block p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl hover:border-amber-500/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Timer Running</p>
          <p className="text-sm text-slate-900 dark:text-white font-medium truncate">
            {timeEntry.project.name}
          </p>
        </div>
        <div className="text-lg font-mono font-bold text-amber-600 dark:text-amber-400">
          {formatDuration(elapsed)}
        </div>
      </div>
    </Link>
  );
}

