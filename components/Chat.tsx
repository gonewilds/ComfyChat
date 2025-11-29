import React, { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw, Star, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { parseWorkflow, prepareWorkflow, getImageUrl } from '../utils/comfyHelper';
import { ChatMessage } from '../types';

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

    const host = settings[0].apiHost;
    const protocol = host.startsWith('http') ? host.replace('http', 'ws') : `ws://${host}`;
    // Handle cases where host doesn't include protocol
    const wsUrl = protocol.includes('ws') ? `${protocol}/ws?clientId=${clientId.current}` : `ws://${host}/ws?clientId=${clientId.current}`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log("Connected to ComfyUI");
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
               const fullUrl = getImageUrl(host, imgData.filename, imgData.subfolder, imgData.type);
               
               // Fetch image to store as blob
               try {
                 const res = await fetch(fullUrl);
                 const blob = await res.blob();
                 
                 // Find the placeholder message and update it
                 // Since we don't have a direct prompt ID link from WS without advanced tracking,
                 // we'll assume the last 'loading' message is the one.
                 // Better approach: ComfyUI returns prompt_id. We should store prompt_id in DB.
                 // For this simple version, we'll append a new bot message.
                 
                 await db.messages.add({
                   role: 'bot',
                   content: '',
                   imageUrl: fullUrl,
                   imageBlob: blob,
                   timestamp: Date.now(),
                   status: 'complete',
                   // We need to attach the original prompt to this result for "Generate More"
                   // We'll simplisticly look at the last user message
                 });
                 
                 // Update the last user message or loading message?
                 // Let's remove any "Generating..." placeholders if we implemented them.
               } catch (err) {
                 console.error("Failed to fetch image blob", err);
               }
             }
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };
      
      ws.onclose = () => {
        console.log("WS Closed, retrying...");
        setTimeout(connect, 3000);
      };

      wsRef.current = ws;
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

    const { apiHost, workflowJson } = settings[0];
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
      const protocol = apiHost.startsWith('http') ? '' : 'http://';
      const url = `${protocol}${apiHost}/prompt`;
      
      const promptWorkflow = prepareWorkflow(workflow, promptText);
      
      const body = {
        client_id: clientId.current,
        prompt: promptWorkflow
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        content: `Error: ${(e as Error).message}. Check CORS and URL.`,
        timestamp: Date.now(),
        status: 'error'
      });
      setIsGenerating(false);
    }
  };

  const handleGenerateMore = async (originalPrompt: string) => {
    await handleSend(originalPrompt);
  };

  const handleFavorite = async (msg: ChatMessage) => {
    if (msg.imageBlob && msg.imageUrl) {
      // Find the prompt that generated this. 
      // Simplification: We iterate backwards from this message to find the first 'user' message
      // Or we can modify the DB structure to link them. 
      // For now, let's try to find the closest previous user message.
      
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

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
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

                {msg.imageUrl && (
                  <div className="mt-2 relative inline-block rounded-lg overflow-hidden bg-black/20 border border-gray-700">
                    <img 
                      src={msg.imageUrl} 
                      alt="Generated" 
                      className="max-w-full md:max-w-sm lg:max-w-md h-auto block"
                    />
                    
                    {/* Action Bar on Image */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleFavorite(msg)}
                        className="bg-black/50 hover:bg-yellow-500/80 p-1.5 rounded text-white backdrop-blur-sm transition-colors"
                        title="Add to Favorites"
                      >
                        <Star className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                      <button
                        onClick={() => {
                           // Find prompt again logic, same as favorite...
                           // Ideally we store prompt in msg object.
                           // Let's do the lookup here for now.
                           let prompt = "";
                           if (messages) {
                            const msgIndex = messages.findIndex(m => m.id === msg.id);
                            for (let i = msgIndex - 1; i >= 0; i--) {
                              if (messages[i].role === 'user') {
                                prompt = messages[i].content;
                                break;
                              }
                            }
                           }
                           if(prompt) handleGenerateMore(prompt);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg transition-transform hover:scale-105"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Generate More
                      </button>
                    </div>
                  </div>
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
      <div className="p-4 bg-[#383a40]">
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
