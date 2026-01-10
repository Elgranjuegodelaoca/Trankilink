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
  Layers
} from 'lucide-react';
import { analyzeUrl, getDailySecurityTips, extractUrlFromQr } from './services/geminiService';
import { AnalysisResult, RiskLevel, ScamNews } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// --- Sub-components ---

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const data = [
    { name: 'Riesgo', value: score },
    { name: 'Seguridad', value: 100 - score },
  ];
  const COLORS = [
    score > 70 ? '#ef4444' : score > 30 ? '#f59e0b' : '#10b981',
    '#1e293b'
  ];

  return (
    <div className="h-40 w-40 sm:h-48 sm:w-48 mx-auto relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={5}
            dataKey="value"
            startAngle={180}
            endAngle={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 sm:pt-8">
        <span className="text-2xl sm:text-3xl font-bold tracking-tighter">{score}</span>
        <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase font-black tracking-widest">Riesgo</span>
      </div>
    </div>
  );
};

const Navbar = ({ onAdminClick }: { onAdminClick: () => void }) => (
  <nav className="flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto w-full">
    <div className="flex items-center gap-2 group cursor-pointer">
      <div className="p-1.5 sm:p-2 bg-cyan-500 rounded-lg group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.5)]">
        <ShieldCheck className="text-slate-950 w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <span className="text-lg sm:text-xl font-black tracking-tighter">TRANQUI<span className="text-cyan-400">LINK</span></span>
    </div>
    <div className="flex gap-4 sm:gap-8 items-center">
      <div className="hidden lg:flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-500">
        <a href="#" className="hover:text-cyan-400 transition-colors">Analizador</a>
        <a href="#" className="hover:text-cyan-400 transition-colors">Threat Intel</a>
      </div>
      <button onClick={onAdminClick} className="text-slate-500 hover:text-cyan-400 transition-colors uppercase flex items-center gap-1.5 text-[10px] sm:text-xs font-bold tracking-widest">
        <Lock className="w-3 h-3" /> <span className="hidden sm:inline">Admin</span>
      </button>
      <button className="hidden sm:block px-4 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all">
        Reportar
      </button>
    </div>
  </nav>
);

const StatBadge: React.FC<{ label: string, value: number, colorClass: string, icon: React.ReactNode }> = ({ label, value, colorClass, icon }) => (
  <div className={`glass-effect p-3 sm:p-4 rounded-xl sm:rounded-2xl border-b-2 flex items-center gap-3 sm:gap-4 transition-all hover:-translate-y-1 ${colorClass.replace('text-', 'border-')}/30`}>
    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 ${colorClass}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
    </div>
    <div className="min-w-0">
      <div className="text-xl sm:text-2xl font-black tracking-tighter leading-none truncate">{value}</div>
      <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1 truncate">{label}</div>
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState<'link' | 'qr'>('link');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Admin & Scam News state
  const [scams, setScams] = useState<ScamNews[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newScamTitle, setNewScamTitle] = useState('');
  const [newScamBody, setNewScamBody] = useState('');
  const [adminTab, setAdminTab] = useState<'news' | 'deploy'>('news');

  // Statistics state
  const [stats, setStats] = useState({
    total: 0,
    safe: 0,
    suspicious: 0,
    dangerous: 0
  });

  useEffect(() => {
    getDailySecurityTips().then(setTips);
    const savedScams = localStorage.getItem('tranquilink_scams');
    if (savedScams) {
      setScams(JSON.parse(savedScams));
    } else {
      const defaults: ScamNews[] = [
        { id: '1', title: 'Falso paquete de Correos', description: 'Campaña masiva de SMS indicando una tasa de aduana pendiente. El enlace redirige a una web clonada de Correos.', date: '22 Mayo, 2025', author: 'Admin' },
        { id: '2', title: 'Estafa de inversión en IA', description: 'Plataformas que prometen rentabilidades del 300% usando "trading algorítmico". Al depositar, la cuenta desaparece.', date: '21 Mayo, 2025', author: 'Admin' }
      ];
      setScams(defaults);
      localStorage.setItem('tranquilink_scams', JSON.stringify(defaults));
    }
  }, []);

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

      setStats(prev => ({
        total: prev.total + 1,
        safe: analysis.riskLevel === RiskLevel.SAFE ? prev.safe + 1 : prev.safe,
        suspicious: analysis.riskLevel === RiskLevel.SUSPICIOUS ? prev.suspicious + 1 : prev.suspicious,
        dangerous: analysis.riskLevel === RiskLevel.DANGEROUS ? prev.dangerous + 1 : prev.dangerous
      }));

    } catch (err) {
      setError("No pudimos conectar con las bases de datos. Reintenta pronto.");
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
    if (adminPassword === '9i8u7y*') { 
      setIsAuthorized(true);
    } else {
      alert('Contraseña incorrecta');
    }
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
    setNewScamTitle('');
    setNewScamBody('');
    setIsAdminMode(false);
    setIsAuthorized(false);
    setAdminPassword('');
  };

  const handleDeleteScam = (id: string) => {
    const updatedScams = scams.filter(s => s.id !== id);
    setScams(updatedScams);
    localStorage.setItem('tranquilink_scams', JSON.stringify(updatedScams));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 overflow-x-hidden">
      <Navbar onAdminClick={() => setIsAdminMode(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-20">
        
        {/* Statistics Counter Row - 2x2 on mobile, 1x4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-16">
          <StatBadge 
            label="Analizadas" 
            value={stats.total} 
            colorClass="text-blue-500" 
            icon={<Search />} 
          />
          <StatBadge 
            label="Seguros" 
            value={stats.safe} 
            colorClass="text-emerald-500" 
            icon={<ShieldCheck />} 
          />
          <StatBadge 
            label="Sospechosos" 
            value={stats.suspicious} 
            colorClass="text-amber-500" 
            icon={<AlertTriangle />} 
          />
          <StatBadge 
            label="Peligros" 
            value={stats.dangerous} 
            colorClass="text-rose-500" 
            icon={<ShieldX />} 
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="space-y-6 sm:space-y-10 text-center lg:text-left">
            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]">
                <Globe className="w-3 h-3" /> Inteligencia Activa
              </div>
              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black leading-[1.1] sm:leading-[0.9] tracking-tighter">
                Escudo <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">Digital</span>
              </h1>
              <p className="text-base sm:text-xl text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
                Analizamos cada enlace y código QR cruzando múltiples bases de datos de amenazas en tiempo real.
              </p>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex gap-2 sm:gap-4 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit mx-auto lg:mx-0">
                <button 
                  onClick={() => setScanType('link')}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${scanType === 'link' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <LinkIcon className="w-4 h-4" /> Enlace
                </button>
                <button 
                  onClick={() => setScanType('qr')}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${scanType === 'qr' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <QrCode className="w-4 h-4" /> QR
                </button>
              </div>

              {scanType === 'link' ? (
                <form onSubmit={(e) => {e.preventDefault(); handleScan();}} className="relative group max-w-2xl mx-auto lg:mx-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[1.5rem] sm:rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                  <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-slate-900/80 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] p-2 sm:p-3 border border-slate-800 focus-within:border-cyan-500/50 transition-all gap-2">
                    <div className="flex items-center flex-1">
                      <Search className="ml-3 sm:ml-4 text-slate-500 w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                      <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Introduce URL..."
                        className="w-full bg-transparent border-none focus:ring-0 text-slate-100 px-3 sm:px-4 py-3 sm:py-4 text-sm sm:text-lg placeholder:text-slate-600"
                      />
                    </div>
                    <button 
                      disabled={isScanning}
                      className="px-6 sm:px-10 py-3 sm:py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-black rounded-xl sm:rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 uppercase text-[10px] sm:text-xs tracking-widest"
                    >
                      {isScanning ? 'Analizando...' : 'Escanear'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="relative group max-w-2xl mx-auto lg:mx-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-[1.5rem] sm:rounded-[2rem] blur opacity-20 transition duration-500"></div>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative bg-slate-900/80 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] p-8 sm:p-12 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 text-center group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleQrUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black tracking-tight">Cargar imagen QR</h3>
                      <p className="text-slate-500 text-[10px] sm:text-sm font-medium">Sube una captura o foto de un QR</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-4 sm:gap-8 text-[8px] sm:text-[10px] text-slate-500 font-black uppercase tracking-widest">
              <div className="flex items-center gap-2"><Database className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-500" /> +50 DBs</div>
              <div className="flex items-center gap-2"><Shield className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-500" /> Anti-Quishing</div>
              <div className="flex items-center gap-2"><Cpu className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-500" /> Vision AI v4</div>
            </div>
          </div>

          <div className="relative mt-8 lg:mt-0">
            {isScanning ? (
              <div className="glass-effect rounded-[1.5rem] sm:rounded-[2.5rem] p-8 sm:p-16 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[500px] relative overflow-hidden border-cyan-500/20">
                <div className="scan-line"></div>
                <div className="relative">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 border-[4px] sm:border-[6px] border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin mb-6 sm:mb-10"></div>
                    <Cpu className="absolute inset-0 m-auto w-6 h-6 sm:w-10 sm:h-10 text-cyan-500 animate-pulse" />
                </div>
                <h3 className="text-lg sm:text-2xl font-black mb-2 sm:mb-3 tracking-tight">Escaneando...</h3>
                <p className="text-slate-400 text-center max-w-xs font-medium leading-relaxed text-xs sm:text-sm px-4">
                   Consultando inteligencia de amenazas global y analizando reputación...
                </p>
              </div>
            ) : result ? (
              <div className={`glass-effect rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-10 border-t-[6px] sm:border-t-[8px] transition-all duration-700 ${
                result.riskLevel === RiskLevel.SAFE ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' :
                result.riskLevel === RiskLevel.SUSPICIOUS ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 
                'border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.2)]'
              }`}>
                <div className="flex flex-col items-center gap-6 sm:gap-8 mb-8">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl ${
                        result.riskLevel === RiskLevel.SAFE ? 'bg-emerald-500/10 text-emerald-500' :
                        result.riskLevel === RiskLevel.SUSPICIOUS ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                        {result.riskLevel === RiskLevel.SAFE ? <ShieldCheck className="w-8 h-8 sm:w-12 sm:h-12" /> : 
                         result.riskLevel === RiskLevel.SUSPICIOUS ? <AlertTriangle className="w-8 h-8 sm:w-12 sm:h-12" /> : <ShieldX className="w-8 h-8 sm:w-12 sm:h-12" />}
                    </div>
                    <div>
                      <h3 className={`text-2xl sm:text-4xl font-black tracking-tighter uppercase ${getRiskColor(result.riskLevel)}`}>
                        {result.riskLevel === RiskLevel.SAFE ? 'Seguro' : 
                         result.riskLevel === RiskLevel.SUSPICIOUS ? 'Sospechoso' : 'Peligro'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 break-all max-w-[200px] sm:max-w-xs mx-auto mt-1">{result.url}</p>
                    </div>
                  </div>
                  <RiskGauge score={result.score} />
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900/50 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5">
                    <h4 className="text-[8px] sm:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2 sm:mb-3">Informe IA</h4>
                    <p className="text-slate-300 font-medium leading-relaxed text-xs sm:text-base">{result.summary}</p>
                  </div>
                </div>
              </div>
            ) : (
               <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl h-[300px] sm:h-[500px]">
                    <img 
                    src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000" 
                    alt="Cybersecurity" 
                    className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                </div>
            )}
          </div>
        </div>

        {/* Scam News Section */}
        <div className="mt-24 sm:mt-40 space-y-10 sm:space-y-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase">Alertas <span className="text-rose-500">Recientes</span></h2>
            <button 
              onClick={() => {setIsAdminMode(true); setAdminTab('news');}}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 border border-slate-800 hover:border-rose-500/50 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 text-rose-500 group-hover:rotate-90 transition-transform" /> Noticia
            </button>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {scams.map((scam) => (
                <div key={scam.id} className="glass-effect p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5 hover:border-rose-500/30 transition-all group relative">
                  <div className="flex items-center gap-3 mb-4 sm:mb-6">
                    <div className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-full">Alerta</div>
                    <span className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">{scam.date}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 tracking-tight group-hover:text-rose-500 transition-colors">{scam.title}</h3>
                  <p className="text-slate-400 leading-relaxed font-medium mb-6 sm:mb-8 text-sm sm:text-base">{scam.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 truncate mr-4">Reporte: <span className="text-cyan-500">{scam.author}</span></div>
                    {isAuthorized && (
                      <button onClick={() => handleDeleteScam(scam.id)} className="p-2 text-slate-600 hover:text-rose-500"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>

      {/* Admin Panel Modal */}
      {isAdminMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-sm">
          <div className="glass-effect w-full max-w-lg rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 p-6 sm:p-10 relative shadow-2xl overflow-y-auto max-h-[95vh]">
            <button onClick={() => {setIsAdminMode(false); setIsAuthorized(false);}} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-slate-500 hover:text-white p-2">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            {!isAuthorized ? (
              <form onSubmit={handleAdminLogin} className="space-y-6 sm:space-y-8 py-4">
                <div className="text-center">
                  <Key className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-500 mx-auto mb-4" />
                  <h2 className="text-xl sm:text-2xl font-black uppercase">Acceso Panel</h2>
                  <p className="text-slate-500 text-[10px] sm:text-sm mt-1">Clave maestra: 9i8u7y*</p>
                </div>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white focus:border-cyan-500/50 outline-none text-sm"
                  autoFocus
                />
                <button className="w-full py-3 sm:py-4 bg-cyan-500 text-slate-950 font-black rounded-xl sm:rounded-2xl uppercase tracking-widest text-xs sm:text-sm shadow-xl active:scale-95 transition-transform">Entrar</button>
              </form>
            ) : (
              <div className="space-y-6 sm:space-y-8 py-2">
                <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl">
                  <button onClick={() => setAdminTab('news')} className={`flex-1 py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${adminTab === 'news' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500'}`}>Noticias</button>
                  <button onClick={() => setAdminTab('deploy')} className={`flex-1 py-2 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${adminTab === 'deploy' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500'}`}>Config</button>
                </div>

                {adminTab === 'news' ? (
                  <form onSubmit={handleAddScam} className="space-y-4 sm:space-y-6">
                    <h2 className="text-xl sm:text-2xl font-black uppercase text-rose-500">Nueva Alerta</h2>
                    <input type="text" value={newScamTitle} onChange={(e) => setNewScamTitle(e.target.value)} placeholder="Título del timo..." className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white outline-none text-sm" required />
                    <textarea value={newScamBody} onChange={(e) => setNewScamBody(e.target.value)} placeholder="Detalles de la estafa..." className="w-full bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white outline-none h-24 sm:h-32 resize-none text-sm" required />
                    <button className="w-full py-3 sm:py-4 bg-rose-500 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest text-[10px] sm:text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"><Plus className="w-4 h-4" /> Publicar</button>
                  </form>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="text-center">
                        <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-500 mx-auto mb-2" />
                        <h2 className="text-lg sm:text-xl font-black uppercase">Netlify Deploy</h2>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 mb-1">Paso 1: API_KEY</h4>
                            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">Define <code className="text-cyan-400">API_KEY</code> en las <strong>Environment variables</strong> de Netlify.</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 mb-1">Paso 2: Build</h4>
                            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">El build command es <code className="text-cyan-400">npm run build</code> y el directorio es <code className="text-cyan-400">dist</code>.</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-slate-900 rounded-xl sm:rounded-2xl border border-white/5 border-l-4 border-l-cyan-500">
                            <h4 className="text-[10px] font-black uppercase text-cyan-500 mb-1">Redirecciones</h4>
                            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">El archivo <code className="text-cyan-400">_redirects</code> ya está configurado para que la SPA funcione al refrescar.</p>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="border-t border-white/5 mt-20 sm:mt-40 py-8 sm:py-10 text-center px-6">
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-600">© 2025 Tranquilink Security. Protegiendo tu huella digital.</p>
      </footer>
    </div>
  );
}
