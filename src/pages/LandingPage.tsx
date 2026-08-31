import { ArrowRight, ShieldCheck, Cpu, Database, Eye, Heart, Leaf } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const features = [
    {
      icon: Eye,
      title: 'Real-time Sensor Monitoring',
      desc: 'Keep track of air temperature, humidity, soil moisture, and light levels in real-time with ESP32-synchronized nodes.',
    },
    {
      icon: Leaf,
      title: 'AI Plant Disease Detection',
      desc: 'Capture or upload photos of green chilli leaves to run server-side diagnoses for viruses, fungal outbreaks, and deficiencies.',
    },
    {
      icon: Cpu,
      title: 'Automated Device Control',
      desc: 'Automate cooling fans, water pumps, and grow-lights instantly using smart agricultural logic triggers.',
    },
    {
      icon: Database,
      title: 'Data Reports & Analytics',
      desc: 'Analyze environmental historical averages and charts to optimize green chilli yield and crop quality.',
    },
    {
      icon: ShieldCheck,
      title: 'Google Calendar Integration',
      desc: 'Sync daily agricultural updates, warning alerts, and watering activity logs directly to your calendar.',
    }
  ];

  const stats = [
    { value: '4', label: 'Sensor Inputs' },
    { value: '3', label: 'Active Actuators' },
    { value: '24/7', label: 'Automated Monitoring' },
    { value: '100%', label: 'Peace of Mind' },
  ];

  return (
    <div id="landing-page-container" className="min-height-screen bg-transparent py-10 px-4 space-y-20 select-none max-w-6xl mx-auto">
      
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6 text-left">
          <h1 className="text-4xl lg:text-5xl font-bold text-text-primary tracking-tight leading-tight">
            Smart Greenhouse <span className="block text-navy-active font-extrabold">Monitoring & Control</span>
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed max-w-xl">
            Real-time sensor monitoring, AI-powered plant care, and automated climate control for your green chilli greenhouse. Optimize water, light, and humidity with zero effort.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={onStart}
              className="py-3 px-6 bg-navy-active text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg hover:scale-102 active:scale-98 transition-all flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Visual Element (Floating Sensor Cards) */}
        <div className="lg:col-span-5 relative h-[320px] bg-inner-bg/20 rounded-[32px] flex items-center justify-center p-6 border border-white/10 shadow-inner">
          <div className="absolute top-10 left-6 w-[140px] bg-white/90 backdrop-blur-md rounded-[24px] p-4 shadow-glass border border-white/20 transform -rotate-6 animate-float-slow">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Temperature</span>
            <div className="text-3xl font-bold text-text-primary mt-1">28.4<span className="text-sm text-text-secondary font-normal">°C</span></div>
            <span className="text-[9px] text-status-healthy font-semibold mt-2 block">Optimal Range</span>
          </div>

          <div className="absolute bottom-8 right-6 w-[150px] bg-white/90 backdrop-blur-md rounded-[24px] p-4 shadow-glass border border-white/20 transform rotate-3 animate-float-delayed">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Soil Moisture</span>
            <div className="text-3xl font-bold text-text-primary mt-1">62<span className="text-sm text-text-secondary font-normal">%</span></div>
            <span className="text-[9px] text-status-healthy font-semibold mt-2 block">Hydration High</span>
          </div>

          <div className="w-[180px] bg-navy-active text-white rounded-[24px] p-5 shadow-2xl z-10 text-left space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">AI Vitals Check</span>
              <Heart className="w-4 h-4 text-status-healthy fill-status-healthy" />
            </div>
            <div>
              <div className="text-2xl font-bold">100%</div>
              <p className="text-[10px] text-text-secondary mt-1">Green Chilli Crop Health Score is fully stable.</p>
            </div>
            <div className="text-[9px] text-white/80 bg-white/10 rounded-lg p-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-status-healthy" />
              All actuators online
            </div>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section className="space-y-10 text-center">
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase block">System Features</span>
          <h2 className="text-3xl font-semibold text-text-primary">Fully Integrated Agricultural Suite</h2>
          <p className="text-xs text-text-secondary max-w-lg mx-auto">
            Everything you need to automate your green chilli farming, built with low-contrast, highly aesthetic UI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, index) => {
            const Icon = f.icon;
            return (
              <div
                key={index}
                className="bg-card-bg/80 hover:bg-card-bg rounded-[24px] p-6 shadow-glass border border-white/20 text-left space-y-3 group hover:scale-102 hover:shadow-glass-hover transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-inner-bg text-text-secondary group-hover:bg-navy-active group-hover:text-white transition-colors flex items-center justify-center">
                  <Icon className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats Counter */}
      <section className="bg-navy-active text-white rounded-[32px] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {stats.map((s, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-4xl md:text-5xl font-bold text-white tracking-tight">{s.value}</div>
              <div className="text-xs text-text-secondary uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Background gradient decor */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Footer banner */}
      <footer className="text-center text-[10px] text-text-secondary py-6 border-t border-divider/40">
        🌿 Greenhouse Monitor Sri Lanka · Powered by Gemini LLM & ESP32 Controller nodes. All rights reserved.
      </footer>
    </div>
  );
}
