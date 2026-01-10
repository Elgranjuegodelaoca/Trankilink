import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

// Netlify inyectará esto durante el build si se configura en el panel de Environment Variables
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
      description: "Lista de amenazas detectadas (ej: Phishing, Malware, Acortador no transparente, etc.)",
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

export const analyzeUrl = async (url: string): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key no configurada. Configúrala en el panel de Netlify.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Realiza un escaneo profundo de seguridad para la URL: ${url}. 
      
      INSTRUCCIONES:
      1. Analiza el dominio, el protocolo y la estructura de la URL.
      2. Si el enlace es un acortador de URLs (ej: bit.ly, t.co, tinyurl, cutt.ly, etc.), clasifícalo como DANGEROUS ya que ocultan el destino.
      3. Busca señales de suplantación de identidad (typosquatting).
      4. Clasifica el riesgo y devuelve el JSON según el esquema.`,
      config: {
        systemInstruction: "Eres un analista senior de ciberseguridad. Tu misión es detectar amenazas en URLs. Eres muy estricto y priorizas la seguridad del usuario. Devuelve siempre un objeto JSON válido.",
        // Se elimina googleSearch porque no garantiza salida JSON según la documentación.
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    // Safety check manual para acortadores comunes por si la IA es indulgente
    const shorteners = ['bit.ly', 't.co', 'tinyurl', 'cutt.ly', 'is.gd', 'buff.ly', 'ow.ly', 't.me', 'rebrand.ly', 'goo.gl', 'qr.net'];
    const isShortener = shorteners.some(s => url.toLowerCase().includes(s));
    
    if (isShortener && result.riskLevel !== RiskLevel.DANGEROUS) {
      result.riskLevel = RiskLevel.DANGEROUS;
      result.score = Math.max(result.score || 0, 90);
      result.threats = result.threats || [];
      result.threats.push("Uso de acortador de URL (Ocultación de destino)");
      result.summary = "Este enlace utiliza un servicio de acortamiento que oculta el destino final, una táctica estándar en ataques de phishing.";
    }

    return {
      url,
      riskLevel: (result.riskLevel as RiskLevel) || RiskLevel.UNKNOWN,
      score: result.score || 0,
      summary: result.summary || "No se pudo generar un resumen.",
      threats: result.threats || [],
      recommendations: result.recommendations || [],
      technicalDetails: result.technicalDetails || { protocol: 'N/A', isIpAddress: false, hasPunycode: false }
    };
  } catch (error) {
    console.error("Error en analyzeUrl:", error);
    throw error;
  }
};

export const extractUrlFromQr = async (base64Image: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image.split(',')[1] || base64Image,
            mimeType: "image/jpeg"
          }
        },
        { text: "Extrae únicamente la URL contenida en este código QR. Si no hay URL, indica 'No URL found'. Responde solo con la URL plana." }
      ]
    });
    
    const extracted = response.text?.trim() || '';
    if (extracted.toLowerCase().includes('no url')) {
      throw new Error("No se detectó una URL válida en la imagen.");
    }
    return extracted;
  } catch (error) {
    console.error("Error en extractUrlFromQr:", error);
    throw new Error("No se pudo leer el QR.");
  }
};

export const getDailySecurityTips = async (): Promise<string[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return ["Configura tu API_KEY para recibir consejos actualizados."];
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera 3 consejos breves de ciberseguridad para hoy.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [
      "No compartas tus contraseñas con nadie.",
      "Activa siempre la autenticación de dos factores (2FA).",
      "Desconfía de enlaces que prometen premios increíbles."
    ];
  }
};