import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Search, 
  Lock, 
  Info, 
  ChevronRight, 
  AlertTriangle,
  ExternalLink,
  Shield,
  BookOpen,
  Cpu, 
  ArrowRight,
  Globe,
  Database,
  BarChart3,
  Activity,
  QrCode,
  Link as LinkIcon,
  Upload,
  Camera,
  X,
  Newspaper,
  Plus,
  Trash2,
  Key,
  Layers,
  Lightbulb,
  CheckCircle2,
  Copy,
  RefreshCw,
  Settings
} from 'lucide-react';
import { analyzeUrl, getDailySecurityTips, extractUrlFromQr } from './services/geminiService';
import { AnalysisResult, RiskLevel, ScamNews } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Definición de tipos para el entorno global
declare global {
  // Fix: Declare AIStudio interface and Window augmentation with optionality to match environment definitions.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Make aistudio property optional to ensure identical modifiers with existing environment declarations.
    aistudio?: AIStudio;
  }
}

// --- Sub-components ---

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [
    { name: 'Riesgo', value: score },
    { name: 'Seguridad', value: 100 - score },
  ];
  const COLORS = [
    score > 70 ? '#f43f5e' : score > 30 ? '#f59e0b' : '#10b981',
    '#0f172a'
  ];

  return (
    <div className="h-44 w-44 sm:h-52 sm:w-52 mx-auto relative group">
      <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-1000 group-hover:opacity-40 ${score > 70 ? 'bg-rose-500' : score > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            startAngle={225}
            endAngle={-45}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span className="text-4xl sm:text-5xl font-black tracking-tighter tabular-nums">{score}</span>
        <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Índice</span>
      </div>
    </div>
  );
};

const Navbar = ({ onAdminClick, onKeySelect, hasKey }: { onAdminClick: () => void, onKeySelect: () => void, hasKey: boolean }) => (
  <nav className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-white/5">
    <div className="flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
        <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl group-hover:rotate-6 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <ShieldCheck className="text-white w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <span className="text-xl sm:text-2xl font-black tracking-tighter">TRANQUI<span className="text-cyan-400">LINK</span></span>
      </div>
      <div className="flex gap-4 sm:gap-6 items-center">
        <button 
          onClick={onKeySelect}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${hasKey ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{hasKey ? 'API Conectada' : 'Configurar API'}</span>
        </button>
        <button onClick={onAdminClick} className="text-slate-500 hover:text-cyan-400 transition-colors uppercase flex items-center gap-2 text-[10px] font-black tracking-widest">
          <Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Panel Admin</span>
        </button>
      </div>
    </div>
  </nav>
);

export default function App() {
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState<'link' | 'qr'>('link');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scams, setScams] = useState<ScamNews[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newScamTitle, setNewScamTitle] = useState('');
  const [newScamBody, setNewScamBody] = useState('');
  const [adminTab, setAdminTab] = useState<'news' | 'deploy'>('news');

  useEffect(() => {
    const checkKeyStatus = async () => {
      // Fix: Use safe optional check for aistudio property
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPersonalKey(hasKey);
      }
    };
    checkKeyStatus();

    const loadTips = async () => {
      const cached = localStorage.getItem('tranquilink_tips_cache');
      const cacheTimestamp = localStorage.getItem('tranquilink_tips_time');
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      if (cached && cacheTimestamp && (now - parseInt(cacheTimestamp)) < oneDay) {
        setTips(JSON.parse(cached));
      } else {
        try {
          const freshTips = await getDailySecurityTips();
          setTips(freshTips);
          localStorage.setItem('tranquilink_tips_cache', JSON.stringify(freshTips));
          localStorage.setItem('tranquilink_tips_time', now.toString());
        } catch (e) {
          setTips(["Mantén tus contraseñas seguras.", "Activa el 2FA siempre que puedas."]);
        }
      }
    };
    
    loadTips();

    const savedScams = localStorage.getItem('tranquilink_scams');
    if (savedScams) {
      setScams(JSON.parse(savedScams));
    } else {
      setScams([]);
      localStorage.setItem('tranquilink_scams', JSON.stringify([]));
    }
  }, []);

  const handleKeySelection = async () => {
    // Fix: Add safety check for optional aistudio property access
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Rule: Assume key selection was successful and proceed.
        setHasPersonalKey(true);
        setError(null);
      } catch (e) {
        console.error("Error al seleccionar clave:", e);
      }
    }
  };

  const handleScan = async (targetUrl?: string) => {
    const urlToAnalyze = targetUrl || url;
    if (!urlToAnalyze.trim()) return;

    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      let formattedUrl = urlToAnalyze.trim();
      if (!formattedUrl.startsWith('http')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      const analysis = await analyzeUrl(formattedUrl);
      setResult(analysis);

    } catch (err: any) {
      setError(err.message || "Error inesperado.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const extractedUrl = await extractUrlFromQr(base64);
          setUrl(extractedUrl);
          await handleScan(extractedUrl);
        } catch (err: any) {
          setError(err.message || "No se pudo leer el QR.");
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error al procesar la imagen.");
      setIsScanning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado al portapapeles');
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.SAFE: return 'text-emerald-400';
      case RiskLevel.SUSPICIOUS: return 'text-amber-400';
      case RiskLevel.DANGEROUS: return 'text-rose-500';
      default: return 'text-slate-400';
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '9i8u7y') setIsAuthorized(true);
    else alert('Contraseña incorrecta');
  };

  const handleAddScam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScamTitle || !newScamBody) return;
    const newScam: ScamNews = {
      id: Date.now().toString(),
      title: newScamTitle,
      description: newScamBody,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      author: 'Admin'
    };
    const updatedScams = [newScam, ...scams];
    setScams(updatedScams);
    localStorage.setItem('tranquilink_scams', JSON.stringify(updatedScams));
    setNewScamTitle(''); setNewScamBody(''); setIsAdminMode(false); setIsAuthorized(false); setAdminPassword('');
  };

  const handleDeleteScam = (id: string) => {
    const updatedScams = scams.filter(s => s.id !== id);
    setScams(updatedScams);
    localStorage.setItem('tranquilink_scams', JSON.stringify(updatedScams));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 overflow-x-hidden">
      <Navbar onAdminClick={() => setIsAdminMode(true)} onKeySelect={handleKeySelection} hasKey={hasPersonalKey} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        
        {/* Hero Section */}
        <section id="analizador" className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center mb-24">
          <div className="space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/5 border border-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
                <Globe className="w-4 h-4" /> Inteligencia de Red Activa
              </div>
              <h1 className="text-5xl sm:text-7xl lg:text-[100px] font-black leading-[0.9] tracking-tighter">
                Tu Escudo <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">Total</span>
              </h1>
              <p className="text-lg sm:text-2xl text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Analizamos cada bit de tus enlaces y códigos QR buscando patrones de fraude antes de que hagas clic.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-slate-900/50 border border-slate-800 rounded-2xl w-fit mx-auto lg:mx-0 backdrop-blur-sm">
                <button onClick={() => setScanType('link')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scanType === 'link' ? 'bg-white text-slate-950 shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}><LinkIcon className="w-4 h-4" /> Enlace</button>
                <button onClick={() => setScanType('qr')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scanType === 'qr' ? 'bg-white text-slate-950 shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}><QrCode className="w-4 h-4" /> Código QR</button>
              </div>

              {scanType === 'link' ? (
                <form onSubmit={(e) => {e.preventDefault(); handleScan();}} className="relative group max-w-2xl mx-auto lg:mx-0">
                  <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[2rem] blur-xl opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
                  <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-3 border border-slate-800 focus-within:border-cyan-500/50 transition-all gap-3">
                    <div className="flex items-center flex-1 min-w-0">
                      <Search className="ml-4 text-slate-500 w-6 h-6 flex-shrink-0" />
                      <input 
                        type="text" 
                        value={url} 
                        onChange={(e) => setUrl(e.target.value)} 
                        placeholder="Pega aquí el enlace sospechoso..." 
                        className="w-full bg-transparent border-none focus:ring-0 text-slate-100 px-4 py-4 text-lg placeholder:text-slate-600 font-medium" 
                      />
                    </div>
                    <button disabled={isScanning} className="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-black rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-[0.1em]">
                      {isScanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Analizar'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {error && (
                    <div className="mt-4 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <p className="text-rose-500 text-sm font-bold leading-tight">{error}</p>
                      </div>
                      {(error.includes("cuota") || error.includes("Límite")) && (
                        <button 
                          onClick={handleKeySelection}
                          className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-rose-600 transition-colors whitespace-nowrap"
                        >
                          Usar mi propia clave
                        </button>
                      )}
                    </div>
                  )}
                </form>
              ) : (
                <div className="relative group max-w-2xl mx-auto lg:mx-0">
                  <div onClick={() => fileInputRef.current?.click()} className="relative bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-12 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-6 text-center group overflow-hidden">
                    <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors"></div>
                    <input type="file" ref={fileInputRef} onChange={handleQrUpload} accept="image/*" className="hidden" />
                    <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                      <Upload className="w-10 h-10" />
                    </div>
                    <div className="z-10">
                      <h3 className="text-2xl font-black tracking-tight mb-1">Escanear Imagen QR</h3>
                      <p className="text-slate-500 text-sm font-medium">Sube una captura de pantalla o foto del QR</p>
                    </div>
                  </div>
                  {error && (
                    <div className="mt-4 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-rose-500 text-sm font-bold text-center lg:text-left">{error}</p>
                      {(error.includes("cuota") || error.includes("Límite")) && (
                        <button onClick={handleKeySelection} className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Configurar Clave Personal</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            {isScanning ? (
              <div className="glass-effect rounded-[3rem] p-16 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden border-cyan-500/20 shadow-2xl">
                <div className="scan-line"></div>
                <div className="relative">
                    <div className="w-32 h-32 border-[6px] border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin mb-10"></div>
                    <Cpu className="absolute inset-0 m-auto w-12 h-12 text-cyan-500 animate-pulse" />
                </div>
                <h3 className="text-3xl font-black mb-4 tracking-tighter">Procesando...</h3>
                <p className="text-slate-400 text-center max-w-xs font-medium leading-relaxed">Cruzando datos con bases de datos de malware y phishing global...</p>
              </div>
            ) : result ? (
              <div className={`glass-effect rounded-[3rem] p-8 sm:p-12 border-t-[8px] transition-all duration-1000 animate-in zoom-in-95 shadow-2xl ${result.riskLevel === RiskLevel.SAFE ? 'border-emerald-500' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'border-amber-500' : 'border-rose-600'}`}>
                <div className="flex flex-col items-center gap-10">
                  <div className="flex flex-col items-center gap-6 text-center w-full">
                    <div className={`p-6 rounded-[2rem] shadow-xl ${result.riskLevel === RiskLevel.SAFE ? 'bg-emerald-500/10 text-emerald-500' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {result.riskLevel === RiskLevel.SAFE ? <ShieldCheck className="w-16 h-16" /> : result.riskLevel === RiskLevel.SUSPICIOUS ? <AlertTriangle className="w-16 h-16" /> : <ShieldX className="w-16 h-16" />}
                    </div>
                    <div className="w-full">
                      <h3 className={`text-4xl sm:text-5xl font-black tracking-tighter uppercase mb-2 ${getRiskColor(result.riskLevel)}`}>
                        {result.riskLevel === RiskLevel.SAFE ? 'Totalmente Seguro' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'Extrema Cautela' : '¡Acceso Bloqueado!'}
                      </h3>
                      <div className="flex items-center justify-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(result.url)}>
                        <p className="text-xs font-black text-slate-500 break-all max-w-xs truncate">{result.url}</p>
                        <Copy className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-8 w-full">
                    <RiskGauge score={result.score} />
                    <div className="space-y-6">
                       <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Informe del Analista</h4>
                        <p className="text-slate-200 font-medium leading-relaxed text-sm">{result.summary}</p>
                      </div>
                      
                      {result.threats.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">Amenazas Detectadas</h4>
                          <div className="flex flex-wrap gap-2">
                            {result.threats.map((t, i) => (
                              <span key={i} className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full space-y-4">
                     <h4 className="text-[10px] font-black uppercase text-cyan-500 tracking-[0.2em] border-b border-white/5 pb-2">Recomendaciones de Seguridad</h4>
                     <ul className="grid sm:grid-cols-2 gap-3">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-xs font-medium text-slate-400 bg-white/5 p-3 rounded-xl border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" /> {rec}
                          </li>
                        ))}
                     </ul>
                  </div>

                  <button onClick={() => setResult(null)} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-colors flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" /> Realizar nuevo escaneo
                  </button>
                </div>
              </div>
            ) : (
               <div className="relative overflow-hidden rounded-[3rem] border border-white/10 shadow-2xl h-[400px] lg:h-[600px] group">
                    <img src="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1200" alt="Cybersecurity" className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-[5s]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    
                    {/* Floating HUD elements for flavor */}
                    <div className="absolute top-10 left-10 p-4 glass-effect rounded-2xl border-cyan-500/20 animate-bounce duration-[3s]">
                      <Activity className="w-8 h-8 text-cyan-500" />
                    </div>

                    <div className="absolute bottom-10 left-10 right-10 p-8 glass-effect rounded-[2rem] border-cyan-500/10 backdrop-blur-xl">
                      <div className="flex items-center gap-3 mb-4 text-cyan-400 text-[11px] font-black uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
                        Consejo de Seguridad
                      </div>
                      <p className="text-slate-100 text-lg font-bold leading-snug">
                        {tips.length > 0 ? tips[Math.floor(Math.random() * tips.length)] : "Nunca compartas tus credenciales en enlaces recibidos por SMS."}
                      </p>
                    </div>
                </div>
            )}
          </div>
        </section>

        {/* Scam Alerts Section - Full Width */}
        <section id="alertas" className="space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase">Alertas <span className="text-rose-500">Globales</span></h2>
              <p className="text-slate-500 text-sm font-medium">Informes de estafas detectadas por la comunidad y verificadas.</p>
            </div>
            <button onClick={() => {setIsAdminMode(true); setAdminTab('news');}} className="px-6 py-4 bg-slate-900 border border-slate-800 hover:border-rose-500/50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 group"><Plus className="w-5 h-5 text-rose-500 group-hover:rotate-90 transition-transform" /> Publicar Alerta</button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {scams.map((scam) => (
                <div key={scam.id} className="glass-effect p-8 rounded-[2.5rem] border border-white/5 hover:border-rose-500/30 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <Newspaper className="w-12 h-12 text-white/5 group-hover:text-rose-500/10 transition-colors" />
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-full">Reporte</div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest tabular-nums">{scam.date}</span>
                  </div>
                  <h3 className="text-2xl font-black mb-4 tracking-tight group-hover:text-rose-500 transition-colors">{scam.title}</h3>
                  <p className="text-slate-400 leading-relaxed font-medium mb-8 text-sm line-clamp-3">{scam.description}</p>
                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 truncate mr-4">Analista: <span className="text-cyan-500">{scam.author}</span></div>
                    {isAuthorized && (<button onClick={() => handleDeleteScam(scam.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5" /></button>)}
                  </div>
                </div>
              ))}
            {scams.length === 0 && (
              <div className="col-span-full py-24 text-center glass-effect rounded-[3rem] border-dashed border-white/10 space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-500 tracking-tight">Zona Segura</h4>
                  <p className="text-slate-600 text-sm font-medium italic">No se han registrado nuevas alertas de seguridad hoy.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Admin Modal */}
      {isAdminMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="glass-effect w-full max-w-xl rounded-[3rem] border border-white/10 p-8 sm:p-12 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => {setIsAdminMode(false); setIsAuthorized(false);}} className="absolute top-8 right-8 text-slate-500 hover:text-white p-2 transition-colors"><X className="w-6 h-6" /></button>
            
            {!isAuthorized ? (
              <form onSubmit={handleAdminLogin} className="space-y-10 py-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-cyan-400">
                    <Key className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Área Restringida</h2>
                  <p className="text-slate-500 text-sm font-medium mt-2">Identifíquese como personal de seguridad</p>
                </div>
                <div className="space-y-4">
                   <input 
                    type="password" 
                    value={adminPassword} 
                    onChange={(e) => setAdminPassword(e.target.value)} 
                    placeholder="Introducir Código de Acceso" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 text-white focus:border-cyan-500/50 outline-none text-center tracking-[0.5em] font-black text-xl placeholder:tracking-normal placeholder:font-bold placeholder:text-sm" 
                    autoFocus 
                  />
                  <button className="w-full py-5 bg-cyan-500 text-slate-950 font-black rounded-2xl uppercase tracking-[0.2em] text-sm shadow-2xl active:scale-95 transition-all">Acceder al Núcleo</button>
                </div>
              </form>
            ) : (
              <div className="space-y-10 py-4">
                <div className="flex gap-2 p-1 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-sm">
                  <button onClick={() => setAdminTab('news')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'news' ? 'bg-white text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-500'}`}>Gestión Alertas</button>
                  <button onClick={() => setAdminTab('deploy')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'deploy' ? 'bg-cyan-500 text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-500'}`}>Configuración</button>
                </div>

                {adminTab === 'news' ? (
                  <form onSubmit={handleAddScam} className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase text-rose-500 tracking-tight">Nueva Noticia de Seguridad</h2>
                      <p className="text-slate-500 text-xs font-medium">Esta información será visible para todos los usuarios inmediatamente.</p>
                    </div>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        value={newScamTitle} 
                        onChange={(e) => setNewScamTitle(e.target.value)} 
                        placeholder="Título de la alerta (ej: Estafa Bizum...)" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-rose-500/50 font-bold" 
                        required 
                      />
                      <textarea 
                        value={newScamBody} 
                        onChange={(e) => setNewScamBody(e.target.value)} 
                        placeholder="Describe detalladamente cómo funciona este timo..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none h-40 resize-none font-medium text-sm leading-relaxed focus:border-rose-500/50" 
                        required 
                      />
                    </div>
                    <button className="w-full py-5 bg-rose-500 text-white font-black rounded-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                      <Plus className="w-5 h-5" /> Publicar en el Tablón
                    </button>
                  </form>
                ) : (
                  <div className="space-y-8">
                    <div className="text-center">
                      <Layers className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
                      <h2 className="text-2xl font-black uppercase tracking-tight">Infraestructura</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 group hover:border-cyan-500/30 transition-colors">
                          <h4 className="text-[11px] font-black uppercase text-slate-500 mb-2 tracking-widest flex items-center gap-2"><Key className="w-3.5 h-3.5" /> Clave Gemini API</h4>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium">Puedes usar una clave personal de Google Cloud para evitar límites globales.</p>
                          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-cyan-400 underline mt-2 block">Documentación de facturación (Free Tier disponible)</a>
                        </div>
                        <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 group hover:border-cyan-500/30 transition-colors">
                          <h4 className="text-[11px] font-black uppercase text-slate-500 mb-2 tracking-widest flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Persistencia Local</h4>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium">Utiliza LocalStorage para el almacenamiento inmediato de alertas en este cliente.</p>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="border-t border-white/5 py-12 text-center px-6 mt-24">
          <div className="flex justify-center gap-6 mb-8 text-slate-700">
            <Shield className="w-6 h-6" />
            <Database className="w-6 h-6" />
            <Globe className="w-6 h-6" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 mb-2">© 2025 Tranquilink Cybersecurity Engine</p>
          <p className="text-[9px] font-bold text-slate-700 max-w-md mx-auto leading-relaxed">Protección proactiva basada en inteligencia artificial de última generación. Navega con la tranquilidad que mereces.</p>
      </footer>
    </div>
  );
}
