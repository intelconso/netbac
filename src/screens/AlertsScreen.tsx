import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn, formatDate, getDaysRemaining } from '../lib/utils';
import { motion } from 'framer-motion';
import { Product, Bac } from '../types';

interface AlertWithBac extends Product {
  days: number;
  bac?: Bac;
}

export default function AlertsScreen() {
  const navigate = useNavigate();
  const { products, bacs } = useStore();

  const activeAlerts: AlertWithBac[] = products
    .filter(p => p.status === 'active')
    .map(p => ({
      ...p,
      days: getDaysRemaining(p.dlc),
      bac: bacs.find(b => b.id === p.bacId)
    }))
    .sort((a, b) => a.days - b.days);

  const critical = activeAlerts.filter(a => a.days <= 0);
  const warning = activeAlerts.filter(a => a.days > 0 && a.days <= 2);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 bg-white border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Alertes DLC</h1>
          <p className="text-[9px] font-bold text-danger uppercase tracking-widest mt-0.5">Contrôle sanitaire</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Critical Alerts */}
        {critical.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-danger uppercase tracking-widest">Expirés ({critical.length})</h2>
            <div className="space-y-3">
              {critical.map((alert) => (
                <AlertCard key={alert.id} alert={alert} navigate={navigate} />
              ))}
            </div>
          </section>
        )}

        {/* Warning Alerts */}
        {warning.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-alert uppercase tracking-widest">Expire bientôt ({warning.length})</h2>
            <div className="space-y-3">
              {warning.map((alert) => (
                <AlertCard key={alert.id} alert={alert} navigate={navigate} />
              ))}
            </div>
          </section>
        )}

        {activeAlerts.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <p className="text-sm text-gray-400 font-medium">Aucune alerte en cours. Tout est en règle !</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface AlertCardProps {
  key?: React.Key;
  alert: AlertWithBac;
  navigate: NavigateFunction;
}

function AlertCard({ alert, navigate }: AlertCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/bac/${alert.bacId}`)}
      className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 text-left"
    >
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-xl">
        {alert.bac?.icon}
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900">{alert.name}</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase">
          Dans {alert.bac?.name} • {alert.quantity} {alert.unit}
        </p>
      </div>
      <div className="text-right">
        <p className={cn(
          "text-xs font-bold",
          alert.days <= 0 ? "text-danger" : "text-alert"
        )}>
          {alert.days <= 0 ? "EXPIRÉ" : `J-${alert.days}`}
        </p>
        <p className="text-[8px] font-medium text-gray-400 uppercase">{formatDate(alert.dlc)}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300" />
    </motion.button>
  );
}
