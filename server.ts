import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Volcengine Ark API Proxy
  app.post("/api/generate", async (req, res) => {
    const { prompt, model, resolution, ratio, duration, images, userConfig } = req.body;
    
    // Use user-provided config if available, otherwise fallback to env vars
    const apiKey = (userConfig?.apiKey || process.env.VOLCENGINE_API_KEY)?.trim();
    const endpointId = model === "seedance-2.0" 
      ? "ep-m-20260421001121-7fswk"
      : "ep-m-20260502212301-rt97m";

    if (!apiKey) {
      return res.status(400).json({ 
        error: "未配置 API Key。请在页面右上角设置中输入您的火山引擎 API Key。" 
      });
    }

    try {
      console.log(`[Generate] Model: ${model}, Endpoint: ${endpointId}, Prompt: ${prompt?.slice(0, 50)}...`);
      
      const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/video_generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: endpointId,
          prompt,
          resolution: resolution || "720p",
          ratio: ratio || "16:9",
          duration: duration || 5,
          image_list: images?.map((img: string) => img.split(",")[1] || img) || [], // Only send the base64 part if it's a data URL
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Volcengine API Error Response:", JSON.stringify(data));
        throw new Error(data.error?.message || `API 错误 (${response.status}): ${JSON.stringify(data.error || data)}`);
      }

      // Note: Video generation is usually asynchronous. 
      // The API returns a task_id which we would then poll.
      // For this app, we'll return the response and let the frontend handle the state.
      res.json(data);
    } catch (error: any) {
      console.error("Volcengine API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Polling endpoint for task status (Common in video gen)
  app.get("/api/task/:taskId", async (req, res) => {
    const { taskId } = req.params;
    const authHeader = req.headers.authorization;
    const apiKey = (authHeader?.split(" ")[1] || process.env.VOLCENGINE_API_KEY)?.trim();

    if (!apiKey) {
      return res.status(400).json({ error: "Missing API Key" });
    }

    try {
      const response = await fetch(`https://ark.cn-beijing.volces.com/api/v3/video_generation/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
