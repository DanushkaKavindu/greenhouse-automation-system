import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Mic, Volume2, VolumeX, Sparkles, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessage, SensorData, ControlData, Thresholds } from '../types';

interface ChatbotProps {
  sensorData: SensorData;
  controlData: ControlData;
  onUpdateControl: (field: keyof ControlData, value: boolean) => void;
  thresholds?: Thresholds;
  onUpdateThresholds?: (newThresholds: Thresholds) => void;
}

export default function Chatbot({ 
  sensorData, 
  controlData, 
  onUpdateControl,
  thresholds,
  onUpdateThresholds 
}: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThresholdsBanner, setShowThresholdsBanner] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThresholds = thresholds || {
    tempHigh: 32,
    tempLow: 26,
    soilLow: 40,
    soilHigh: 70,
    lightLow: 300,
    lightHigh: 800,
  };

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: "Ayubowan! 🌿 I am your Greenhouse Assistant. I can monitor your crop, control climate devices, and change automation thresholds. Try asking 'What are the current thresholds?' or command 'Set high temperature threshold to 34°C' or 'Set soil moisture threshold to 35%'!",
          timestamp: new Date(),
        }
      ]);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Voice Recognition (Defensive browser checks)
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not fully supported in this browser or iframe. Please type your message!');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Text To Speech
  const speakText = (text: string) => {
    if (!isTtsEnabled) return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();

    const plainText = text.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    
    const isSinhala = /[\u0D80-\u0DFF]/.test(text);
    if (isSinhala) {
      utterance.lang = 'si-LK';
    } else {
      utterance.lang = 'en-US';
    }
    
    utterance.rate = 1.0;
    synth.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) setInputText('');

    // Add user message
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ sender: m.sender, text: m.text })),
          sensorData,
          controlData,
          thresholds: activeThresholds,
        }),
      });

      if (!response.ok) {
        throw new Error('Chatbot response error');
      }

      const data = await response.json();

      // Check if response triggers actuators or threshold changes
      if (data.commands) {
        // Actuators
        if (data.commands.fan !== undefined) onUpdateControl('fanStatus', data.commands.fan);
        if (data.commands.pump !== undefined) onUpdateControl('pumpStatus', data.commands.pump);
        if (data.commands.led !== undefined) onUpdateControl('lightStatus', data.commands.led);

        // Thresholds
        const { tempHigh, tempLow, soilLow, soilHigh, lightLow, lightHigh } = data.commands;
        if (
          onUpdateThresholds && (
            tempHigh !== undefined || 
            tempLow !== undefined || 
            soilLow !== undefined || 
            soilHigh !== undefined || 
            lightLow !== undefined || 
            lightHigh !== undefined
          )
        ) {
          const updated: Thresholds = {
            tempHigh: tempHigh !== undefined ? Number(tempHigh) : activeThresholds.tempHigh,
            tempLow: tempLow !== undefined ? Number(tempLow) : activeThresholds.tempLow,
            soilLow: soilLow !== undefined ? Number(soilLow) : activeThresholds.soilLow,
            soilHigh: soilHigh !== undefined ? Number(soilHigh) : activeThresholds.soilHigh,
            lightLow: lightLow !== undefined ? Number(lightLow) : activeThresholds.lightLow,
            lightHigh: lightHigh !== undefined ? Number(lightHigh) : activeThresholds.lightHigh,
          };

          // Logical sanity adjustments
          if (updated.tempHigh <= updated.tempLow) updated.tempLow = updated.tempHigh - 1;
          if (updated.soilHigh <= updated.soilLow) updated.soilLow = updated.soilHigh - 5;
          if (updated.lightHigh <= updated.lightLow) updated.lightLow = updated.lightHigh - 100;

          updated.tempHigh = Math.min(45, Math.max(25, updated.tempHigh));
          updated.tempLow = Math.min(30, Math.max(15, updated.tempLow));
          updated.soilLow = Math.min(60, Math.max(10, updated.soilLow));
          updated.soilHigh = Math.min(95, Math.max(50, updated.soilHigh));
          updated.lightLow = Math.min(600, Math.max(50, updated.lightLow));
          updated.lightHigh = Math.min(1500, Math.max(500, updated.lightHigh));

          onUpdateThresholds(updated);
        }
      }

      const assistantMsg: ChatMessage = {
        id: 'msg_' + (Date.now() + 1),
        sender: 'assistant',
        text: data.reply || 'Apologies, I could not process that request.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      
      // Auto speak if TTS is active
      speakText(assistantMsg.text);

    } catch (e) {
      console.error(e);
      const errMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'assistant',
        text: "I am having trouble connecting to the brain server. Please ensure your GEMINI_API_KEY is configured under Settings > Secrets.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickActions = [
    { label: '⚙️ Show Thresholds', text: 'What are the current automation thresholds?' },
    { label: '🌡️ Set Temp High 34°C', text: 'Set temperature high threshold to 34 degrees' },
    { label: '💧 Set Soil Low 35%', text: 'Set soil moisture low threshold to 35 percent' },
    { label: '💨 Turn Fan ON', text: 'Turn on the fan' },
    { label: '💧 Water Pump ON', text: 'Turn on the water pump' },
  ];

  return (
    <div id="ai-chatbot-widget" className="fixed bottom-20 right-3 sm:right-6 md:bottom-6 md:right-6 z-40 select-none">
      {/* Floating Circle Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            window.speechSynthesis?.cancel();
          }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-navy-active text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-white/20 group relative"
        >
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.5]" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-status-healthy border-2 border-white flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-healthy opacity-75"></span>
          </div>
          
          <div className="absolute right-16 bg-navy-active text-white text-xs py-1.5 px-3 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden sm:block">
            Ask Greenhouse Assistant
          </div>
        </button>
      )}

      {/* Slide-Up Soft Glass Panel Chat Window */}
      {isOpen && (
        <div className="fixed inset-x-2 bottom-18 sm:bottom-20 md:absolute md:bottom-0 md:right-0 md:left-auto w-auto md:w-[380px] h-[75vh] max-h-[580px] md:h-[530px] bg-white/95 backdrop-blur-md rounded-[24px] shadow-2xl border border-white/20 flex flex-col justify-between overflow-hidden animate-slide-up z-50">
          
          {/* Header */}
          <div className="p-3.5 bg-navy-active text-white flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-status-healthy">
                  <Sparkles className="w-4 h-4 fill-status-healthy stroke-none" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold">Greenhouse AI Assistant</h3>
                  <div className="flex items-center gap-1.5 text-[9px] text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-healthy animate-pulse" />
                    <span>Temp: {sensorData.temperature}°C · Soil: {sensorData.soilMoisture}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Threshold Quick Toggle button */}
                <button
                  onClick={() => setShowThresholdsBanner(!showThresholdsBanner)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                    showThresholdsBanner ? 'bg-white text-navy-active' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title="Toggle Thresholds View"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Thresholds</span>
                  {showThresholdsBanner ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {/* TTS toggler */}
                <button
                  onClick={() => {
                    setIsTtsEnabled(!isTtsEnabled);
                    if (isTtsEnabled) window.speechSynthesis?.cancel();
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  title={isTtsEnabled ? 'Disable speech output' : 'Enable speech output'}
                >
                  {isTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    window.speechSynthesis?.cancel();
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expandable Live Automation Thresholds Panel */}
            {showThresholdsBanner && (
              <div className="bg-white/10 rounded-xl p-2.5 text-[10px] space-y-2 border border-white/10 animate-fade-in">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-emerald-300">
                  <span>Current Threshold Parameters</span>
                  <span>Interactive Sync</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                  <div className="bg-black/20 p-1.5 rounded-lg border border-white/10">
                    <span className="block text-[8px] text-white/60">Temp High/Low</span>
                    <span className="font-bold text-amber-300">{activeThresholds.tempHigh}°C / {activeThresholds.tempLow}°C</span>
                  </div>
                  <div className="bg-black/20 p-1.5 rounded-lg border border-white/10">
                    <span className="block text-[8px] text-white/60">Soil Low/High</span>
                    <span className="font-bold text-sky-300">{activeThresholds.soilLow}% / {activeThresholds.soilHigh}%</span>
                  </div>
                  <div className="bg-black/20 p-1.5 rounded-lg border border-white/10">
                    <span className="block text-[8px] text-white/60">Light Low/High</span>
                    <span className="font-bold text-yellow-300">{activeThresholds.lightLow} / {activeThresholds.lightHigh} lx</span>
                  </div>
                </div>
                <p className="text-[9px] text-white/80 italic text-center">
                  💡 Type commands like "Set temperature high threshold to 34" or "Change soil threshold to 35"
                </p>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-white/10 to-inner-bg/20">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-[18px] p-3 text-xs shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-navy-active text-white rounded-br-none'
                      : 'bg-white text-text-primary rounded-bl-none border border-divider/10'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  <span className={`text-[8px] mt-1 block text-right ${m.sender === 'user' ? 'text-white/60' : 'text-text-secondary'}`}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white text-text-primary rounded-[18px] rounded-bl-none p-3 text-xs shadow-sm flex items-center gap-1 border border-divider/10">
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions Panel */}
          <div className="p-2 border-t border-divider/30 bg-white flex gap-1.5 overflow-x-auto select-none no-scrollbar">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(action.text)}
                className="px-2.5 py-1 text-[10px] font-medium bg-inner-bg hover:bg-divider text-text-primary rounded-full whitespace-nowrap shadow-sm border border-divider/20 transition-all cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-divider/40 flex items-center gap-2">
            {/* Mic Button */}
            <button
              onClick={startSpeechRecognition}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-status-critical text-white animate-pulse' 
                  : 'bg-inner-bg text-text-secondary hover:text-text-primary hover:bg-divider'
              }`}
              title="Speak message"
            >
              <Mic className="w-4 h-4 stroke-[1.5]" />
            </button>

            {/* Input field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Command device or set threshold..."
              className="flex-1 bg-inner-bg hover:bg-inner-bg/80 focus:bg-white text-xs border border-transparent focus:border-divider rounded-xl py-2 px-3 outline-none transition-colors text-text-primary"
            />

            {/* Send button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                inputText.trim() 
                  ? 'bg-navy-active text-white shadow-md hover:scale-105' 
                  : 'bg-inner-bg text-text-secondary cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

