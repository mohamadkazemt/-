import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import { LogIn, Lock, User, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiService.login(email, password);
      onSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] p-4 font-['Inter']" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-[#1C1C1E] p-8 rounded-2xl border border-[#2C2C2E]"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FFB000]/10 border border-[#FFB000]/20 mb-4">
            <Lock className="text-[#FFB000]" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">ورود به سامانه مدیریت</h2>
          <p className="text-[#8E8E93] text-sm">لطفا برای دسترسی به پنل مدیریت وارد شوید</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={20} />
              <input
                type="text"
                required
                className="w-full bg-[#0A0A0B] border border-[#2C2C2E] rounded-lg py-3 pr-10 pl-4 text-white focus:outline-none focus:ring-1 focus:ring-[#FFB000] transition-all placeholder:text-[#3A3A3C]"
                placeholder="نام کاربری"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]" size={20} />
              <input
                type="password"
                required
                className="w-full bg-[#0A0A0B] border border-[#2C2C2E] rounded-lg py-3 pr-10 pl-4 text-white focus:outline-none focus:ring-1 focus:ring-[#FFB000] transition-all placeholder:text-[#3A3A3C]"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg flex items-center gap-3 text-sm"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFB000] text-[#0A0A0B] font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#FFC040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#0A0A0B]/30 border-t-[#0A0A0B] rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                <span>ورود به سیستم</span>
              </>
            )}
          </button>
        </form>
        
        <div className="text-center mt-4 pt-4 border-t border-[#2C2C2E]">
          <p className="text-[10px] text-[#8E8E93] uppercase tracking-widest">
            سامانه مدیریت هوشمند منابع انسانی
          </p>
        </div>
      </motion.div>
    </div>
  );
};
