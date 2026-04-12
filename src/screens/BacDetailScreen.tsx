import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle2, History, Printer, Share2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn, formatDate, getDaysRemaining } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import ProductLabel from '../components/ProductLabel';

export default function BacDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bacs, products, updateProductStatus, deleteProduct } = useStore();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const bac = bacs.find(b => b.id === id);
  const bacProducts = products.filter(p => p.bacId === id && p.status === 'active');
  const history = products.filter(p => p.bacId === id && p.status !== 'active').slice(0, 5);

  if (!bac) return <div>Bac non trouvé</div>;

  const getStatusColor = (days: number) => {
    if (days < 0) return { border: 'border-danger', bg: 'bg-danger/5', text: 'text-danger', label: 'EXPIRÉ / À JETER' };
    if (days <= 1) return { border: 'border-alert', bg: 'bg-alert/5', text: 'text-alert', label: 'URGENT / À UTILISER' };
    return { border: 'border-success', bg: 'bg-success/5', text: 'text-success', label: 'CONFORME / BON' };
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enlarged Label Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -2 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8, rotate: 2 }}
              className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence>
              </AnimatePresence>

              <ProductLabel product={selectedProduct} size="lg" />
              
              <div className="grid grid-cols-1 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="py-6 bg-gray-900 text-white font-black uppercase tracking-widest text-[10px]"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 bg-white border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-2xl" style={{ color: bac.color }}>
            {bac.icon}
          </div>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">BAC {bac.name}</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Détails du support</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Active Products */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contenu ({bacProducts.length})</h2>
          
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {bacProducts.map((product) => {
                const days = getDaysRemaining(product.dlc);
                const status = getStatusColor(days);
                return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={cn(
                        "bg-white rounded-2xl shadow-sm border-2 overflow-hidden active:scale-[0.98] transition-all cursor-pointer relative group",
                        status.border
                      )}
                    >
                      {/* Clickable Area for Enlargement */}
                      <div 
                        onClick={() => setSelectedProduct(product)}
                        className="absolute inset-0 z-10 cursor-pointer"
                        aria-label="Agrandir l'étiquette"
                      />

                      <ProductLabel product={product} />

                      {/* Actions */}
                      <div className="flex bg-gray-50 border-t border-gray-100 relative z-10" onClick={(e) => e.stopPropagation()}>
                        {days < 0 ? (
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="flex-1 bg-danger text-white py-4 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                          >
                            <Trash2 size={14} /> JETER LE PRODUIT (EXPIRÉ)
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => updateProductStatus(product.id, 'used')}
                              className="flex-1 hover:bg-success hover:text-white py-4 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border-r border-gray-100"
                            >
                              <CheckCircle2 size={14} /> Valider Sortie
                            </button>
                            <button 
                              onClick={() => deleteProduct(product.id)}
                              className="w-14 hover:bg-danger hover:text-white py-4 flex items-center justify-center transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                );
              })}
            </AnimatePresence>

            {bacProducts.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-gray-400 font-medium">Ce bac est vide</p>
                <button 
                  onClick={() => navigate('/add-product', { state: { bacId: bac.id } })}
                  className="text-xs font-bold text-primary uppercase"
                >
                  + Ajouter un produit
                </button>
              </div>
            )}
          </div>
        </section>

        {/* History */}
        {history.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <History size={14} /> Historique récent
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-[10px] font-medium text-gray-400 bg-gray-50/50 p-2 rounded-lg">
                  <span>{formatDate(item.modifiedAt)} — {item.name}</span>
                  <span className="uppercase">{item.status === 'used' ? 'Utilisé' : 'Jeté'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="p-6 bg-white border-t border-gray-100">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/add-product', { state: { bacId: bac.id } })}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          AJOUTER DANS CE BAC
        </motion.button>
      </div>
    </div>
  );
}
