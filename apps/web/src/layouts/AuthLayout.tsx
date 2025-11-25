import { motion } from 'framer-motion';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M50 20 C30 10, 10 30, 25 50 C10 70, 30 90, 50 80 C70 90, 90 70, 75 50 C90 30, 70 10, 50 20 Z"/>
                </svg>
              </div>
              <span className="text-3xl font-display font-bold text-white">Butterfly</span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-display font-bold text-white leading-tight mb-6">
              Manage your freelance business with ease
            </h1>
            
            <p className="text-lg text-white/80 leading-relaxed max-w-md">
              Track time, manage projects, create invoices, and analyze your income — all in one beautiful platform.
            </p>
            
            {/* Features */}
            <div className="mt-12 space-y-4">
              {[
                'Real-time time tracking',
                'Smart billing calculations',
                'Beautiful analytics dashboard',
              ].map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

