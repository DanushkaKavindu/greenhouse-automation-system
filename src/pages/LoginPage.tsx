import React, { useState } from 'react';
import { Sprout, LogIn, ArrowRight, AlertCircle, EyeOff, Eye, Sparkles } from 'lucide-react';
import { auth, googleSignIn, registerUser, loginUser } from '../firebase';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onSkip: () => void;
}

export default function LoginPage({ onLoginSuccess, onSkip }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let userCredential;
      if (isRegister) {
        userCredential = await registerUser(email, password);
      } else {
        userCredential = await loginUser(email, password);
      }
      onLoginSuccess(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const user = await googleSignIn();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    // Auto populate and submit demo details
    onLoginSuccess({
      uid: 'demo_user_123',
      email: 'cultivator@greenhouse.lk',
      displayName: 'Green Chilli Cultivator (Demo)',
      photoURL: null,
    });
  };

  return (
    <div id="login-page-container" className="min-h-[80vh] flex items-center justify-center py-10 px-4 select-none">
      <div className="w-full max-w-4xl bg-card-bg rounded-[32px] shadow-glass border border-white/25 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Form Column */}
        <div className="p-8 md:p-12 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={onSkip}>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-status-healthy border border-emerald-100">
                <Sprout className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="text-xs font-bold text-text-primary tracking-widest uppercase">MONITOR</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-text-primary">
                {isRegister ? 'Create Greenhouse Account' : 'Welcome Cultivator'}
              </h2>
              <p className="text-xs text-text-secondary">
                {isRegister 
                  ? 'Sign up to monitor, automate, and diagnose your chilli harvest.' 
                  : 'Log in to view live telemetry nodes and run AI leaf checks.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-status-critical flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1 text-xs">
              <label className="text-text-secondary font-medium block">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cultivator@greenhouse.lk"
                className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2.5 px-3 outline-none transition-all"
              />
            </div>

            <div className="space-y-1 text-xs relative">
              <label className="text-text-secondary font-medium block">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2.5 px-3 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 bottom-2.5 text-text-secondary hover:text-text-primary"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-navy-active hover:shadow-lg text-white font-semibold rounded-xl text-xs uppercase tracking-wider mt-4 flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {isLoading ? (
                'Processing...'
              ) : (
                <>
                  {isRegister ? 'Register Account' : 'Log In'}
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Sign In Divider */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-text-secondary text-[10px] uppercase font-bold tracking-widest">
              <span className="flex-1 h-px bg-divider" />
              <span>Or Continue With</span>
              <span className="flex-1 h-px bg-divider" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="py-2.5 px-4 bg-white hover:bg-inner-bg text-text-primary text-xs font-semibold rounded-xl border border-divider/40 flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                Google
              </button>
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-status-healthy text-xs font-bold rounded-xl border border-emerald-100 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 fill-status-healthy" />
                Guest Demo
              </button>
            </div>

            <div className="text-center text-xs">
              <span className="text-text-secondary">
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              </span>
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-navy-active font-semibold hover:underline"
              >
                {isRegister ? 'Log In' : 'Sign Up'}
              </button>
            </div>
          </div>
        </div>

        {/* Info Column */}
        <div className="hidden md:block bg-navy-active text-white p-12 flex flex-col justify-between relative overflow-hidden text-left">
          <div className="space-y-4 relative z-10">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">Cultivation Guide</span>
            <h3 className="text-xl font-bold tracking-tight">Ceylon Green Chilli</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              MICH 2 and KA 2 varieties thrive in warm climates. Optimal greenhouse parameters range between 26–32°C, requiring consistent hydration levels and immediate ventilation triggers.
            </p>
          </div>

          <div className="bg-white/10 rounded-[20px] p-5 space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">AI Automation Rules</span>
              <span className="text-[10px] bg-status-healthy text-white px-2 py-0.5 rounded-full font-semibold">Active</span>
            </div>
            <div className="text-xs leading-relaxed space-y-1 text-white/90">
              <div className="flex justify-between"><span>Temp &gt; 32°C</span> <span className="font-semibold text-status-healthy">Fan ON</span></div>
              <div className="flex justify-between"><span>Soil &lt; 40%</span> <span className="font-semibold text-status-healthy">Water Pump ON</span></div>
              <div className="flex justify-between"><span>Light &lt; 200 Lux</span> <span className="font-semibold text-status-healthy">Lights ON</span></div>
            </div>
          </div>

          <div className="text-[10px] text-text-secondary relative z-10">
            Automating agrarian excellence with high-performance sensor nodes.
          </div>

          {/* Decorative gradients */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

      </div>
    </div>
  );
}
