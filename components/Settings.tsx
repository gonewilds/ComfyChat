
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, AlertCircle, Wifi, CheckCircle, XCircle, Key, Dices, PlusCircle, Trash2, Edit3, Settings as SettingsIcon } from 'lucide-react';
import { getBaseUrl } from '../utils/comfyHelper';

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
  const profiles = useLiveQuery(() => db.profiles.orderBy('timestamp').toArray());
  
  // Local state
  const [apiHost, setApiHost] = useState('127.0.0.1:8188');
  const [authToken, setAuthToken] = useState('');
  const [seedMode, setSeedMode] = useState<'random' | 'increment'>('random');
  const [lastSeed, setLastSeed] = useState<number>(0);
  
  // Profile management
  const [activeProfileId, setActiveProfileId] = useState<number | undefined>(undefined);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('');
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);

  // UI states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Handle migration/initial profile creation
  useEffect(() => {
    const init = async () => {
      const existingSettings = await db.settings.get(1);
      const profileCount = await db.profiles.count();
      
      if (profileCount === 0 && existingSettings?.workflowJson) {
        // Migrate existing workflow to a "Default" profile
        await db.profiles.add({
          name: 'Default Workflow',
          workflowJson: existingSettings.workflowJson,
          timestamp: Date.now()
        });
        const firstProfile = await db.profiles.toCollection().first();
        if (firstProfile?.id) {
          await db.settings.update(1, { activeProfileId: firstProfile.id });
        }
      } else if (profileCount === 0) {
        // Create a fresh default profile
        const id = await db.profiles.add({
          name: 'Standard v1.5',
          workflowJson: DEFAULT_WORKFLOW,
          timestamp: Date.now()
        });
        await db.settings.update(1, { activeProfileId: id });
      }
    };
    init();
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setApiHost(settings.apiHost);
      setAuthToken(settings.authToken || '');
      setSeedMode(settings.seedMode || 'random');
      setLastSeed(settings.lastSeed || 0);
      setActiveProfileId(settings.activeProfileId);
    }
  }, [settings]);

  // Load active profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (activeProfileId) {
        const p = await db.profiles.get(activeProfileId);
        if (p) {
          setWorkflow(p.workflowJson);
          setProfileName(p.name);
          setEditingProfileId(p.id || null);
        }
      }
    };
    loadProfile();
  }, [activeProfileId]);

  const saveToDb = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Validate workflow JSON
      try {
        JSON.parse(workflow);
      } catch (e) {
        setSaveStatus('idle');
        return; 
      }

      let cleanHost = apiHost.trim();
      if (cleanHost.endsWith('/')) cleanHost = cleanHost.slice(0, -1);

      // Save Global Settings
      await db.settings.put({
        id: 1,
        apiHost: cleanHost,
        workflowJson: workflow, // Keep for fallback/legacy compatibility
        activeProfileId,
        authToken: authToken.trim(),
        seedMode: seedMode,
        lastSeed: lastSeed
      });

      // Save Profile Data
      if (editingProfileId) {
        await db.profiles.update(editingProfileId, {
          name: profileName || 'Unnamed Profile',
          workflowJson: workflow
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Failed to save", e);
      setSaveStatus('idle');
    }
  }, [apiHost, workflow, authToken, seedMode, lastSeed, activeProfileId, editingProfileId, profileName]);

  const handleAddNewProfile = async () => {
    const id = await db.profiles.add({
      name: 'New Workflow Profile',
      workflowJson: DEFAULT_WORKFLOW,
      timestamp: Date.now()
    });
    setActiveProfileId(id);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleDeleteProfile = async (id: number) => {
    if (profiles && profiles.length <= 1) {
      alert("You must have at least one workflow profile.");
      return;
    }
    if (confirm("Delete this profile?")) {
      await db.profiles.delete(id);
      if (activeProfileId === id) {
        const next = await db.profiles.toCollection().first();
        if (next?.id) setActiveProfileId(next.id);
      }
    }
  };

  const handleBlur = () => {
    saveToDb();
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
        saveToDb();
      } else {
        throw new Error(`Status: ${res.status} ${res.statusText}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.name === 'AbortError' ? 'Connection timed out.' : `Error: ${e.message}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <div className="text-sm text-gray-400 flex items-center gap-2">
            {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-green-400">All changes saved</span>}
        </div>
      </div>
      
      <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md mb-6 space-y-6">
        {/* Host Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2">ComfyUI API Host URL</label>
          <input
            type="text"
            value={apiHost}
            onChange={(e) => setApiHost(e.target.value)}
            onBlur={handleBlur}
            className="w-full bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
            placeholder="e.g. 127.0.0.1:8188"
          />
        </div>

        {/* Auth Token Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" /> Vast.ai API Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              onBlur={handleBlur}
              className="flex-1 bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
              placeholder="(Optional)"
            />
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Wifi className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-pulse' : ''}`} /> Test
            </button>
          </div>
          {testStatus !== 'idle' && (
            <div className={`mt-2 text-sm flex items-center gap-2 ${testStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {testStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{testMessage}</span>
            </div>
          )}
        </div>

        {/* Seed Configuration */}
        <div className="border-t border-gray-700 pt-6">
          <label className="block text-gray-300 text-sm font-bold mb-4">Generation Seed Strategy</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setSeedMode('random'); saveToDb(); }}
              className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                seedMode === 'random' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
              }`}
            >
              <Dices className="w-8 h-8" />
              <div className="text-sm font-bold">Randomize</div>
              <div className="text-xs text-center opacity-70">A new random seed for every image</div>
            </button>
            <button
              onClick={() => { setSeedMode('increment'); saveToDb(); }}
              className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                seedMode === 'increment' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
              }`}
            >
              <PlusCircle className="w-8 h-8" />
              <div className="text-sm font-bold">Increment (+1)</div>
              <div className="text-xs text-center opacity-70">Adds 1 to the previous seed</div>
            </button>
          </div>
          
          <div className="mt-4">
            <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Starting / Last Used Seed</label>
            <input
              type="number"
              value={lastSeed}
              onChange={(e) => setLastSeed(parseInt(e.target.value) || 0)}
              onBlur={handleBlur}
              className="w-full bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600 transition-colors"
            />
          </div>
        </div>

        {/* Workflow Profiles Management */}
        <div className="border-t border-gray-700 pt-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-gray-300 text-sm font-bold">Workflow Profiles</label>
            <button
              onClick={handleAddNewProfile}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Profile
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {profiles?.map((p) => (
              <div 
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all cursor-pointer group ${
                  activeProfileId === p.id 
                    ? 'bg-indigo-500/20 border-indigo-500 text-white' 
                    : 'bg-[#1e1f22] border-transparent text-gray-400 hover:bg-gray-700'
                }`}
                onClick={() => setActiveProfileId(p.id)}
              >
                <SettingsIcon className={`w-3.5 h-3.5 ${activeProfileId === p.id ? 'text-indigo-400' : 'text-gray-500'}`} />
                <span className="text-sm font-medium">{p.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (p.id) handleDeleteProfile(p.id);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-4 bg-[#1e1f22] p-4 rounded-lg">
            <div>
              <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Profile Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onBlur={handleBlur}
                className="w-full bg-[#2b2d31] text-white border border-[#2b2d31] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Name your workflow (e.g. SDXL High Res)"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider flex justify-between">
                <span>Workflow API JSON</span>
                <span className="text-indigo-400 normal-case lowercase font-normal italic">Selected: {profiles?.find(p => p.id === activeProfileId)?.name}</span>
              </label>
              <div className="bg-yellow-900/10 border border-yellow-700/20 p-3 rounded mb-2 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200/70 italic">
                  Changes to the JSON below will be saved directly to the <strong>"{profileName}"</strong> profile.
                </p>
              </div>
              <textarea
                value={workflow}
                onChange={(e) => setWorkflow(e.target.value)}
                onBlur={handleBlur}
                spellCheck={false}
                className="w-full bg-[#2b2d31] text-gray-300 font-mono text-xs border border-[#2b2d31] rounded py-2 px-3 h-80 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          onClick={saveToDb}
          className="flex items-center justify-center w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveStatus === 'saved' ? 'Saved!' : 'Save Settings Manually'}
        </button>
      </div>
    </div>
  );
};
