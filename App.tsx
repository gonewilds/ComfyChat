import React, { useState } from 'react';
import { Chat } from './components/Chat';
import { Gallery } from './components/Gallery';
import { SettingsPanel } from './components/Settings';
import { ViewMode } from './types';
import { MessageSquare, Image, Settings as SettingsIcon, Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavItem = ({ mode, icon: Icon, label }: { mode: ViewMode; icon: any; label: string }) => (
    <button
      onClick={() => {
        setView(mode);
        setMobileMenuOpen(false);
      }}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full ${
        view === mode 
          ? 'bg-[#404249] text-white' 
          : 'text-gray-400 hover:bg-[#35373c] hover:text-gray-200'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#1e1f22]">
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-64 bg-[#2b2d31] p-3 gap-2">
        <div className="mb-4 px-3 py-2">
          <h1 className="text-indigo-400 font-bold text-xl tracking-tight">ComfyChat</h1>
        </div>
        <NavItem mode="chat" icon={MessageSquare} label="Chat" />
        <NavItem mode="gallery" icon={Image} label="Gallery" />
        <NavItem mode="settings" icon={SettingsIcon} label="Settings" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-[#2b2d31] shadow-sm z-20">
          <h1 className="text-indigo-400 font-bold text-lg">ComfyChat</h1>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-200">
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="absolute top-[60px] inset-x-0 bottom-0 bg-[#2b2d31] z-30 p-4 space-y-2 md:hidden">
            <NavItem mode="chat" icon={MessageSquare} label="Chat" />
            <NavItem mode="gallery" icon={Image} label="Gallery" />
            <NavItem mode="settings" icon={SettingsIcon} label="Settings" />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative h-full">
          {/* 
             Fix: Keep Chat mounted to preserve WebSocket and generating state.
             We use display: none (via 'hidden' class) instead of unmounting.
          */}
          <div className={view === 'chat' ? 'h-full block' : 'hidden'}>
            <Chat />
          </div>
          
          {view === 'gallery' && <Gallery />}
          {view === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  );
};

export default App;