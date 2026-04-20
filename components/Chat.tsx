
import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from 'react';
import { Send, RefreshCw, Star, Image as ImageIcon, Loader2, Trash2, Hash, Settings, Download, X, Dices, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { parseWorkflow, prepareWorkflow, getImageUrl, getBaseUrl, uploadImage } from '../utils/comfyHelper';
import { ChatMessage, Settings as SettingsType } from '../types';

// --- Components ---

// Advanced Lightbox with Zoom, Pan, and Navigation (Swipe/Arrows)
const Lightbox = ({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Touch swipe states
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeThreshold = 50;

  const currentSrc = images[currentIndex];

  const handleNext = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentIndex, images.length]);

  const handlePrev = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext(e);
      if (e.key === 'ArrowLeft') handlePrev(e);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

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

  // Swipe logic
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1) return; // Disable swipe when zoomed
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (zoom > 1) return;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (zoom > 1 || !touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > swipeThreshold;
    const isRightSwipe = distance < -swipeThreshold;

    if (isLeftSwipe) handleNext();
    else if (isRightSwipe) handlePrev();

    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
       {/* UI Controls */}
       <div className="absolute top-4 inset-x-4 flex justify-between items-center z-50 pointer-events-none">
         <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-auto">
           {currentIndex + 1} / {images.length}
         </div>
         <button 
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white transition-colors bg-black/50 rounded-full pointer-events-auto"
         >
           <X className="w-8 h-8" />
         </button>
       </div>
       
       {/* Desktop Navigation Arrows */}
       {currentIndex > 0 && zoom === 1 && (
         <button 
           onClick={handlePrev}
           className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white transition-colors z-50 bg-black/20 hover:bg-black/40 rounded-full"
         >
           <ChevronLeft className="w-10 h-10" />
         </button>
       )}
       {currentIndex < images.length - 1 && zoom === 1 && (
         <button 
           onClick={handleNext}
           className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white transition-colors z-50 bg-black/20 hover:bg-black/40 rounded-full"
         >
           <ChevronRight className="w-10 h-10" />
         </button>
       )}
       
       <img 
         key={currentSrc}
         src={currentSrc} 
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
       
       <div className="absolute bottom-10 flex flex-col items-center gap-2 pointer-events-none">
          {zoom === 1 && (
            <div className="bg-black/50 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
              {window.matchMedia('(pointer: coarse)').matches ? 'Swipe to browse • Double tap to zoom' : 'Arrows to browse • Double click to zoom'}
            </div>
          )}
       </div>
    </div>
  );
};

const ChatImage = memo(({ blob, url, alt, onFavorite, onGenerateMore, onEnlarge, isBot = true, isThumbnail = false }: { 
  blob?: Blob, 
  url?: string, 
  alt: string,
  onFavorite: () => void,
  onGenerateMore: () => void,
  onEnlarge: (src: string) => void,
  isBot?: boolean,
  isThumbnail?: boolean
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
    <div className={`${isThumbnail ? 'mt-1 mb-1' : 'mt-2'} flex flex-col ${isThumbnail ? 'items-end' : 'items-start'} gap-2`}>
      {/* Image Container */}
      <div className={`relative inline-block rounded-lg overflow-hidden bg-black/20 border border-gray-700 group hover:border-gray-500 transition-colors ${isThumbnail ? 'shadow-sm' : ''}`}>
        <img 
          src={src} 
          alt={alt} 
          className={`${isThumbnail ? 'h-20 w-auto max-w-[120px]' : 'max-w-full md:max-w-sm lg:max-w-md h-auto'} block cursor-zoom-in object-cover`}
          onClick={() => onEnlarge(src)}
        />
        
        {/* Quick Actions (Download/Favorite) - Only for full images */}
        {!isThumbnail && (
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
        )}
      </div>

      {/* External Action Bar */}
      {isBot && !isThumbnail && (
        <div className="flex gap-2">
          <button
            onClick={handleGenerateClick}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded shadow transition-all active:scale-95 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate More
          </button>
        </div>
      )}
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
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const clientId = useRef(uuidv4());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive list of all images for the lightbox
  const imageMessages = useMemo(() => {
    return (messages || []).filter(m => m.imageBlob || m.imageUrl);
  }, [messages]);

  // Handle object URL lifecycle for images in the gallery
  const imageSrcs = useMemo(() => {
    return imageMessages.map(m => {
      if (m.imageBlob) {
        return URL.createObjectURL(m.imageBlob);
      }
      return m.imageUrl || '';
    });
  }, [imageMessages]);

  // Clean up object URLs on unmount or when imageSrcs changes
  useEffect(() => {
    return () => {
      imageSrcs.forEach(src => {
        if (src.startsWith('blob:')) {
          URL.revokeObjectURL(src);
        }
      });
    };
  }, [imageSrcs]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (promptText: string) => {
    if (!promptText.trim() && !imageFile) return;
    if (!settings) return;

    const { apiHost, workflowJson, authToken, seedMode, lastSeed } = settings;
    const workflow = parseWorkflow(workflowJson);
    if (!workflow) return;

    setIsGenerating(true);
    let imageFilename = '';

    try {
      // 1. Upload image if exists
      if (imageFile) {
        const uploadRes = await uploadImage(apiHost, imageFile, authToken);
        imageFilename = uploadRes.name;
      }

      // Add user message with image if present
      await db.messages.add({
        role: 'user',
        content: promptText,
        imageBlob: imageFile || undefined,
        timestamp: Date.now(),
        status: 'complete'
      });
      
      setInput('');
      clearImage();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const { workflow: promptWorkflow, appliedSeed } = prepareWorkflow(
        workflow, 
        promptText, 
        seedMode || 'random', 
        lastSeed || 0,
        imageFilename
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
                
                {/* User uploaded image as thumbnail BEFORE the prompt */}
                {msg.role === 'user' && (msg.imageBlob || msg.imageUrl) && (
                   <ChatImage 
                     blob={msg.imageBlob} url={msg.imageUrl} alt="Upload"
                     isBot={false} 
                     isThumbnail={true}
                     onFavorite={() => handleFavorite(msg)}
                     onGenerateMore={() => msg.id && handleGenerateMore(msg.id)}
                     onEnlarge={() => {
                       const index = imageMessages.findIndex(m => m.id === msg.id);
                       if (index !== -1) setEnlargedIndex(index);
                     }}
                   />
                )}

                {msg.content && <MessageBubble role={msg.role} content={msg.content} />}
                
                {/* Bot generated image AFTER the prompt */}
                {msg.role === 'bot' && (msg.imageBlob || msg.imageUrl) && (
                   <ChatImage 
                     blob={msg.imageBlob} url={msg.imageUrl} alt="Generated"
                     isBot={true}
                     isThumbnail={false}
                     onFavorite={() => handleFavorite(msg)}
                     onGenerateMore={() => msg.id && handleGenerateMore(msg.id)}
                     onEnlarge={() => {
                       const index = imageMessages.findIndex(m => m.id === msg.id);
                       if (index !== -1) setEnlargedIndex(index);
                     }}
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
        {imagePreview && (
          <div className="px-1 pb-3">
            <div className="relative inline-block group">
              <img src={imagePreview} className="h-24 w-auto max-w-xs object-contain rounded-md border-2 border-indigo-500/50 shadow-lg" />
              <button 
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white shadow-md hover:bg-red-600 transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div className="bg-[#404249] rounded-lg p-2 flex items-end gap-2">
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 transition-colors ${imageFile ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
            title="Upload Image"
          >
            <PlusCircle className="w-6 h-6" />
          </button>

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

      {enlargedIndex !== null && (
        <Lightbox 
          images={imageSrcs} 
          initialIndex={enlargedIndex} 
          onClose={() => setEnlargedIndex(null)} 
        />
      )}
    </div>
  );
};
