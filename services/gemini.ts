import { GoogleGenAI } from "@google/genai";
import { UploadedImage } from "../types";

const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateImageEdit = async (
  prompt: string,
  sourceImages: UploadedImage[]
): Promise<string> => {
  const ai = createClient();

  // Prepare parts: Images followed by the prompt
  const parts: any[] = sourceImages.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64,
    },
  }));

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: parts,
      },
      config: {
        // No specific responseMimeType for image generation models in this context usually, 
        // but looking for inlineData in response.
      },
    });

    // Parse response for image
    if (response.candidates && response.candidates.length > 0) {
      const content = response.candidates[0].content;
      if (content && content.parts) {
        for (const part of content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
    }

    throw new Error("No image data found in the response.");
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate image.");
  }
};