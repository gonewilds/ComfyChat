
import React, { useEffect, useRef, useState, memo } from 'react';
import { Send, RefreshCw, Star, Image as ImageIcon, Loader2, Trash2, Hash, Settings, Download, X, Dices, PlusCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { parseWorkflow, prepareWorkflow, getImageUrl, getBaseUrl } from '../utils/comfyHelper';
import { ChatMessage, Settings as SettingsType } from '../types';

// --- Components ---

// Advanced Lightbox with Zoom and Pan
const Lightbox = ({ src, onClose }: { src: string, onClose: () => void }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 1) {
      setZoom(2.5);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
       <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-50 bg-black/50 rounded-full"
       >
         <X className="w-8 h-8" />
       </button>
       
       <img 
         src={src} 
         alt="Full size"
         draggable={false}
         className="transition-transform duration-200 ease-out max-w-full max-h-full object-contain select-none"
         style={{
           transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
           cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
         }}
         onClick={(e) => e.stopPropagation()}
         onDoubleClick={handleDoubleClick}
         onMouseDown={handleMouseDown}
       />
       
       {zoom === 1 && (
         <div className="absolute bottom-10 bg-black/50 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
           Double click to zoom
         </div>
       )}
    </div>
  );
};

const ChatImage = memo(({ blob, url, alt, onFavorite, onGenerateMore, onEnlarge }: { 
  blob?: Blob, 
  url?: string, 
  alt: string,
  onFavorite: () => void,
  onGenerateMore: () => void,
  onEnlarge: (src: string) => void
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (blob) {
      const newUrl = URL.createObjectURL(blob);
      setObjectUrl(newUrl);
      return () => URL.revokeObjectURL(newUrl);
    }
  }, [blob]);

  const src = objectUrl || url;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `comfy-generated-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite();
  };

  const handleGenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenerateMore();
  };

  if (!src) return null;

  return (
    <div className="mt-2 relative inline-block rounded-lg overflow-hidden bg-black/20 border border-gray-700 group">
      <img 
        src={src} 
        alt={alt} 
        className="max-w-full md:max-w-sm lg:max-w-md h-auto block cursor-zoom-in"
        onClick={() => onEnlarge(src)}
      />
      
      <div className="absolute top-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button 
          onClick={handleDownload}
          className="bg-black/50 hover:bg-gray-700 p-1.5 rounded text-white backdrop-blur-sm transition-colors"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>
        <button 
          onClick={handleFavoriteClick}
          className="bg-black/50 hover:bg-yellow-500/80 p-1.5 rounded text-white backdrop-blur-sm transition-colors"
          title="Add to Favorites"
        >
          <Star className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex justify-center">
        <button
          onClick={handleGenerateClick}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <RefreshCw className="w-3 h-3" />
          Generate More
        </button>
      </div>
    </div>
  );
});

const MessageBubble = ({ role, content }: { role: 'user' | 'bot', content: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div 
      onClick={handleCopy}
      title="Click to copy"
      className={`p-3 rounded-lg text-gray-100 whitespace-pre-wrap cursor-pointer transition-colors relative active:scale-[0.99]
        ${role === 'user' 
          ? 'bg-[#2b2d31] rounded-tr-none hover:bg-[#35373c]' 
          : 'bg-[#2b2d31] rounded-tl-none hover:bg-[#35373c]'
        }`}
    >
      {content}
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10">
          Copied!
        </span>
      )}
    </div>
  );
};

export const Chat: React.FC = () => {
  const messages = useLiveQuery(() => db.messages.orderBy('timestamp').toArray());
  const settingsArray = useLiveQuery(() => db.settings.toArray());
  const settings = settingsArray?.[0];
  
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [enlargedSrc, setEnlargedSrc] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef(uuidv4());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  useEffect(() => {
    if (!settings) return;

    const { apiHost, authToken } = settings;
    const baseUrl = getBaseUrl(apiHost);
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const hostWithoutProtocol = baseUrl.replace(/^https?:\/\//, '');
    let wsUrl = `${wsProtocol}://${hostWithoutProtocol}/ws?clientId=${clientId.current}`;
    if (authToken) wsUrl += `&token=${encodeURIComponent(authToken)}`;

    const connect = () => {
      if (wsRef.current) wsRef.current.close();
      try {
        const ws = new WebSocket(wsUrl);
        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'executing' && data.data.node === null) {
              setIsGenerating(false);
            }
            if (data.type === 'executed') {
               const images = data.data.output.images;
               if (images && images.length > 0) {
                 const imgData = images[0];
                 const fullUrl = getImageUrl(apiHost, imgData.filename, imgData.subfolder, imgData.type);
                 try {
                   const headers: Record<string, string> = {};
                   if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
                   const res = await fetch(fullUrl, { headers });
                   if (!res.ok) throw new Error(`Image fetch failed`);
                   const blob = await res.blob();
                   await db.messages.add({
                     role: 'bot',
                     content: '',
                     imageUrl: fullUrl,
                     imageBlob: blob,
                     timestamp: Date.now(),
                     status: 'complete',
                   });
                 } catch (err) {
                   await db.messages.add({
                      role: 'bot',
                      content: 'Image generated but failed to download. Check console.',
                      imageUrl: fullUrl,
                      timestamp: Date.now(),
                      status: 'error'
                   });
                 }
               }
            }
          } catch (e) {}
        };
        wsRef.current = ws;
      } catch (e) {}
    };
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [settings]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = async (promptText: string) => {
    if (!promptText.trim()) return;
    if (!settings) return;

    const { apiHost, workflowJson, authToken, seedMode, lastSeed } = settings;
    const workflow = parseWorkflow(workflowJson);
    if (!workflow) return;

    await db.messages.add({
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
      status: 'complete'
    });
    
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsGenerating(true);

    try {
      const { workflow: promptWorkflow, appliedSeed } = prepareWorkflow(
        workflow, 
        promptText, 
        seedMode || 'random', 
        lastSeed || 0
      );
      
      // Update the last seed in the database
      await db.settings.update(1, { lastSeed: appliedSeed });

      const baseUrl = getBaseUrl(apiHost);
      const url = `${baseUrl}/prompt`;
      const body = { client_id: clientId.current, prompt: promptWorkflow };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    } catch (e) {
      await db.messages.add({
        role: 'bot',
        content: `Error: ${(e as Error).message}`,
        timestamp: Date.now(),
        status: 'error'
      });
      setIsGenerating(false);
    }
  };

  const handleGenerateMore = async (msgId: number) => {
    if (!messages) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;
    let prompt = "";
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        prompt = messages[i].content;
        break;
      }
    }
    if (prompt) await handleSend(prompt);
  };

  const handleFavorite = async (msg: ChatMessage) => {
    if (msg.imageBlob) {
      let prompt = "Unknown prompt";
      if (messages) {
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            prompt = messages[i].content;
            break;
          }
        }
      }
      await db.favorites.add({ prompt, imageBlob: msg.imageBlob, timestamp: Date.now() });
      alert("Added to gallery!");
    }
  };

  const toggleSeedMode = async () => {
    if (!settings) return;
    const nextMode = settings.seedMode === 'random' ? 'increment' : 'random';
    await db.settings.update(1, { seedMode: nextMode });
  };

  if (settingsArray === undefined) return null;
  if (!settings) {
    return (
      <div className="flex flex-col h-full bg-[#313338] items-center justify-center p-6 text-center">
        <div className="bg-[#2b2d31] p-8 rounded-lg shadow-lg max-w-md">
           <Settings className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-white mb-2">Setup Required</h2>
           <p className="text-gray-400 mb-6">Configure ComfyUI in Settings to start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      <div className="h-12 border-b border-[#26272d] flex items-center justify-between px-4 bg-[#313338] shadow-sm flex-shrink-0">
         <div className="flex items-center gap-2 text-gray-200 font-bold">
            <Hash className="w-5 h-5 text-gray-400" />
            <span>general</span>
         </div>
         <button 
           onClick={() => db.messages.clear()}
           className="text-gray-400 hover:text-red-400 transition-colors"
           title="Clear Chat History"
         >
           <Trash2 className="w-5 h-5" />
         </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <ImageIcon className="w-16 h-16 mb-4" />
            <p>Ready to generate. Type a prompt below.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-white">{msg.role === 'user' ? 'You' : 'ComfyBot'}</span>
                  <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                {msg.content && <MessageBubble role={msg.role} content={msg.content} />}
                {(msg.imageBlob || msg.imageUrl) && (
                   <ChatImage 
                     blob={msg.imageBlob} url={msg.imageUrl} alt="Generated"
                     onFavorite={() => handleFavorite(msg)}
                     onGenerateMore={() => msg.id && handleGenerateMore(msg.id)}
                     onEnlarge={setEnlargedSrc}
                   />
                )}
              </div>
            </div>
          ))
        )}
        {isGenerating && (
           <div className="flex gap-4">
             <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">AI</div>
             <div className="flex items-center gap-2 text-gray-400 mt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating...</span>
             </div>
           </div>
        )}
      </div>

      <div className="p-3 md:p-4 bg-[#383a40] flex-shrink-0 border-t border-[#26272d]">
        <div className="bg-[#404249] rounded-lg p-2 flex items-end gap-2">
          {/* Quick toggle for seed mode */}
          <button 
            onClick={toggleSeedMode}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={`Current Seed Mode: ${settings.seedMode || 'random'}. Click to toggle.`}
          >
            {settings.seedMode === 'increment' ? <PlusCircle className="w-6 h-6 text-indigo-400" /> : <Dices className="w-6 h-6" />}
          </button>
          
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none px-2 py-2 resize-none max-h-32 min-h-[44px]"
            placeholder={isGenerating ? "Generating... (Type next prompt)" : "Type a prompt..."}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                e.preventDefault();
                handleSend(input);
              }
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isGenerating || !input.trim()}
            className="p-2 mb-0.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>

      {enlargedSrc && <Lightbox src={enlargedSrc} onClose={() => setEnlargedSrc(null)} />}
    </div>
  );
};
