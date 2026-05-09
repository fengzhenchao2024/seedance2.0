/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Video, 
  Settings2, 
  Download, 
  RefreshCw, 
  Layout, 
  Info,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  X,
  Key,
  Clock,
  Ratio as RatioIcon,
  Monitor
} from "lucide-react";

type ModelType = "seedance-2.0" | "seedance-2.0-fast";

interface GenerationParams {
  prompt: string;
  resolution: string;
  ratio: string;
  duration: number;
}

interface UserConfig {
  apiKey: string;
}

interface VideoResult {
  id: string; // Task ID
  url?: string;
  prompt: string;
  model: ModelType;
  timestamp: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

const RESOLUTIONS = {
  "seedance-2.0": ["480p", "720p", "1080p"],
  "seedance-2.0-fast": ["480p", "720p"]
};

const RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];

export default function App() {
  const [model, setModel] = useState<ModelType>("seedance-2.0");
  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
    resolution: "720p",
    ratio: "16:9",
    duration: 5,
  });
  const [userConfig, setUserConfig] = useState<UserConfig>({
    apiKey: ""
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDurationFocused, setIsDurationFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const durationContainerRef = useRef<HTMLDivElement>(null);

  const validateDuration = (val: number) => {
    if (isNaN(val)) return 5;
    return Math.max(4, Math.min(15, val));
  };

  const handleContainerBlur = (e: React.FocusEvent) => {
    // 只有当新焦点不在本容器内部时，才触发校验和关闭
    if (durationContainerRef.current && !durationContainerRef.current.contains(e.relatedTarget as Node)) {
      setParams(prev => ({ ...prev, duration: validateDuration(prev.duration) }));
      setIsDurationFocused(false);
    }
  };

  // Load from localStorage
  useEffect(() => {
    const savedResults = localStorage.getItem("seedance_results");
    const savedConfig = localStorage.getItem("seedance_config");
    if (savedResults) setResults(JSON.parse(savedResults));
    if (savedConfig) setUserConfig(JSON.parse(savedConfig));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("seedance_results", JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem("seedance_config", JSON.stringify(userConfig));
  }, [userConfig]);

  // Polling for processing videos
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      const processingTasks = results.filter(r => r.status === "pending" || r.status === "processing");
      if (processingTasks.length > 0) {
        processingTasks.forEach(checkTaskStatus);
      }
    }, 5000);

    return () => clearInterval(pollingInterval);
  }, [results]);

  const checkTaskStatus = async (task: VideoResult) => {
    try {
      const response = await fetch(`/api/task/${task.id}`, {
        headers: {
          "Authorization": `Bearer ${userConfig.apiKey}`
        }
      });
      const data = await response.json();

      if (data.status === "succeeded") {
        updateTask(task.id, { 
          status: "completed", 
          url: data.video_result?.url || data.video_url || data.url 
        });
      } else if (data.status === "failed") {
        updateTask(task.id, { status: "failed", error: data.error?.message || "生成失败" });
      } else if (data.status === "processing" || data.status === "running") {
        updateTask(task.id, { status: "processing" });
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  };

  const updateTask = (id: string, updates: Partial<VideoResult>) => {
    setResults(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (uploadedImages.length + files.length > 9) {
      setError("最多只能上传 9 张图片");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!params.prompt.trim() && uploadedImages.length === 0) {
      setError("从提示词开始，或上传图片");
      return;
    }

    if (!userConfig.apiKey) {
      setError("请先在右上角配置 API Key");
      setIsConfigOpen(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          model,
          images: uploadedImages,
          userConfig
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "任务创建失败");
      }

      const taskId = data.task_id || data.id;
      if (!taskId) throw new Error("API 未返回任务 ID");

      const newResult: VideoResult = {
        id: taskId,
        prompt: params.prompt,
        model,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      setResults([newResult, ...results]);
      setUploadedImages([]);
      setParams({ ...params, prompt: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans selection:bg-blue-500/30">
      {/* 头部 */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight">Seedance 2.0 <span className="text-blue-500 font-medium">Ark</span></h1>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">火山引擎 官方对接 </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                  userConfig.apiKey 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                }`}
              >
                <Key className="w-4 h-4" />
                {userConfig.apiKey ? "已配置 API" : "设置 API Key"}
              </button>

              <AnimatePresence>
                {isConfigOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 z-[100]"
                  >
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-blue-500" />
                      接口配置
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">API Key</label>
                        <input 
                          type="password"
                          value={userConfig.apiKey}
                          onChange={(e) => setUserConfig({ ...userConfig, apiKey: e.target.value })}
                          placeholder="输入您的火山引擎 API Key"
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <p className="text-[9px] text-zinc-600 leading-tight">模型接入点已由系统自动配置（Seedance 2.0 / Fast）。</p>
                      </div>
                      <button 
                        onClick={() => setIsConfigOpen(false)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-xs mt-2 transition-colors"
                      >
                        确认
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-12">
        {/* 控制侧边栏 */}
        <div className="flex flex-col gap-6">
          {/* 模型选择 */}
          <section className="bg-zinc-950 border border-white/5 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-zinc-500 italic">
              <Layout className="w-3.5 h-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Model / 模型</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  setModel("seedance-2.0");
                  if (params.resolution === "1080p") setParams({...params, resolution: "720p"});
                }}
                className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${
                  model === "seedance-2.0" 
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                    : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10"
                }`}
              >
                <div className="font-bold text-[11px]">Seedance 2.0</div>
                <div className="text-[8px] opacity-50 text-center leading-tight">旗舰画质</div>
              </button>
              
              <button 
                onClick={() => setModel("seedance-2.0-fast")}
                className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${
                  model === "seedance-2.0-fast" 
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                    : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10"
                }`}
              >
                <div className="font-bold text-[11px]">Seedance 2.0 Fast</div>
                <div className="text-[8px] opacity-50 text-center leading-tight">高速极致</div>
              </button>
            </div>
          </section>

          {/* 生成参数 */}
          <section className="bg-zinc-950 border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-500">
                <Settings2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Engine / 核心参数</span>
              </div>
            </div>

            {/* 提示词 */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">提示词内容</label>
              <textarea 
                value={params.prompt}
                onChange={(e) => setParams({ ...params, prompt: e.target.value })}
                placeholder="在此输入您的创意描述... 支持中文描述视频场景"
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-y placeholder:text-zinc-700 leading-relaxed min-h-[100px]"
              />
            </div>

            {/* 图片上传 */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1 flex justify-between items-center">
                <span>参考图像 (最多9张)</span>
                {uploadedImages.length > 0 && (
                  <button onClick={() => setUploadedImages([])} className="text-[9px] text-zinc-600 hover:text-red-400 transition-colors uppercase font-bold">清空</button>
                )}
              </label>
              
              <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                    <div key={idx} className="aspect-square relative rounded-lg overflow-hidden group border border-white/10 bg-white/5">
                      {uploadedImages[idx] ? (
                        <>
                          <img src={uploadedImages[idx]} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removeImage(idx)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full flex items-center justify-center hover:bg-white/5 transition-colors group"
                        >
                          <Plus className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500" />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* 第二排空余一个格子 */}
                  <div className="aspect-square" />
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                multiple 
                hidden 
                accept="image/*" 
              />
            </div>

            {/* 规格配置汇总 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] flex items-center gap-1.5 italic">
                  <Monitor className="w-3 h-3 text-blue-500" /> 分辨率
                </label>
                <select 
                  value={params.resolution}
                  onChange={(e) => setParams({ ...params, resolution: e.target.value })}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl px-2 py-2 text-[10px] focus:outline-none focus:border-blue-500/50 appearance-none text-zinc-300"
                >
                  {RESOLUTIONS[model].map(res => <option key={res} value={res}>{res}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] flex items-center gap-1.5 italic">
                  <RatioIcon className="w-3 h-3 text-indigo-500" /> 比例
                </label>
                <select 
                  value={params.ratio}
                  onChange={(e) => setParams({ ...params, ratio: e.target.value })}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl px-2 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 appearance-none text-zinc-300"
                >
                  {RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
                </select>
              </div>
              <div 
                className="flex flex-col gap-2 relative"
                ref={durationContainerRef}
                onBlur={handleContainerBlur}
              >
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] flex items-center gap-1.5 italic">
                  <Clock className="w-3 h-3 text-emerald-500" /> 时长
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    value={params.duration}
                    onChange={(e) => setParams({ ...params, duration: parseInt(e.target.value) || 0 })}
                    onFocus={() => setIsDurationFocused(true)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl pl-2 pr-8 py-2 text-[10px] focus:outline-none focus:border-emerald-500/50 text-zinc-300 transition-all font-mono"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-zinc-600 font-bold uppercase pointer-events-none tracking-tighter">SEC</span>
                </div>
                
                <AnimatePresence>
                  {isDurationFocused && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 4 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 absolute top-full left-0 right-0 z-10 backdrop-blur-md"
                    >
                      <input 
                        type="range"
                        min={4}
                        max={15}
                        step={1}
                        value={params.duration || 5}
                        onChange={(e) => setParams({ ...params, duration: parseInt(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between mt-1.5 text-[8px] text-zinc-500 font-bold font-mono">
                        <span>4S</span>
                        <span className="text-emerald-500">{params.duration}S</span>
                        <span>15S</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-4 rounded-[20px] flex items-center justify-center gap-3 font-bold text-sm tracking-widest transition-all shadow-2xl active:scale-[0.98] ${
                isGenerating 
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                  : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:hue-rotate-15 text-white"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成任务创建中...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  生成视频
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 shadow-inner"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[10px] leading-relaxed font-medium">{error}</span>
              </motion.div>
            )}
          </section>
        </div>

        {/* 结果展示区 */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              <h2 className="text-lg font-bold tracking-tight">作品空间 <span className="text-zinc-600 font-medium ml-2 text-sm italic">Workspace</span></h2>
            </div>
            {results.length > 0 && (
              <button 
                onClick={() => { if(confirm("确定清除所有历史记录？")) setResults([]); }}
                className="flex items-center gap-2 text-xs font-bold text-zinc-700 hover:text-red-500 transition-colors uppercase"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[48px] py-40 text-zinc-800 bg-black/5 relative overflow-hidden group">
              <div className="relative z-10 text-center">
                <Video className="w-20 h-20 mx-auto mb-6 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 group-hover:scale-110" />
                <p className="text-base font-bold text-zinc-700 italic">在这里开启您的视觉叙事之旅</p>
                <p className="text-[10px] uppercase tracking-[0.4em] mt-4 opacity-50 bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Enter prompt & Generate</p>
              </div>
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 blur-[100px] transition-opacity duration-1000" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-40">
              <AnimatePresence mode="popLayout">
                {results.map((result) => (
                  <motion.div 
                    layout
                    key={result.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="bg-zinc-950 border border-white/5 rounded-[36px] overflow-hidden shadow-2xl group relative transition-all hover:bg-zinc-900/80">
                      {/* 媒体容器 */}
                      <div className="aspect-[16/9] relative bg-zinc-900 flex items-center justify-center overflow-hidden">
                        {result.status === "completed" && result.url ? (
                          <video 
                            src={result.url} 
                            controls 
                            className="w-full h-full object-contain"
                          />
                        ) : result.status === "failed" ? (
                          <div className="flex flex-col items-center gap-3 text-red-500/50">
                            <AlertCircle className="w-10 h-10" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">Generation Failed</span>
                            {result.error && <span className="text-xs text-red-500 px-6 text-center">{result.error}</span>}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-5">
                            <div className="relative">
                              <Loader2 className="w-10 h-10 text-blue-500/40 animate-spin" />
                              <div className="absolute inset-0 blur-xl bg-blue-500/20" />
                            </div>
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
                                {result.status === "pending" ? "等待中..." : "渲染中..."}
                              </span>
                              <span className="text-[9px] text-zinc-700 font-mono italic">Task ID: {result.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        )}
                        
                        {/* 下载覆盖 */}
                        {result.status === "completed" && result.url && (
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a 
                              href={result.url} 
                              download 
                              target="_blank"
                              className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* 详情页脚 */}
                      <div className="p-7">
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                              result.model === "seedance-2.0" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}>
                              {result.model}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono font-medium">
                              {new Date(result.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${
                            result.status === "completed" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                            result.status === "failed" ? "bg-red-500" : "bg-blue-500 animate-ping"
                          }`} />
                        </div>
                        <p className="text-xs text-zinc-400 font-medium leading-relaxed italic line-clamp-2 selection:bg-blue-500/20">
                          "{result.prompt || "无文本提示词"}"
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* 底部装饰 */}
      <footer className="py-10 border-t border-white/5 mt-auto relative overflow-hidden bg-black/40">
        <div className="max-w-[1440px] mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-lg font-bold tracking-tighter">创客AI</span>
            </div>
            <div className="w-px h-4 bg-zinc-800" />
            <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
              致力于利用先进的深度学习技术，为全球创作者提供最高性能的视频生成工具。
            </p>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-[10px] font-medium text-zinc-500">
              © 2026 <a href="https://ai.cckkc.com" target="_blank" className="text-zinc-400 hover:text-blue-500 transition-colors">创客AI (ai.cckkc.com)</a>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              <span>Intelligence</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <span>Creativity</span>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <span>Future</span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
      </footer>
    </div>
  );
}

