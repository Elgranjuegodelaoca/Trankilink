
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
  Rocket,
  HelpCircle
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
      <button onClick={onAdminClick} className="text-slate-500 hover:text-cyan-400 transition-colors uppercase flex items-center gap-1.5 text-[10px] sm:text-xs font-bold tracking-widest">
        <Lock className="w-3 h-3" /> <span className="hidden sm:inline">Admin</span>
      </button>
      <button className="hidden sm:block px-4 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all">
        Soporte
      </button>
    </div>
  </nav>
);

const StatBadge: React.FC<{ label: string, value: number, colorClass: string, icon: React.ReactNode }> = ({ label, value, colorClass, icon }) => (
  <div className={`glass-effect p-3 sm:p-4 rounded-xl sm:rounded-2xl border-b-2 flex items-center gap-3 sm:gap-4 transition-all hover:-translate-y-1 ${colorClass.replace('text-', 'border-')}/30`}>
    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-900 ${colorClass}`}>
      {/* Fix: use isValidElement and proper cast to any to resolve className property error in cloneElement */}
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4 sm:w-5 sm:h-5' }) : icon}
    </div>
    <div className="min-w-0">
      <div className="text-xl sm:text-2xl font-black tracking-tighter leading-none truncate">{value}</div>
      <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1 truncate">{label}</div>
    </div>
  </div>
);

export default function App() {
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState<'link' | 'qr'>('link');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scams, setScams] = useState<ScamNews[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newScamTitle, setNewScamTitle] = useState('');
  const [newScamBody, setNewScamBody] = useState('');
  const [adminTab, setAdminTab] = useState<'news' | 'deploy'>('news');

  const [stats, setStats] = useState({ total: 0, safe: 0, suspicious: 0, dangerous: 0 });

  useEffect(() => {
    const savedScams = localStorage.getItem('tranquilink_scams');
    if (savedScams) {
      setScams(JSON.parse(savedScams));
    } else {
      const defaults: ScamNews[] = [
        { id: '1', title: 'Falso paquete de Correos', description: 'Campaña masiva de SMS indicando una tasa de aduana pendiente.', date: '22 Mayo, 2025', author: 'Admin' },
        { id: '2', title: 'Estafa Inversión IA', description: 'Plataformas que prometen rentabilidades imposibles usando IA.', date: '21 Mayo, 2025', author: 'Admin' }
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
      if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;
      const analysis = await analyzeUrl(formattedUrl);
      setResult(analysis);
      setStats(prev => ({
        total: prev.total + 1,
        safe: analysis.riskLevel === RiskLevel.SAFE ? prev.safe + 1 : prev.safe,
        suspicious: analysis.riskLevel === RiskLevel.SUSPICIOUS ? prev.suspicious + 1 : prev.suspicious,
        dangerous: analysis.riskLevel === RiskLevel.DANGEROUS ? prev.dangerous + 1 : prev.dangerous
      }));
    } catch (err) {
      setError("Error de conexión. Verifica la configuración del motor.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const extractedUrl = await extractUrlFromQr(base64);
        setUrl(extractedUrl);
        await handleScan(extractedUrl);
      } catch (err: any) {
        setError(err.message);
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '9i8u7y*') setIsAuthorized(true);
    else alert('Contraseña incorrecta');
  };

  const handleAddScam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScamTitle || !newScamBody) return;
    const newScam = {
      id: Date.now().toString(),
      title: newScamTitle,
      description: newScamBody,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
      author: 'Admin'
    };
    const updated = [newScam, ...scams];
    setScams(updated);
    localStorage.setItem('tranquilink_scams', JSON.stringify(updated));
    setNewScamTitle(''); setNewScamBody('');
    setIsAdminMode(false); setIsAuthorized(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 overflow-x-hidden">
      <Navbar onAdminClick={() => setIsAdminMode(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-12">
          <StatBadge label="Analizadas" value={stats.total} colorClass="text-blue-500" icon={<Search />} />
          <StatBadge label="Seguros" value={stats.safe} colorClass="text-emerald-500" icon={<ShieldCheck />} />
          <StatBadge label="Dudosos" value={stats.suspicious} colorClass="text-amber-500" icon={<AlertTriangle />} />
          <StatBadge label="Peligros" value={stats.dangerous} colorClass="text-rose-500" icon={<ShieldX />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="space-y-6 sm:space-y-10 text-center lg:text-left">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black leading-tight tracking-tighter">
                Escudo <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">Digital</span>
              </h1>
              <p className="text-base sm:text-xl text-slate-400 max-w-lg mx-auto lg:mx-0 font-medium">
                Pega cualquier enlace o sube un código QR. Nuestra IA analizará el riesgo antes de que hagas clic.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit mx-auto lg:mx-0">
                <button onClick={() => setScanType('link')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scanType === 'link' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500'}`}>Enlace</button>
                <button onClick={() => setScanType('qr')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${scanType === 'qr' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500'}`}>QR</button>
              </div>

              {scanType === 'link' ? (
                <form onSubmit={(e) => {e.preventDefault(); handleScan();}} className="relative group max-w-2xl mx-auto lg:mx-0">
                  <div className="relative flex flex-col sm:flex-row items-stretch bg-slate-900/80 backdrop-blur-xl rounded-[1.2rem] p-2 border border-slate-800 focus-within:border-cyan-500/50 transition-all gap-2">
                    <div className="flex items-center flex-1">
                      <Search className="ml-3 text-slate-500 w-5 h-5" />
                      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ej: bit.ly/promo-fake..." className="w-full bg-transparent border-none focus:ring-0 text-slate-100 px-3 py-3 text-sm sm:text-lg" />
                    </div>
                    <button disabled={isScanning} className="px-6 py-3 bg-cyan-500 text-slate-950 font-black rounded-xl transition-all active:scale-95 uppercase text-[10px] tracking-widest">{isScanning ? 'Analizando...' : 'Escanear'}</button>
                  </div>
                </form>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="relative bg-slate-900/80 backdrop-blur-xl rounded-[1.2rem] p-8 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer text-center mx-auto lg:mx-0 max-w-2xl">
                  <input type="file" ref={fileInputRef} onChange={handleQrUpload} accept="image/*" className="hidden" />
                  <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <h3 className="text-lg font-black">Subir QR</h3>
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            {isScanning ? (
              <div className="glass-effect rounded-[1.5rem] p-12 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[450px] relative overflow-hidden">
                <div className="scan-line"></div>
                <div className="w-20 h-20 border-[4px] border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="mt-6 text-cyan-400 font-black uppercase text-xs tracking-widest">Consultando Amenazas...</p>
              </div>
            ) : result ? (
              <div className={`glass-effect rounded-[1.5rem] p-6 sm:p-10 border-t-[6px] transition-all ${result.riskLevel === RiskLevel.SAFE ? 'border-emerald-500' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'border-amber-500' : 'border-rose-600'}`}>
                <div className="flex flex-col items-center gap-6 mb-8">
                  <h3 className={`text-2xl sm:text-4xl font-black uppercase text-center ${result.riskLevel === RiskLevel.SAFE ? 'text-emerald-400' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'text-amber-400' : 'text-rose-500'}`}>
                    {result.riskLevel === RiskLevel.SAFE ? 'Seguro' : result.riskLevel === RiskLevel.SUSPICIOUS ? 'Sospechoso' : 'Peligro'}
                  </h3>
                  <RiskGauge score={result.score} />
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                  <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 overflow-hidden h-[300px] sm:h-[450px]">
                <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover opacity-40" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-24 space-y-8">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Últimos <span className="text-rose-500">Fraudes</span></h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {scams.map(scam => (
              <div key={scam.id} className="glass-effect p-6 rounded-2xl border border-white/5 hover:border-rose-500/20 transition-all">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">{scam.date}</div>
                <h3 className="text-xl font-black mb-2">{scam.title}</h3>
                <p className="text-slate-400 text-sm">{scam.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Admin Panel */}
      {isAdminMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="glass-effect w-full max-w-lg rounded-2xl p-6 sm:p-10 relative">
            <button onClick={() => {setIsAdminMode(false); setIsAuthorized(false);}} className="absolute top-4 right-4 text-slate-500"><X /></button>
            {!isAuthorized ? (
              <form onSubmit={handleAdminLogin} className="space-y-6 py-4 text-center">
                <Key className="w-12 h-12 text-cyan-500 mx-auto" />
                <h2 className="text-xl font-black">Panel de Control</h2>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Contraseña Admin" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white" />
                <button className="w-full py-3 bg-cyan-500 text-slate-950 font-black rounded-xl uppercase text-xs">Entrar</button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-slate-900 rounded-xl">
                  <button onClick={() => setAdminTab('news')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${adminTab === 'news' ? 'bg-white text-black' : 'text-slate-500'}`}>Noticias</button>
                  <button onClick={() => setAdminTab('deploy')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${adminTab === 'deploy' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}>Despliegue</button>
                </div>

                {adminTab === 'news' ? (
                  <form onSubmit={handleAddScam} className="space-y-4">
                    <input type="text" value={newScamTitle} onChange={(e) => setNewScamTitle(e.target.value)} placeholder="Título del Timo" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm" required />
                    <textarea value={newScamBody} onChange={(e) => setNewScamBody(e.target.value)} placeholder="Explicación..." className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm h-24 resize-none" required />
                    <button className="w-full py-3 bg-rose-500 text-white font-black rounded-xl uppercase text-xs">Publicar Alerta</button>
                  </form>
                ) : (
                  <div className="space-y-4 text-center">
                    <Rocket className="w-10 h-10 text-cyan-500 mx-auto" />
                    <h3 className="font-black uppercase">Guía de Despliegue</h3>
                    <div className="text-left space-y-3">
                      <div className="p-3 bg-slate-900 rounded-lg text-xs">
                        <p className="font-bold text-cyan-400">1. Repositorio</p>
                        <p>Sube el código a tu plataforma de control de versiones preferida.</p>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg text-xs">
                        <p className="font-bold text-cyan-400">2. Conexión</p>
                        <p>Conecta el repositorio a tu servicio de hosting estático.</p>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg text-xs border-l-4 border-cyan-500">
                        <p className="font-bold text-cyan-400">3. Variables de Entorno</p>
                        <p>Asegúrate de configurar las credenciales necesarias en el entorno de ejecución de tu servidor.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="py-10 text-center opacity-30 text-[8px] font-black uppercase tracking-widest">
        © 2025 Tranquilink Security. Protegiendo la red.
      </footer>
    </div>
  );
}
