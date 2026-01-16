import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

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

// Handle API errors following the strict guidelines for API key management and quota limits.
const handleApiError = (error: any) => {
  console.error("Detalle completo del error:", error);
  const errorMessage = error?.message || "";
  const status = error?.status;

  // Rule: If request fails with 'Requested entity was not found', inform user to re-select key.
  if (errorMessage.includes("Requested entity was not found.")) {
    throw new Error("Clave de API no válida o proyecto sin facturación. Por favor, selecciona una clave de un proyecto con facturación habilitada en el menú superior.");
  }

  if (status === 429 || errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota")) {
    throw new Error("Límite de cuota alcanzado. Para continuar analizando sin esperas, configura tu propia clave API personal desde el botón superior.");
  }
  
  if (status === 400 || errorMessage.includes("400")) {
    throw new Error("La IA no pudo procesar esta URL por restricciones de seguridad o formato inválido.");
  }

  if (errorMessage.includes("API key not valid") || status === 401) {
    throw new Error("La clave de API actual no es válida. Por favor, selecciona una nueva.");
  }

  throw new Error("Error de conexión con la inteligencia de Tranquilink. Reintenta en unos instantes.");
};

export const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
  // Always create a fresh instance with the environment API key to avoid stale key issues.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

    // Extract text from response using the .text property directly.
    const result = JSON.parse(response.text || "{}");
    
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // multimodal input handling using correct parts structure.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: "image/jpeg" } },
          { text: "Lee el código QR y devuelve SOLO la URL. Si no hay URL, di 'ERROR'." }
        ]
      }
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    return [
      "Activa siempre la autenticación de dos factores (2FA).",
      "No hagas clic en enlaces de correos electrónicos no solicitados.",
      "Mantén tu sistema operativo y aplicaciones actualizadas."
    ];
  }
};
