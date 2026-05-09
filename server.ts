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
    const apiKey = userConfig?.apiKey || process.env.VOLCENGINE_API_KEY;
    const endpointId = model === "seedance-2.0" 
      ? (userConfig?.endpointId20 || process.env.ARK_ENDPOINT_ID_2_0)
      : (userConfig?.endpointId20Fast || process.env.ARK_ENDPOINT_ID_2_0_FAST);

    if (!apiKey || !endpointId) {
      return res.status(400).json({ 
        error: "未配置 API Key 或 接入点 ID。请在系统设置中输入。" 
      });
    }

    try {
      // For Seedance 2.0 (Video Generation typically), the endpoint might be for cv/video
      // However, we'll keep the request structure flexible. 
      // Most Volcengine Ark CV APIs use a similar POST structure.
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
          image_list: images || [], // Supports up to 9 images as requested
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "生成任务创建失败");
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
    const apiKey = req.headers.authorization?.split(" ")[1] || process.env.VOLCENGINE_API_KEY;

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
