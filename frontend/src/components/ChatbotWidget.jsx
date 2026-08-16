import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, ShieldAlert, ChevronDown, RefreshCw, AlertCircle, Heart } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "Show active high priority victims",
  "How is the priority score calculated?",
  "What is Stage 2 Gemini Video Verification?",
  "How do I submit a field report?"
];

export default function ChatbotWidget({ victims = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Greetings Commander! 🐾 I am your Rescue Buddy AI Agent. How can I assist field operations today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Automated Response Engine
  const generateBotReply = (userQuery) => {
    const q = userQuery.toLowerCase();

    if (q.includes('victim') || q.includes('high priority') || q.includes('active') || q.includes('status')) {
      const highPriority = victims.filter(v => (v.priority_score || 0) >= 70 && v.status !== 'rescued');
      const totalActive = victims.filter(v => v.status !== 'rescued').length;
      const listStr = highPriority.slice(0, 3).map(v => `• ${v.id} (Score: ${v.priority_score || 'N/A'}): ${v.description || 'Target requiring dispatch'}`).join('\n');
      return `🐾 Rescue Telemetry Overview:\n• Active Targets: ${totalActive}\n• Critical High Priority (>70 Score): ${highPriority.length}\n\n${listStr || 'No critical high priority targets currently active.'}`;
    }

    if (q.includes('score') || q.includes('formula') || q.includes('calculate') || q.includes('priority')) {
      return `🧮 Priority Scoring Engine:\nPriority = 0.20(Confidence) + 0.30(Inactivity) + 0.25(DBSCAN Cluster) + 0.25(Hazard Proximity)\n\n• >70: High Priority (Pulsing Red Marker)\n• 40–70: Moderate Priority (Orange Marker)\n• <40: Low Priority (Yellow Marker)`;
    }

    if (q.includes('gemini') || q.includes('video') || q.includes('threat') || q.includes('stage 2')) {
      return `📹 Two-Stage Video Analysis Protocol:\n• Stage 1 (YOLOv8 + ByteTrack): Detects candidate victims (submerged, trapped, immobile).\n• Stage 2 (Gemini 2.0 Flash): Generates explainable AI reasoning & verifies candidate frames against false positives.`;
    }

    if (q.includes('report') || q.includes('submit') || q.includes('field')) {
      return `📝 Field Incident Submission:\nClick "Submit Field Incident Report" on the main dashboard to broadcast ground GPS coordinates, hazard category, and structural damage level directly into Firestore.`;
    }

    if (q.includes('climate') || q.includes('globe') || q.includes('risk')) {
      return `🌐 3D Climate Intelligence Module:\nSwitch between India (States) and Global (Countries) GeoJSON layers to analyze radar risk scores, historical decade frequencies, and regional vulnerability factors.`;
    }

    return `Woof! I have logged your dispatch query: "${userQuery}". You can check the Tactical Map, Dispatch Priority Queue, or Video Threat Analysis tab for real-time telemetry.`;
  };

  const handleSendMessage = (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg = {
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    setTimeout(() => {
      const replyText = generateBotReply(text);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 500);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[3000] font-sans">
      
      {/* Floating Rescue Buddy Icon Image OVER the Chatbot */}
      {!isOpen && (
        <div className="relative group">
          {/* Floating Rescue Buddy Mascot Image */}
          <div className="absolute -top-14 right-2 sm:right-4 z-10 flex flex-col items-center animate-bounce duration-1000 cursor-pointer pointer-events-auto" onClick={() => setIsOpen(true)}>
            <div className="bg-blue-950/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-400 shadow-lg whitespace-nowrap mb-1 flex items-center space-x-1 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Rescue Buddy 🐾</span>
            </div>
            <img
              src="/rescue_buddy.png"
              alt="Rescue Buddy Mascot"
              className="w-14 h-14 object-contain rounded-full shadow-2xl border-2 border-blue-400 bg-slate-950 p-1 hover:scale-110 transition duration-300 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]"
            />
          </div>

          {/* Floating Toggle Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative flex items-center space-x-3 bg-blue-900 hover:bg-blue-800 text-white px-6 py-4 rounded-full shadow-2xl shadow-blue-950/80 border-2 border-blue-500 transition-all duration-300 transform hover:scale-105 mt-4"
          >
            <div className="relative">
              <Bot className="w-6 h-6 text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></span>
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold tracking-wider text-white uppercase flex items-center space-x-1">
                <span>RECON-AI</span>
                <span className="text-blue-300">• Buddy</span>
              </div>
              <div className="text-[10px] text-blue-200">Click to open chat</div>
            </div>
          </button>
        </div>
      )}

      {/* Expanded Chat Window Container */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[540px] bg-slate-950/95 text-white border-2 border-blue-600 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header with Rescue Buddy Avatar */}
          <div className="bg-blue-950 border-b border-blue-800 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src="/rescue_buddy.png"
                  alt="Rescue Buddy Avatar"
                  className="w-10 h-10 object-contain rounded-full border border-blue-400 bg-slate-900 p-0.5 shadow-md"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950"></span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">RECON-AI // RESCUE BUDDY</h3>
                </div>
                <p className="text-[11px] text-blue-200 flex items-center space-x-1">
                  <span>Tactical Emergency Assistant</span>
                  <span>• Online</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/60">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {msg.sender === 'user' ? (
                  <div className="p-1.5 rounded-full bg-blue-600 flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                ) : (
                  <img
                    src="/rescue_buddy.png"
                    alt="Rescue Buddy"
                    className="w-7 h-7 object-contain rounded-full border border-blue-500 bg-slate-900 p-0.5 flex-shrink-0"
                  />
                )}

                <div className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed shadow ${
                  msg.sender === 'user'
                    ? 'bg-blue-800 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-blue-900/60 text-slate-100 rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-line">{msg.text}</div>
                  <div className={`text-[9px] mt-1.5 text-right ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-2 text-xs text-blue-300">
                <img src="/rescue_buddy.png" alt="Rescue Buddy Typing" className="w-5 h-5 animate-spin" />
                <span className="italic">Rescue Buddy is analyzing telemetry...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Prompt Chips */}
          <div className="px-3 py-2 bg-slate-900/80 border-t border-blue-900/40 flex flex-nowrap overflow-x-auto gap-1.5 scrollbar-none">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 px-2.5 py-1 rounded-full transition flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-blue-950 border-t border-blue-800 flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Rescue Buddy about victims, status, or scoring..."
              className="flex-1 bg-slate-900 text-white border border-blue-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 placeholder-slate-400"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2 bg-blue-900 hover:bg-blue-800 text-white border border-blue-700 rounded-xl disabled:opacity-40 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
