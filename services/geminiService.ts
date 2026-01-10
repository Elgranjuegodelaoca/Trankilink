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
  console.error("Detalle del error de API:", error);
  const message = error?.message || "";
  
  if (message.includes("429") || message.toLowerCase().includes("quota")) {
    throw new Error("Límite de consultas alcanzado. Por favor, espera un minuto antes de intentar otro escaneo.");
  }
  
  if (message.includes("401") || message.includes("403")) {
    throw new Error("Error de autenticación. Revisa la API KEY en la configuración.");
  }

  throw new Error("El servicio de inteligencia está saturado. Reintenta en unos instantes.");
};

export const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key no configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Realiza un escaneo profundo de seguridad para la URL: ${url}. Analiza el dominio, el protocolo y la estructura. Clasifica el riesgo y devuelve JSON.`,
      config: {
        systemInstruction: "Eres un analista senior de ciberseguridad. Devuelve siempre un objeto JSON válido según el esquema proporcionado.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Safety check manual para acortadores
    const shorteners = ['bit.ly', 't.co', 'tinyurl', 'cutt.ly', 'is.gd', 't.me', 'goo.gl'];
    const isShortener = shorteners.some(s => url.toLowerCase().includes(s));
    
    if (isShortener && result.riskLevel !== RiskLevel.DANGEROUS) {
      result.riskLevel = RiskLevel.DANGEROUS;
      result.score = 95;
      result.summary = "Este enlace utiliza un acortador para ocultar el destino real, técnica común en estafas.";
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
        { text: "Extrae únicamente la URL de este código QR. Si no hay, responde 'No URL'." }
      ]
    });
    
    const extracted = response.text?.trim() || '';
    if (extracted.toLowerCase().includes('no url')) {
      throw new Error("No se detectó una URL en este código QR.");
    }
    return extracted;
  } catch (error) {
    return handleApiError(error);
  }
};

export const getDailySecurityTips = async (): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return ["Navega siempre con precaución."];
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera 3 consejos breves de ciberseguridad.",
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [
      "No compartas contraseñas por chat.",
      "Activa la verificación en dos pasos.",
      "Revisa siempre el remitente de los correos."
    ];
  }
};