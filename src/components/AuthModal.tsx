import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 图形验证码模拟 (因为实际接入阿里云/百度等验证码需要密钥且比较复杂，这里实现一个前端逻辑校验)
  const [captchaText, setCaptchaText] = useState(generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');

  function generateCaptcha() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  const refreshCaptcha = () => setCaptchaText(generateCaptcha());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 基础校验
    if (captchaInput.toUpperCase() !== captchaText) {
      setError('验证码错误');
      refreshCaptcha();
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (username.length < 2) {
        setError('用户名过短');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 创建用户文档
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username,
          email,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') setError('该邮箱已被注册');
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') setError('邮箱或密码错误');
      else if (err.code === 'auth/operation-not-allowed') {
        setError('登录服务未开启。请联系管理员在 Firebase 控制台启用 Email/Password 认证方式。');
      }
      else setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl p-8 relative overflow-hidden"
      >
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              {isLogin ? '欢迎回来' : '开启您的创作工具'}
            </h2>
            <p className="text-sm text-zinc-500 italic">创客AI - 专业级视频生成实验室</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">用户名 / Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      required
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="设置您的创作昵称"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-zinc-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">邮箱 / Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">密码 / Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-zinc-600"
                />
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">确认密码 / Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      required
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-zinc-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">验证码 / Verification</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    required
                    type="text" 
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="输入图形验证码"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-zinc-600"
                  />
                </div>
                <div 
                  onClick={refreshCaptcha}
                  className="w-24 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center font-mono font-bold text-blue-400 cursor-pointer hover:bg-white/15 transition-all select-none relative group"
                >
                  {captchaText}
                  <RefreshCw className="absolute inset-0 m-auto w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity" />
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-xs"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? '登录账户' : '立即注册'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-4"
            >
              {isLogin ? '还没有账号？点击注册' : '已有账号？点击登录'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
