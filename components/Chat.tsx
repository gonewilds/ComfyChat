import React, { useEffect, useRef, useState, memo } from 'react';
import { Send, RefreshCw, Star, Image as ImageIcon, Loader2, Trash2, Hash, Settings } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { parseWorkflow, prepareWorkflow, getImageUrl, getBaseUrl } from '../utils/comfyHelper';
import { ChatMessage } from '../types';

// Memoized Image Component to handle Blob URLs efficiently
const ChatImage = memo(({ blob, url, alt, onFavorite, onGenerateMore }: { 
  blob?: Blob, 
  url?: string, 
  alt: string,
  onFavorite: () => void,
  onGenerateMore: () => void
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

  if (!src) return null;

  return (
    <div className="mt-2 relative inline-block rounded-lg overflow-hidden bg-black/20 border border-gray-700 group">
      <img 
        src={src} 
        alt={alt} 
        className="max-w-full md:max-w-sm lg:max-w-md h-auto block"
      />
      
      {/* Action Bar on Image */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={onFavorite}
          className="bg-black/50 hover:bg-yellow-500/80 p-1.5 rounded text-white backdrop-blur-sm transition-colors"
          title="Add to Favorites"
        >
          <Star className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
        <button
          onClick={onGenerateMore}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <RefreshCw className="w-3 h-3" />
          Generate More
        </button>
      </div>
    </div>
  );
});

export const Chat: React.FC = () => {
  const messages = useLiveQuery(() => db.messages.orderBy('timestamp').toArray());
  const settings = useLiveQuery(() => db.settings.toArray());
  
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef(uuidv4());

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Establish WebSocket connection
  useEffect(() => {
    if (!settings || settings.length === 0) return;

    const { apiHost, authToken } = settings[0];
    
    // Determine WS protocol based on API host protocol
    const baseUrl = getBaseUrl(apiHost);
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const hostWithoutProtocol = baseUrl.replace(/^https?:\/\//, '');
    let wsUrl = `${wsProtocol}://${hostWithoutProtocol}/ws?clientId=${clientId.current}`;
    
    if (authToken) {
      wsUrl += `&token=${encodeURIComponent(authToken)}`;
    }

    const connect = () => {
      // Close existing if open
      if (wsRef.current) wsRef.current.close();

      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => console.log("Connected to ComfyUI WS");
        ws.onerror = (err) => console.log("WS Error", err); // Prevent crash
        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'execution_start') {
               // Maybe update status of pending message
            }
            
            if (data.type === 'executing' && data.data.node === null) {
              // Execution finished
              setIsGenerating(false);
            }

            if (data.type === 'executed') {
               // Image generated
               const images = data.data.output.images;
               if (images && images.length > 0) {
                 const imgData = images[0];
                 const fullUrl = getImageUrl(apiHost, imgData.filename, imgData.subfolder, imgData.type);
                 
                 // Fetch image to store as blob (Authorized Fetch)
                 try {
                   const headers: Record<string, string> = {};
                   if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

                   const res = await fetch(fullUrl, { headers });
                   if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
                   
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
                   console.error("Failed to fetch image blob", err);
                   // Even if blob fetch fails (e.g. CORS), we save the entry so user knows something happened
                   await db.messages.add({
                      role: 'bot',
                      content: 'Image generated but failed to download. Check console for CORS errors.',
                      imageUrl: fullUrl,
                      timestamp: Date.now(),
                      status: 'error'
                   });
                 }
               }
            }
          } catch (e) {
            console.error("WS Parse error", e);
          }
        };
        
        ws.onclose = () => {
          // console.log("WS Closed"); 
        };

        wsRef.current = ws;
      } catch (e) {
        console.error("Failed to create WebSocket", e);
      }
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [settings]);

  const handleSend = async (promptText: string) => {
    if (!promptText.trim()) return;
    if (!settings || settings.length === 0) {
      alert("Please configure settings first.");
      return;
    }

    const { apiHost, workflowJson, authToken } = settings[0];
    const workflow = parseWorkflow(workflowJson);
    
    if (!workflow) {
      alert("Invalid Workflow JSON in settings.");
      return;
    }

    // Add user message
    await db.messages.add({
      role: 'user',
      content: promptText,
      timestamp: Date.now(),
      status: 'complete'
    });
    
    setInput('');
    setIsGenerating(true);

    try {
      const baseUrl = getBaseUrl(apiHost);
      const url = `${baseUrl}/prompt`;
      
      const promptWorkflow = prepareWorkflow(workflow, promptText);
      
      const body = {
        client_id: clientId.current,
        prompt: promptWorkflow
      };

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json' 
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
      }
      
      // We rely on WebSocket to deliver the result
      
    } catch (e) {
      console.error(e);
      await db.messages.add({
        role: 'bot',
        content: `Error: ${(e as Error).message}. Check CORS, URL, and Token.`,
        timestamp: Date.now(),
        status: 'error'
      });
      setIsGenerating(false);
    }
  };

  const handleGenerateMore = async (msgId: number) => {
    // Find the prompt related to this message
    if (!messages) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // Look backwards for the user prompt
    let prompt = "";
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        prompt = messages[i].content;
        break;
      }
    }

    if (prompt) {
      await handleSend(prompt);
    } else {
      alert("Could not find original prompt.");
    }
  };

  const handleFavorite = async (msg: ChatMessage) => {
    if (msg.imageBlob) {
      // Find prompt
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

      await db.favorites.add({
        prompt: prompt,
        imageBlob: msg.imageBlob,
        timestamp: Date.now()
      });
      alert("Added to gallery!");
    }
  };

  const handleClearChat = async () => {
    if (confirm("Are you sure you want to delete all messages? This cannot be undone.")) {
      await db.messages.clear();
    }
  };

  // Check if settings exist
  if (settings === undefined) return null; // Loading
  if (settings.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#313338] items-center justify-center p-6 text-center">
        <div className="bg-[#2b2d31] p-8 rounded-lg shadow-lg max-w-md">
           <Settings className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-white mb-2">Setup Required</h2>
           <p className="text-gray-400 mb-6">
             Please configure your ComfyUI API endpoint and workflow in the settings menu to start generating images.
           </p>
           {/* Note: In a real app we might use a context to switch views, but here we rely on the user clicking the sidebar */}
           <div className="text-sm text-indigo-300">
             Open the <strong>Settings</strong> tab to continue.
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      {/* Header Bar */}
      <div className="h-12 border-b border-[#26272d] flex items-center justify-between px-4 bg-[#313338] shadow-sm flex-shrink-0">
         <div className="flex items-center gap-2 text-gray-200 font-bold">
            <Hash className="w-5 h-5 text-gray-400" />
            <span>general</span>
         </div>
         <button 
           onClick={handleClearChat}
           className="text-gray-400 hover:text-red-400 transition-colors"
           title="Clear Chat History"
         >
           <Trash2 className="w-5 h-5" />
         </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0"
      >
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <ImageIcon className="w-16 h-16 mb-4" />
            <p>Ready to generate. Type a prompt below.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={msg.id || idx} 
              className={`flex gap-4 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-white">
                    {msg.role === 'user' ? 'You' : 'ComfyBot'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>

                {msg.content && (
                  <div className={`p-3 rounded-lg text-gray-100 whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#2b2d31] rounded-tr-none' : 'bg-[#2b2d31] rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                )}

                {(msg.imageBlob || msg.imageUrl) && (
                   <ChatImage 
                     blob={msg.imageBlob}
                     url={msg.imageUrl}
                     alt="Generated Image"
                     onFavorite={() => handleFavorite(msg)}
                     onGenerateMore={() => msg.id && handleGenerateMore(msg.id)}
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

      {/* Input Area */}
      <div className="p-4 bg-[#383a40] flex-shrink-0">
        <div className="bg-[#404249] rounded-lg p-2 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none px-2"
            placeholder={isGenerating ? "Wait for generation to finish..." : "Type a prompt..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            disabled={isGenerating}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={isGenerating || !input.trim()}
            className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};