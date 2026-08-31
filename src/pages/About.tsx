import React, { useState } from 'react';
import { Info, Cpu, Settings, PhoneCall, CheckCircle2, AlertCircle, RefreshCw, Send } from 'lucide-react';

export default function About() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Crop Diagnostic Inquiry');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Simple validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all required fields (Name, Email, Message).');
      setIsSubmitting(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Please provide a valid email address.');
      setIsSubmitting(false);
      return;
    }

    // Simulate submission to Agronomists
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    }, 1200);
  };

  const hardwareNodes = [
    { component: 'ESP32 Microcontroller', details: 'Dual-Core node, running FreeRTOS with active Wi-Fi sockets connected to the live database stream.' },
    { component: 'DHT22 Climate Sensor', details: 'Configured on GPIO Pin 4 to record air temperature and ambient relative humidity every 10 seconds.' },
    { component: 'Capacitive Soil Probe v1.2', details: 'Wired to ADC Pin 34 to sense relative soil volumetric water content without corrosion risks.' },
    { component: 'LDR Photodiode Resistor', details: 'Mapped to ADC Pin 32 with a 10kΩ voltage divider to calculate solar intensity in Lux.' },
    { component: '5V Optocoupled Relays', details: 'Linked on Pins 12, 14, 27 to toggle high-current 12V ventilation fans, 5V mini water pumps, and grow LED panels.' },
  ];

  return (
    <div id="about-container" className="space-y-6 select-none text-left">
      
      {/* Page Header */}
      <div>
        <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">DOCUMENTATION & HARDWARE</span>
        <h2 className="text-2xl font-bold text-text-primary">Greenhouse Blueprint & Advisory</h2>
        <p className="text-xs text-text-secondary">
          Understand hardware configuration schematics or request advice from Sri Lankan agricultural experts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Hardware Blueprint (7 cols) */}
        <div className="lg:col-span-7 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">IOT TOPOLOGY</span>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Cpu className="w-5 h-5 text-navy-active" />
                ESP32 Hardware Schematic
              </h3>
            </div>

            {/* Hardware wiring detail blocks */}
            <div className="space-y-3">
              {hardwareNodes.map((node, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-inner-bg/40 rounded-xl border border-divider/10 flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-divider/30 flex items-center justify-center font-mono text-xs font-bold text-text-primary shrink-0 mt-0.5">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-text-primary leading-tight">
                      {node.component}
                    </h4>
                    <p className="text-[10px] text-text-secondary leading-normal">
                      {node.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-inner-bg p-4 rounded-2xl text-[10px] text-text-secondary leading-relaxed font-semibold border border-divider/25 flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 animate-spin-slow shrink-0 text-text-secondary" />
            ESP32 nodes stream telemetry directly to `/api/sensors/update` endpoint using JSON frames.
          </div>
        </div>

        {/* Advisory Inquiry Feedback Form (5 cols) */}
        <div className="lg:col-span-5 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">CONTACT ADVISORS</span>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-navy-active" />
                Agronomist Inquiry Desk
              </h3>
              <p className="text-xs text-text-secondary">
                Submit microclimate parameters, soil concerns, or virus alerts directly to Sri Lanka agriculture consultants.
              </p>
            </div>

            {/* Form */}
            {success ? (
              <div className="p-6 bg-green-50 border border-green-100 rounded-2xl text-center space-y-4 my-4">
                <div className="w-12 h-12 bg-status-healthy text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-status-healthy">Inquiry Dispatched Successfully</h4>
                  <p className="text-xs text-text-primary leading-relaxed">
                    Ayubowan! Your agricultural parameters have been securely logged. An advisor from Mahailluppallama Station will contact you soon.
                  </p>
                </div>
                <button
                  onClick={() => setSuccess(false)}
                  className="px-4 py-2 bg-navy-active text-white font-semibold text-[10px] uppercase tracking-wider rounded-xl hover:shadow-md transition-all"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3 pt-2">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-status-critical flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-text-secondary font-medium">Cultivator Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Anura Silva"
                      className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2 px-3 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-text-secondary font-medium">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="anura@silva.lk"
                      className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2 px-3 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="text-text-secondary font-medium">Topic / Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2 px-3 outline-none"
                  >
                    <option value="Crop Diagnostic Inquiry">Crop Diagnostic Inquiry</option>
                    <option value="Pathogen & Pests Warning">Pathogen & Pests Warning</option>
                    <option value="Irrigation Scheduling Advice">Irrigation Scheduling Advice</option>
                    <option value="ESP32 Wiring Support">ESP32 Wiring Support</option>
                  </select>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="text-text-secondary font-medium">Message Body</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe leaves spotting pattern, growth delays, or moisture drops..."
                    className="w-full bg-inner-bg focus:bg-white text-text-primary border border-transparent focus:border-divider rounded-xl py-2 px-3 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-navy-active hover:shadow-lg text-white font-semibold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Dispatching to Station...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit to Advisor Desk
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
