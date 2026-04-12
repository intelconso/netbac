import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Box, 
  Layers, 
  Camera, 
  ShieldCheck, 
  Plus, 
  ChevronRight,
  Scan,
  Maximize2,
  X
} from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function StorageUnitScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { zones, storageUnits, shelves, bacs, setUnitShelves } = useStore();
  
  const unit = storageUnits.find(u => u.id === id);
  const zone = zones.find(z => z.id === unit?.zoneId);
  const unitShelves = shelves.filter(s => s.unitId === id).sort((a, b) => a.level - b.level);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [shelfCount, setShelfCount] = useState(unitShelves.length);
  const [scanProgress, setScanProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      console.error("Erreur caméra:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const [detectedItems, setDetectedItems] = useState<{type: string, name: string}[]>([]);

  const handleScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setDetectedItems([]);
    startCamera();
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        const next = prev + 2;
        
        // Simulate finding items based on unit type
        if (unit.type === 'saladette') {
          if (prev < 30 && next >= 30) setDetectedItems(d => [...d, {type: 'shelf', name: 'Zone de Préparation'}]);
          if (prev < 60 && next >= 60) setDetectedItems(d => [...d, {type: 'bac', name: 'Bac GN 1/6'}]);
          if (prev < 80 && next >= 80) setDetectedItems(d => [...d, {type: 'bac', name: 'Bac GN 1/9'}]);
        } else {
          if (prev < 20 && next >= 20) setDetectedItems(d => [...d, {type: 'shelf', name: 'Niveau 1'}]);
          if (prev < 40 && next >= 40) setDetectedItems(d => [...d, {type: 'shelf', name: 'Niveau 2'}]);
          if (prev < 60 && next >= 60) setDetectedItems(d => [...d, {type: 'bac', name: 'Bac Gastro 1/1'}]);
          if (prev < 80 && next >= 80) setDetectedItems(d => [...d, {type: 'bac', name: 'Boîte Conservation'}]);
        }

        if (next >= 100) {
          clearInterval(interval);
          
          const detectedShelvesCount = unit.type === 'saladette' ? 2 : 3;
          const currentShelves = shelves.filter(s => s.unitId === id);
          
          if (currentShelves.length === 0) {
            for (let i = 1; i <= detectedShelvesCount; i++) {
              useStore.getState().addShelf({
                unitId: id!,
                name: unit.type === 'saladette' ? (i === 1 ? 'Plan de travail' : 'Réserve basse') : `Étagère ${i} (IA)`,
                level: i
              });
            }
          }

          setTimeout(() => {
            setIsScanning(false);
            stopCamera();
          }, 2000);
          return 100;
        }
        return next;
      });
    }, 50);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (!unit) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl">
              {unit.icon}
            </div>
            <div>
              <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                <span>{zone?.name}</span>
                <ChevronRight size={8} />
                <span className="text-primary">{unit.name}</span>
              </div>
              <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">{unit.name}</h1>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsEditingStructure(true)}
          className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Layers size={20} />
        </button>
        <button 
          onClick={handleScan}
          className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center active:scale-95 transition-transform"
        >
          <Camera size={20} />
        </button>
      </div>

      {/* Structure Edit Modal */}
      <AnimatePresence>
        {isEditingStructure && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Structure</h2>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Configurer les niveaux</p>
                </div>
                <button onClick={() => setIsEditingStructure(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre d'étagères / niveaux</label>
                    <span className="text-lg font-black text-primary">{shelfCount}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={shelfCount}
                    onChange={(e) => setShelfCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-gray-300 uppercase">
                    <span>1 Niveau</span>
                    <span>10 Niveaux</span>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[10px] font-bold text-primary leading-relaxed">
                    L'ajustement du nombre de niveaux créera ou supprimera automatiquement les étagères. Les étagères existantes et leurs bacs seront conservés si possible.
                  </p>
                </div>

                <button 
                  onClick={() => {
                    setUnitShelves(unit.id, shelfCount);
                    setIsEditingStructure(false);
                  }}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                >
                  Appliquer la structure
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Scan Overlay with Real Camera */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
          >
            {/* Camera Viewfinder */}
            <div className="absolute inset-0 overflow-hidden">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover opacity-60"
              />
              {/* Scanning Line */}
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_rgba(16,185,129,1)] z-20"
              />
              
              {/* Simulated Detection Boxes */}
              <div className="absolute inset-0 pointer-events-none">
                {scanProgress > 20 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-[20%] left-[10%] w-[80%] h-[15%] border-2 border-primary/50 rounded-lg flex items-start p-2"
                  >
                    <span className="bg-primary text-white text-[8px] font-black px-1 rounded uppercase">Étagère 1</span>
                  </motion.div>
                )}
                {scanProgress > 50 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-[40%] left-[15%] w-[30%] h-[10%] border-2 border-alert/50 rounded-lg flex items-start p-2"
                  >
                    <span className="bg-alert text-white text-[8px] font-black px-1 rounded uppercase">Bac Poulet</span>
                  </motion.div>
                )}
                {scanProgress > 70 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-[40%] right-[15%] w-[30%] h-[10%] border-2 border-success/50 rounded-lg flex items-start p-2"
                  >
                    <span className="bg-success text-white text-[8px] font-black px-1 rounded uppercase">Bac Poisson</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* UI Controls */}
            <div className="relative z-30 flex flex-col items-center w-full px-8 mt-auto pb-12">
              {/* Detection Log */}
              <div className="w-full mb-4 space-y-2">
                <AnimatePresence>
                  {detectedItems.slice(-3).map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-primary/20 backdrop-blur-md border border-primary/30 px-3 py-1.5 rounded-lg flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {item.type === 'shelf' ? 'Niveau détecté' : 'Support détecté'}: {item.name}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/10 w-full text-center space-y-4">
                <div className="space-y-1">
                  <h2 className="text-white font-black uppercase tracking-widest text-lg">Analyse IA Active</h2>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-tighter">Détection des structures de stockage</p>
                </div>
                
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${scanProgress}%` }}
                    className="h-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  />
                </div>
                
                <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase">
                  <span>{scanProgress}% terminé</span>
                  <span className="text-primary">Optimisation...</span>
                </div>
              </div>
              
              <button 
                onClick={() => { setIsScanning(false); stopCamera(); }}
                className="mt-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* 3D Visual Representation (Simulated) */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vue Spatiale 3D</h2>
            <button 
              onClick={() => navigate('/labels')}
              className="flex items-center gap-2 text-[9px] font-black text-primary uppercase bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10 active:scale-95 transition-all"
            >
              <Maximize2 size={12} /> Tout voir
            </button>
          </div>

          <div className="bg-gradient-to-b from-gray-900 to-black rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col gap-6 border-[6px] border-gray-800 ring-1 ring-white/10">
            {/* Fridge Interior Lighting & Depth Effects */}
            <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
            
            {/* Side Walls Depth */}
            <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />

            {unitShelves.map((shelf) => {
              const shelfBacs = bacs.filter(b => b.shelfId === shelf.id);
              return (
                <div key={shelf.id} className="flex-1 flex flex-col gap-3 relative group">
                  {/* Shelf Surface with 3D Perspective */}
                  <div className="flex-1 bg-gray-800/30 rounded-2xl border border-white/5 p-4 flex gap-4 items-end relative overflow-hidden backdrop-blur-sm">
                    {/* Shelf Floor Shadow */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/20 blur-xl" />
                    
                    {shelfBacs.map((bac) => (
                      <motion.button
                        key={bac.id}
                        whileHover={{ y: -5, scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/bac/${bac.id}`);
                        }}
                        className="flex-1 h-32 rounded-xl flex flex-col items-center justify-center gap-2 relative shadow-lg transition-all z-20 cursor-pointer"
                        style={{ 
                          backgroundColor: `${bac.color}15`, 
                          border: `2px solid ${bac.color}30`,
                          boxShadow: `0 10px 20px -10px ${bac.color}40`
                        }}
                      >
                        <div className="relative">
                          <span className="text-3xl drop-shadow-md">{bac.icon}</span>
                          <motion.div 
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -inset-2 bg-white/5 rounded-full blur-md" 
                          />
                        </div>
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter truncate w-full px-2 text-center">{bac.name}</span>
                        
                        {/* Bac "Content" Indicator */}
                        <div className="absolute bottom-1 right-2 flex gap-0.5">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
                          ))}
                        </div>
                      </motion.button>
                    ))}
                    
                    {shelfBacs.length === 0 && (
                      <div className="flex-1 h-32 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 group-hover:border-primary/20 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                          <Plus size={14} className="text-white/20 group-hover:text-primary/40" />
                        </div>
                        <span className="text-[7px] font-bold text-white/10 uppercase tracking-widest">Vide</span>
                      </div>
                    )}
                  </div>

                  {/* Shelf Label & Level Indicator */}
                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                      <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">{shelf.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-bold text-primary/60 uppercase">Niveau {shelf.level}</span>
                      <div className="w-8 h-0.5 bg-primary/20 rounded-full" />
                    </div>
                  </div>

                  {/* Glass Shelf Line Effect */}
                  <div className="h-[3px] bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full shadow-[0_2px_10px_rgba(255,255,255,0.05)]" />
                </div>
              );
            })}
          </div>
        </section>

        {/* List View */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Détails des niveaux</h2>
          <div className="space-y-3">
            {unitShelves.map((shelf) => (
              <div key={shelf.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    <h3 className="text-xs font-black text-gray-900 uppercase">{shelf.name}</h3>
                  </div>
                  <button className="text-[9px] font-bold text-primary uppercase">Ajouter Bac</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {bacs.filter(b => b.shelfId === shelf.id).map(bac => (
                    <div key={bac.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                      <span className="text-sm">{bac.icon}</span>
                      <span className="text-[10px] font-bold text-gray-700 truncate">{bac.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
