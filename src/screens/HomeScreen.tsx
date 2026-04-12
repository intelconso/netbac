import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, AlertCircle, Package, CheckCircle, Clock, History, LayoutGrid, ShieldCheck, Scan, FileText, Thermometer, Share2, MoreVertical, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn, getDaysRemaining, formatDate } from '../lib/utils';
import { motion } from 'framer-motion';

import { QRCodeSVG } from 'qrcode.react';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { zones, storageUnits, bacs, products, user } = useStore();
  const currentUrl = window.location.href;

  const activeProducts = products.filter(p => p.status === 'active');
  const expiredProducts = products.filter(p => p.status === 'active' && getDaysRemaining(p.dlc) < 0);
  const expiringSoonCount = products.filter(p => 
    p.status === 'active' && getDaysRemaining(p.dlc) >= 0 && getDaysRemaining(p.dlc) <= 1
  ).length;

  const recentProducts = [...products]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 3);

  const stats = [
    { label: 'Supports', value: bacs.length, icon: LayoutGrid, color: 'text-gray-400', bg: 'bg-gray-50', path: '/settings' },
    { label: 'Étiquettes', value: activeProducts.length, icon: Package, color: 'text-primary', bg: 'bg-primary/10', path: '/labels' },
    { label: 'Historique', value: products.filter(p => p.status !== 'active').length, icon: History, color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/history' },
    { label: 'HACCP', value: 'Rapports', icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10', path: '/reports' },
  ];

  const complianceRate = activeProducts.length > 0 
    ? Math.round(((activeProducts.length - expiredProducts.length) / activeProducts.length) * 100)
    : 100;

  return (
    <div className="p-6 space-y-8 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">NETBAC PRO</span>
            <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">Tableau de Bord</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) {
                navigator.share({ title: 'Netbac Access', url });
              } else {
                alert(`Lien d'accès: ${url}`);
              }
            }}
            className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-95 transition-all"
          >
            <Share2 size={18} />
          </button>
          <button 
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-95 transition-all"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Critical Alerts */}
      {(expiredProducts.length > 0 || expiringSoonCount > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/labels')}
          className={cn(
            "p-4 rounded-2xl flex items-center gap-4 shadow-xl cursor-pointer",
            expiredProducts.length > 0 ? "bg-danger text-white shadow-danger/20" : "bg-alert text-white shadow-alert/20"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
            <AlertCircle size={28} />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-tight">
              {expiredProducts.length > 0 ? 'Alerte Sanitaire' : 'Attention DLC'}
            </h3>
            <p className="text-[10px] font-bold opacity-90 uppercase tracking-widest mt-0.5">
              {expiredProducts.length > 0 
                ? `${expiredProducts.length} produits expirés à retirer`
                : `${expiringSoonCount} produits expirent aujourd'hui`}
            </p>
          </div>
          <ChevronRight size={20} className="opacity-50" />
        </motion.div>
      )}

      {/* Operations Center */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Centre d'Opérations</h2>
          <span className="text-[9px] font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">Cuisine en ligne</span>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/express-add')}
            className="bg-primary p-6 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30 relative overflow-hidden text-left group"
          >
            <div className="relative z-10 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-md border border-white/20">
                <Plus size={32} />
              </div>
              <div>
                <p className="text-xl font-black uppercase tracking-tighter leading-none">Étiquetage</p>
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mt-1">Traçabilité instantanée</p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <Scan className="absolute top-4 right-6 opacity-20" size={48} />
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/journal')}
              className="bg-gray-900 p-5 rounded-[2rem] text-white space-y-3 shadow-xl relative overflow-hidden text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary">
                <Thermometer size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tight">Températures</p>
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">HACCP Froid</p>
              </div>
            </motion.button>

            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/journal')}
              className="bg-white p-5 rounded-[2rem] text-gray-900 space-y-3 shadow-xl border border-gray-100 relative overflow-hidden text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tight text-gray-900">Nettoyage</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Plan d'hygiène</p>
              </div>
            </motion.button>
          </div>
        </div>
      </section>

      {/* Quick Reports */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Analyses & Audits</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Stock', icon: Package, color: 'text-primary', path: '/reports', type: 'stock' },
            { label: 'Pertes', icon: Trash2, color: 'text-danger', path: '/reports', type: 'waste' },
            { label: 'Audit', icon: History, color: 'text-blue-500', path: '/reports', type: 'history' },
          ].map((item, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(item.path)}
              className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center gap-2 text-center"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <item.icon size={16} className={item.color} />
              </div>
              <span className="text-[8px] font-black text-gray-900 uppercase tracking-widest">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats
          .filter(stat => {
            if (stat.label === 'Température' && !user?.settings?.enableTemperature) return false;
            if (stat.label === 'Nettoyage' && !user?.settings?.enableCleaning) return false;
            return true;
          })
          .map((stat, i) => (
          <motion.button 
            key={i} 
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(stat.path)}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 text-left"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", stat.bg)}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Compliance Card */}
      <div className="bg-success/5 border border-success/10 p-5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success text-white flex items-center justify-center shadow-lg shadow-success/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-none">Conformité HACCP</h3>
              <p className="text-[9px] font-bold text-success uppercase tracking-widest mt-1">Audit en temps réel</p>
            </div>
          </div>
          <div className="text-right">
            <span className={cn(
              "text-xl font-black",
              complianceRate > 80 ? "text-success" : complianceRate > 50 ? "text-alert" : "text-danger"
            )}>
              {complianceRate}%
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${complianceRate}%` }}
              className={cn(
                "h-full rounded-full",
                complianceRate > 80 ? "bg-success" : complianceRate > 50 ? "bg-alert" : "bg-danger"
              )}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            <span>{expiredProducts.length} anomalies</span>
            <span>Objectif 100%</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <History size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Dernières étiquettes</h2>
          </div>
          <button 
            onClick={() => navigate('/labels')}
            className="text-[10px] font-bold text-primary uppercase tracking-wider active:scale-95 transition-all"
          >
            Tout voir
          </button>
        </div>

        <div className="space-y-3">
          {recentProducts.length > 0 ? (
            recentProducts.map((product) => {
              const bac = bacs.find(b => b.id === product.bacId);
              const days = getDaysRemaining(product.dlc);
              return (
                <div key={product.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg">
                    {bac?.icon || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{product.name}</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Dans {bac?.name || 'Inconnu'}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-[10px] font-bold uppercase",
                      days < 0 ? "text-danger" : days <= 1 ? "text-alert" : "text-success"
                    )}>
                      DLC {formatDate(product.dlc)}
                    </p>
                    <p className="text-[9px] text-gray-400 font-medium">
                      {days < 0 ? 'Expiré' : `${days}j restants`}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400 font-medium">Aucun produit récent</p>
            </div>
          )}
        </div>
      </section>

      {/* Grid of Storage Units grouped by Zone */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-gray-900">Inventaire par Zone</h2>
          <button 
            onClick={() => navigate('/settings')}
            className="text-[10px] font-bold text-primary uppercase tracking-wider"
          >
            Gérer
          </button>
        </div>
        
        <div className="space-y-6">
          {zones.map((zone) => {
            const zoneUnits = storageUnits.filter(u => u.zoneId === zone.id);
            if (zoneUnits.length === 0) return null;
            
            return (
              <div key={zone.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{zone.icon}</span>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{zone.name}</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {zoneUnits.map((unit) => {
                    const unitBacs = bacs.filter(b => {
                      const shelf = useStore.getState().shelves.find(s => s.id === b.shelfId);
                      return shelf?.unitId === unit.id;
                    });
                    return (
                      <motion.button
                        key={unit.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/unit/${unit.id}`)}
                        className="flex-shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-2 min-w-[120px]"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gray-50">
                          {unit.icon}
                        </div>
                        <div className="space-y-0.5">
                          <h3 className="text-xs font-black text-gray-900 leading-tight uppercase tracking-tight truncate w-24">{unit.name}</h3>
                          <p className="text-[8px] font-bold text-primary uppercase tracking-tighter">{unitBacs.length} supports</p>
                          <p className="text-[7px] font-medium text-gray-400 uppercase">{unit.type}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
