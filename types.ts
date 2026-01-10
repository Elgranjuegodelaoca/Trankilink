
export enum RiskLevel {
  SAFE = 'SAFE',
  SUSPICIOUS = 'SUSPICIOUS',
  DANGEROUS = 'DANGEROUS',
  UNKNOWN = 'UNKNOWN'
}

export interface AnalysisResult {
  url: string;
  riskLevel: RiskLevel;
  score: number; // 0 to 100 (100 is most dangerous)
  summary: string;
  threats: string[];
  recommendations: string[];
  technicalDetails: {
    domainAge?: string;
    protocol: string;
    isIpAddress: boolean;
    hasPunycode: boolean;
  };
}

export interface SecurityTip {
  id: number;
  title: string;
  description: string;
  category: 'contraseñas' | 'navegación' | 'dispositivos' | 'phishing';
  icon: string;
}

export interface ScamNews {
  id: string;
  title: string;
  description: string;
  date: string;
  author: string;
}
