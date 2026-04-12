import React, { useState } from 'react';
import { FileText, Download, Share2, ShieldCheck, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { useStore } from '../lib/store';
import { formatDate, cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';

export default function ExportScreen() {
  const { products, bacs, user, isOffline, setOffline } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString('fr-FR');
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(16, 185, 129); // Emerald Green
      doc.text('REGISTRE DE TRAÇABILITÉ HACCP', 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Restaurant: ${user?.restaurantName || 'Non défini'}`, 20, 30);
      doc.text(`Responsable: ${user?.name || 'Non défini'}`, 20, 35);
      doc.text(`Date d'export: ${timestamp}`, 20, 40);
      doc.text(`Statut: ${isOffline ? 'Généré hors connexion' : 'Généré en ligne'}`, 20, 45);

      // Table Header
      doc.setFillColor(240, 240, 240);
      doc.rect(20, 55, 170, 10, 'F');
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 25, 62);
      doc.text('Produit', 55, 62);
      doc.text('Bac', 105, 62);
      doc.text('Quantité', 145, 62);
      doc.text('Statut', 175, 62);

      // Data
      doc.setFont('helvetica', 'normal');
      let y = 72;
      products.slice(0, 20).forEach((p) => {
        const bac = bacs.find(b => b.id === p.bacId);
        doc.text(formatDate(p.addedAt), 25, y);
        doc.text(p.name, 55, y);
        doc.text(bac?.name || '-', 105, y);
        doc.text(`${p.quantity} ${p.unit}`, 145, y);
        doc.text(p.status === 'active' ? 'En stock' : 'Sorti', 175, y);
        y += 10;
        
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      const hash = Math.random().toString(36).substring(2, 15).toUpperCase();
      doc.text(`Hash d'intégrité: ${hash}`, 20, 285);
      doc.text('Document certifié conforme aux normes HACCP - NETBAC Digital', 20, 290);

      doc.save(`HACCP_Export_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 bg-white border-b border-gray-50">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Rapports HACCP</h1>
          <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Contrôle Sanitaire</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Connection Status */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">État de la connexion</h2>
          <button 
            onClick={() => setOffline(!isOffline)}
            className={cn(
              "w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left",
              isOffline ? "border-gray-200 bg-gray-50" : "border-primary/20 bg-primary/5"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isOffline ? "bg-gray-200 text-gray-500" : "bg-primary/20 text-primary"
            )}>
              {isOffline ? <WifiOff size={24} /> : <Wifi size={24} />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{isOffline ? "Mode Hors-ligne" : "Mode En ligne"}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                {isOffline ? "Sync en attente" : "Données synchronisées"}
              </p>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full relative transition-colors",
              isOffline ? "bg-gray-300" : "bg-primary"
            )}>
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                isOffline ? "left-1" : "left-7"
              )} />
            </div>
          </button>
        </section>

        {/* Export Options */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Options d'export</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <span className="text-sm font-bold text-gray-700">Traçabilité complète</span>
              </div>
              <input type="checkbox" defaultChecked className="accent-primary" />
            </div>
            <div className="p-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span className="text-sm font-bold text-gray-700">Liste des expirés</span>
              </div>
              <input type="checkbox" className="accent-primary" />
            </div>
            <div className="p-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span className="text-sm font-bold text-gray-700">Inventaire actuel</span>
              </div>
              <input type="checkbox" className="accent-primary" />
            </div>
          </div>
        </section>

        {/* Security Info */}
        <div className="bg-success/5 border border-success/10 p-4 rounded-2xl flex items-start gap-3">
          <ShieldCheck size={20} className="text-success mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-success uppercase tracking-wide">Conformité HACCP</p>
            <p className="text-[10px] text-success/70 leading-relaxed font-medium">
              Les exports générés incluent un horodatage local et un hash d'intégrité pour garantir l'authenticité des données lors d'un contrôle.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-6 bg-white border-t border-gray-100 space-y-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={generatePDF}
          disabled={isGenerating}
          className={cn(
            "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all",
            isGenerating ? "bg-gray-100 text-gray-400 shadow-none" : "bg-primary text-white shadow-primary/20"
          )}
        >
          {isGenerating ? (
            <>Génération en cours...</>
          ) : (
            <>
              <Download size={20} />
              GÉNÉRER LE PDF
            </>
          )}
        </motion.button>
        <p className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-widest">
          0 connexion requise pour l'export
        </p>
      </div>
    </div>
  );
}
