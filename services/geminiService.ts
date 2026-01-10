
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

// Always use the API key directly from process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Realiza un escaneo profundo de seguridad para la URL: ${url}. 
      
      INSTRUCCIONES CRÍTICAS:
      1. Utiliza la herramienta de búsqueda para consultar bases de datos de reputación, reportes de phishing recientes y listas negras de ciberseguridad.
      2. REGLA DE ORO: Si el enlace es un acortador de URLs (ej: bit.ly, t.co, tinyurl, cutt.ly, is.gd, etc.), clasifícalo automáticamente como DANGEROUS o SUSPICIOUS con una puntuación superior a 85. Justifica que los acortadores ocultan el destino final y son un vector común de ataques.
      3. Analiza si hay discrepancias entre el texto del enlace y el dominio real.
      4. Verifica si el dominio es de creación reciente o si suplanta marcas conocidas.`,
      config: {
        systemInstruction: "Eres un analista senior de ciberseguridad con acceso a inteligencia de amenazas global. Tu misión es proteger al usuario detectando incluso las amenazas más sutiles. Eres extremadamente estricto. Si no puedes verificar la seguridad absoluta de un enlace (como en el caso de los acortadores), debes advertir al usuario con alta severidad.",
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const result = JSON.parse(response.text);
    
    // Safety check: ensure if it's a known shortener, we force dangerous if AI was too lenient
    const shorteners = ['bit.ly', 't.co', 'tinyurl', 'cutt.ly', 'is.gd', 'buff.ly', 'ow.ly', 't.me', 'rebrand.ly', 'goo.gl', 'qr.net'];
    const isShortener = shorteners.some(s => url.toLowerCase().includes(s));
    
    if (isShortener && result.riskLevel !== RiskLevel.DANGEROUS) {
      result.riskLevel = RiskLevel.DANGEROUS;
      result.score = Math.max(result.score, 90);
      result.threats.push("Uso de acortador de URL (Ocultación de destino)");
      result.summary = "Este enlace utiliza un servicio de acortamiento. Tranquilink clasifica estos enlaces como peligrosos por defecto ya que ocultan el destino final, una táctica estándar en campañas de phishing y malware (Quishing).";
    }

    return {
      url,
      ...result,
      riskLevel: result.riskLevel as RiskLevel
    };
  } catch (error) {
    console.error("Error analyzing URL:", error);
    throw new Error("Error en el motor de análisis. Por favor, verifica la conexión.");
  }
};

export const extractUrlFromQr = async (base64Image: string): Promise<string> => {
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
    console.error("Error extracting QR URL:", error);
    throw new Error("No pudimos leer el código QR. Asegúrate de que la imagen sea clara.");
  }
};

export const getDailySecurityTips = async (): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera 3 consejos de ciberseguridad avanzados y específicos para evitar fraudes online hoy.",
      config: {
        systemInstruction: "Eres un experto en prevención de fraude digital. Proporciona consejos técnicos pero comprensibles.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return [
      "Nunca hagas clic en enlaces acortados de fuentes desconocidas; usa siempre un expansor de URLs primero.",
      "Verifica que el remitente de un correo coincida exactamente con el dominio oficial de la empresa.",
      "El 'Quishing' (phishing vía QR) está en aumento. Escanea códigos QR solo de fuentes físicas verificadas."
    ];
  }
};
