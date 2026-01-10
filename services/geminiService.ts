import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

const getApiKey = () => {
  return process.env.API_KEY || '';
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: {
      type: Type.STRING,
      description: "Nivel de riesgo: SAFE, SUSPICIOUS, DANGEROUS",
    },
    score: {
      type: Type.NUMBER,
      description: "Puntuación de 0 a 100, donde 100 es lo más peligroso",
    },
    summary: {
      type: Type.STRING,
      description: "Resumen explicativo del análisis detallado en español",
    },
    threats: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de amenazas detectadas",
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Lista de consejos preventivos específicos",
    },
    technicalDetails: {
      type: Type.OBJECT,
      properties: {
        protocol: { type: Type.STRING },
        isIpAddress: { type: Type.BOOLEAN },
        hasPunycode: { type: Type.BOOLEAN },
      },
      required: ["protocol", "isIpAddress", "hasPunycode"]
    }
  },
  required: ["riskLevel", "score", "summary", "threats", "recommendations", "technicalDetails"]
};

const handleApiError = (error: any) => {
  console.error("Detalle completo del error:", error);
  const errorMessage = error?.message || "";
  const status = error?.status;

  // Error 429 es específicamente cuota
  if (status === 429 || errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota")) {
    throw new Error("Límite global de la comunidad alcanzado. El servidor de Google está saturado para esta clave de API. Por favor, reintenta en un par de minutos.");
  }
  
  // Error 400 suele ser por contenido bloqueado o mal formado
  if (status === 400 || errorMessage.includes("400")) {
    throw new Error("La IA no pudo procesar esta URL (puede que contenga términos bloqueados por seguridad).");
  }

  if (errorMessage.includes("API key not valid") || status === 401) {
    throw new Error("La clave de API no es válida o ha sido revocada.");
  }

  throw new Error("Error de conexión con la inteligencia de Tranquilink. Reintenta en unos instantes.");
};

export const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key no configurada en el servidor.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza la seguridad de la URL: ${url}. Determina si es phishing, malware o segura. Devuelve JSON.`,
      config: {
        systemInstruction: "Actúa como un experto en ciberseguridad forense. Analiza URLs buscando patrones de engaño. Devuelve siempre JSON.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Doble verificación para dominios muy sospechosos
    const suspiciousPatterns = ['login', 'verify', 'update-account', 'secure-bank', 'netflix-payment'];
    const lowerUrl = url.toLowerCase();
    if (suspiciousPatterns.some(p => lowerUrl.includes(p)) && result.riskLevel === RiskLevel.SAFE) {
      result.riskLevel = RiskLevel.SUSPICIOUS;
      result.score = Math.max(result.score, 45);
      result.summary += " (Nota: La URL contiene palabras clave usadas frecuentemente en phishing).";
    }

    return {
      url,
      riskLevel: (result.riskLevel as RiskLevel) || RiskLevel.UNKNOWN,
      score: result.score || 0,
      summary: result.summary || "Análisis completado.",
      threats: result.threats || [],
      recommendations: result.recommendations || [],
      technicalDetails: result.technicalDetails || { protocol: 'N/A', isIpAddress: false, hasPunycode: false }
    };
  } catch (error) {
    return handleApiError(error);
  }
};

export const extractUrlFromQr = async (base64Image: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: "image/jpeg" } },
        { text: "Lee el código QR y devuelve SOLO la URL. Si no hay URL, di 'ERROR'." }
      ]
    });
    
    const extracted = response.text?.trim() || '';
    if (extracted.toUpperCase().includes('ERROR') || !extracted.includes('.')) {
      throw new Error("No se detectó una URL válida en la imagen.");
    }
    return extracted;
  } catch (error) {
    return handleApiError(error);
  }
};

export const getDailySecurityTips = async (): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return ["Usa contraseñas robustas."];
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera 3 consejos de ciberseguridad para usuarios normales. Máximo 15 palabras por consejo.",
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    // No lanzamos error aquí para no romper la UI, usamos fallback
    return [
      "Activa siempre la autenticación de dos factores (2FA).",
      "No hagas clic en enlaces de correos electrónicos no solicitados.",
      "Mantén tu sistema operativo y aplicaciones actualizadas."
    ];
  }
};