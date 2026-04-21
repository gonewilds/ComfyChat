
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, AlertCircle, Wifi, CheckCircle, XCircle, Key, Dices, PlusCircle, Trash2, Edit3, Circle, Check } from 'lucide-react';
import { getBaseUrl } from '../utils/comfyHelper';
import { WorkflowProfile } from '../types';

const DEFAULT_WORKFLOW = `{
  "3": {
    "inputs": {
      "seed": 156680208700286,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": {
      "ckpt_name": "v1-5-pruned-emaonly.ckpt"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": 512,
      "height": 512,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "%PROMPT%",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "text, watermark",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
  }
}`;

export const SettingsPanel: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const profiles = useLiveQuery(() => db.profiles.toArray());
  
  // Settings Local state (Global)
  const [apiHost, setApiHost] = useState('127.0.0.1:8188');
  const [authToken, setAuthToken] = useState('');
  
  // Profile Local state (Active Profile)
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('New Profile');
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);
  const [seedMode, setSeedMode] = useState<'random' | 'increment'>('random');
  const [lastSeed, setLastSeed] = useState<number>(0);
  
  // UI states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setApiHost(settings.apiHost);
      setAuthToken(settings.authToken || '');
      setActiveProfileId(settings.activeProfileId || null);
    }
  }, [settings]);

  // Load active profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (activeProfileId) {
        const profile = await db.profiles.get(activeProfileId);
        if (profile) {
          setProfileName(profile.name);
          setWorkflow(profile.workflowJson);
          setSeedMode(profile.seedMode);
          setLastSeed(profile.lastSeed);
        }
      }
    };
    loadProfile();
  }, [activeProfileId]);

  const saveSettings = useCallback(async () => {
    await db.settings.put({
      id: 1,
      apiHost: apiHost.trim().endsWith('/') ? apiHost.trim().slice(0, -1) : apiHost.trim(),
      authToken: authToken.trim(),
      activeProfileId: activeProfileId || undefined
    });
  }, [apiHost, authToken, activeProfileId]);

  const saveProfile = useCallback(async () => {
    if (!activeProfileId) return;
    setSaveStatus('saving');
    try {
      try {
        JSON.parse(workflow);
      } catch (e) {
        setSaveStatus('idle');
        alert("Invalid JSON in workflow");
        return; 
      }

      await db.profiles.update(activeProfileId, {
        name: profileName,
        workflowJson: workflow,
        seedMode: seedMode,
        lastSeed: lastSeed
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Failed to save profile", e);
      setSaveStatus('idle');
    }
  }, [activeProfileId, profileName, workflow, seedMode, lastSeed]);

  const handleCreateProfile = async () => {
    const id = await db.profiles.add({
      name: 'New Profile',
      workflowJson: DEFAULT_WORKFLOW,
      seedMode: 'random',
      lastSeed: 0
    });
    setActiveProfileId(id);
    await db.settings.update(1, { activeProfileId: id });
  };

  const handleDeleteProfile = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    await db.profiles.delete(id);
    if (activeProfileId === id) {
      const remaining = await db.profiles.toArray();
      const newActive = remaining[0]?.id || null;
      setActiveProfileId(newActive);
      await db.settings.update(1, { activeProfileId: newActive || undefined });
    }
  };

  const handleSwitchProfile = async (id: number) => {
    setActiveProfileId(id);
    await db.settings.update(1, { activeProfileId: id });
  };

  const handleBlur = () => {
    saveSettings();
    saveProfile();
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    const fetchUrl = getBaseUrl(apiHost);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const headers: Record<string, string> = {};
      if (authToken.trim()) headers['Authorization'] = `Bearer ${authToken.trim()}`;
      const res = await fetch(`${fetchUrl}/system_stats`, { signal: controller.signal, headers });
      clearTimeout(timeoutId);
      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Connected successfully!');
        saveSettings();
      } else {
        throw new Error(`Status: ${res.status} ${res.statusText}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.name === 'AbortError' ? 'Connection timed out.' : `Error: ${e.message}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <div className="text-sm text-gray-400 flex items-center gap-2">
            {saveStatus === 'saving' && <span className="animate-pulse">Saving profile...</span>}
            {saveStatus === 'saved' && <span className="text-green-400">Profile saved</span>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Global Config & Profiles List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md space-y-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Global Configuration</h3>
            
            {/* Host Configuration */}
            <div>
              <label className="block text-gray-300 text-xs font-bold mb-2">ComfyUI Host URL</label>
              <input
                type="text"
                value={apiHost}
                onChange={(e) => setApiHost(e.target.value)}
                onBlur={saveSettings}
                className="w-full bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. 127.0.0.1:8188"
              />
            </div>

            {/* Auth Token Configuration */}
            <div>
              <label className="block text-gray-300 text-xs font-bold mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" /> Vast.ai Token
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  onBlur={saveSettings}
                  className="flex-1 bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="(Optional)"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors disabled:opacity-50"
                  title="Test Connection"
                >
                  <Wifi className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-pulse' : ''}`} />
                </button>
              </div>
              {testStatus !== 'idle' && (
                <div className={`mt-2 text-xs flex items-center gap-1.5 ${testStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {testStatus === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{testMessage}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Workflow Profiles</h3>
              <button 
                onClick={handleCreateProfile}
                className="text-indigo-400 hover:text-indigo-300 transition-colors" 
                title="Add Profile"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {profiles?.map((p) => (
                <div 
                  key={p.id}
                  className={`flex items-center gap-2 p-2 rounded transition-all cursor-pointer group ${
                    activeProfileId === p.id ? 'bg-indigo-500/20 border border-indigo-500/50' : 'bg-[#1e1f22] border border-transparent hover:border-gray-700'
                  }`}
                  onClick={() => handleSwitchProfile(p.id!)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{p.name}</div>
                  </div>
                  {activeProfileId === p.id ? (
                    <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id!); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {(!profiles || profiles.length === 0) && (
                <div className="text-center py-4 text-gray-500 text-sm italic">No profiles found</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Profile Editor */}
        <div className="lg:col-span-2 space-y-6">
          {!activeProfileId ? (
            <div className="h-full flex flex-col items-center justify-center bg-[#2b2d31]/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-center">
              <PlusCircle className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-400 mb-2">No Profile Selected</h3>
              <p className="text-gray-500 text-sm mb-6">Create a new profile or select one from the left to start configuring your workflows.</p>
              <button onClick={handleCreateProfile} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded font-bold transition-colors">
                Create First Profile
              </button>
            </div>
          ) : (
            <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    onBlur={saveProfile}
                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none placeholder-gray-600"
                    placeholder="Profile Name"
                  />
                  <div className="text-xs text-gray-400 font-medium">Currently editing workflow settings</div>
                </div>
              </div>

              {/* Seed Configuration */}
              <div>
                <label className="block text-gray-300 text-xs font-bold mb-4 uppercase tracking-wider">Generation Seed Strategy</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setSeedMode('random'); setTimeout(saveProfile, 0); }}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 transition-all ${
                      seedMode === 'random' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Dices className="w-5 h-5" />
                    <div className="text-xs font-bold">Randomize</div>
                  </button>
                  <button
                    onClick={() => { setSeedMode('increment'); setTimeout(saveProfile, 0); }}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 transition-all ${
                      seedMode === 'increment' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <PlusCircle className="w-5 h-5" />
                    <div className="text-xs font-bold">Increment (+1)</div>
                  </button>
                </div>
                
                <div className="mt-4">
                  <label className="block text-gray-400 text-[10px] font-bold mb-1 uppercase tracking-wider">Starting / Last Seed</label>
                  <input
                    type="number"
                    value={lastSeed}
                    onChange={(e) => setLastSeed(parseInt(e.target.value) || 0)}
                    onBlur={saveProfile}
                    className="w-full bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-1.5 px-3 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
                  />
                </div>
              </div>

              {/* Workflow Configuration */}
              <div>
                <label className="block text-gray-300 text-xs font-bold mb-2 uppercase tracking-wider">Workflow API JSON</label>
                <div className="bg-yellow-900/20 border border-yellow-700/30 p-2.5 rounded mb-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-200 uppercase font-bold tracking-tight">
                    API format required. Use <code>%PROMPT%</code> for input.
                  </p>
                </div>
                <textarea
                  value={workflow}
                  onChange={(e) => setWorkflow(e.target.value)}
                  onBlur={saveProfile}
                  spellCheck={false}
                  className="w-full bg-[#1e1f22] text-gray-300 font-mono text-[10px] border border-[#1e1f22] rounded py-2 px-3 h-96 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <button
                onClick={saveProfile}
                className="flex items-center justify-center w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded text-sm transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveStatus === 'saved' ? 'Saved!' : 'Manual Save Profile'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
