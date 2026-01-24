
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, AlertCircle, Wifi, CheckCircle, XCircle, Key, Dices, PlusCircle, Layout, Plus, Trash2, Edit3 } from 'lucide-react';
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
  const profiles = useLiveQuery(() => db.workflowProfiles.toArray());
  
  const [apiHost, setApiHost] = useState('127.0.0.1:8188');
  const [authToken, setAuthToken] = useState('');
  const [seedMode, setSeedMode] = useState<'random' | 'increment'>('random');
  const [lastSeed, setLastSeed] = useState<number>(0);
  
  const [activeProfile, setActiveProfile] = useState<WorkflowProfile | null>(null);
  const [workflowJson, setWorkflowJson] = useState(DEFAULT_WORKFLOW);
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Initial Load & Migration
  useEffect(() => {
    if (settings) {
      setApiHost(settings.apiHost);
      setAuthToken(settings.authToken || '');
      setSeedMode(settings.seedMode || 'random');
      setLastSeed(settings.lastSeed || 0);
    }
  }, [settings]);

  // Handle Profile Migration and Selection
  useEffect(() => {
    const initProfiles = async () => {
      if (profiles && settings) {
        // If no profiles exist, create a default one from existing settings
        if (profiles.length === 0) {
          const id = await db.workflowProfiles.add({
            name: 'Default Profile',
            workflowJson: DEFAULT_WORKFLOW
          });
          await db.settings.update(1, { activeProfileId: id });
        } else {
          const currentId = settings.activeProfileId || profiles[0].id;
          const found = profiles.find(p => p.id === currentId) || profiles[0];
          setActiveProfile(found);
          setWorkflowJson(found.workflowJson);
        }
      }
    };
    initProfiles();
  }, [profiles, settings]);

  const saveToDb = useCallback(async (updatedWorkflow?: string) => {
    setSaveStatus('saving');
    try {
      const jsonToSave = updatedWorkflow ?? workflowJson;
      try {
        JSON.parse(jsonToSave);
      } catch (e) {
        // Just let them keep editing if it's invalid, don't crash
      }

      await db.settings.put({
        id: 1,
        apiHost: apiHost.trim().endsWith('/') ? apiHost.trim().slice(0, -1) : apiHost.trim(),
        authToken: authToken.trim(),
        seedMode: seedMode,
        lastSeed: lastSeed,
        activeProfileId: activeProfile?.id
      });

      if (activeProfile?.id) {
        await db.workflowProfiles.update(activeProfile.id, {
          workflowJson: jsonToSave
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Failed to save", e);
      setSaveStatus('idle');
    }
  }, [apiHost, workflowJson, authToken, seedMode, lastSeed, activeProfile]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    const id = await db.workflowProfiles.add({
      name: newProfileName.trim(),
      workflowJson: workflowJson
    });
    await db.settings.update(1, { activeProfileId: id });
    setNewProfileName('');
    setIsCreating(false);
  };

  const handleDeleteProfile = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profiles || profiles.length <= 1) {
      alert("You must have at least one profile.");
      return;
    }
    if (window.confirm("Delete this workflow profile?")) {
      await db.workflowProfiles.delete(id);
      if (activeProfile?.id === id) {
        const remaining = profiles.filter(p => p.id !== id);
        await db.settings.update(1, { activeProfileId: remaining[0].id });
      }
    }
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

      {/* Workflow Profiles Selection */}
      <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md mb-6 space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-gray-300 text-sm font-bold flex items-center gap-2">
            <Layout className="w-4 h-4" /> Workflow Profiles
          </label>
          <button 
            onClick={() => setIsCreating(true)}
            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> New Profile
          </button>
        </div>

        {isCreating && (
          <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
            <input 
              type="text" 
              placeholder="Profile Name..."
              className="flex-1 bg-[#1e1f22] text-white border border-indigo-500/50 rounded py-1 px-3 text-sm focus:outline-none"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProfile()}
              autoFocus
            />
            <button onClick={handleCreateProfile} className="bg-green-600 px-3 py-1 rounded text-sm text-white hover:bg-green-700">Add</button>
            <button onClick={() => setIsCreating(false)} className="bg-gray-600 px-3 py-1 rounded text-sm text-white hover:bg-gray-700">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {profiles?.map(p => (
            <div 
              key={p.id}
              onClick={() => db.settings.update(1, { activeProfileId: p.id })}
              className={`flex items-center justify-between p-3 rounded cursor-pointer border transition-all ${
                activeProfile?.id === p.id 
                ? 'bg-indigo-500/20 border-indigo-500 text-white' 
                : 'bg-[#1e1f22] border-transparent text-gray-400 hover:border-gray-600'
              }`}
            >
              <span className="text-sm font-medium truncate pr-2">{p.name}</span>
              <div className="flex gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = prompt("New profile name:", p.name);
                    if (name) db.workflowProfiles.update(p.id!, { name });
                  }}
                  className="p-1 hover:text-white transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => handleDeleteProfile(p.id!, e)}
                  className="p-1 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md mb-6 space-y-6">
        {/* API Host Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2">ComfyUI API Host URL</label>
          <input
            type="text"
            value={apiHost}
            onChange={(e) => setApiHost(e.target.value)}
            onBlur={() => saveToDb()}
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
              onBlur={() => saveToDb()}
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
              onClick={() => { setSeedMode('random'); setSaveStatus('saving'); db.settings.update(1, { seedMode: 'random' }).then(() => setSaveStatus('saved')); }}
              className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                seedMode === 'random' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
              }`}
            >
              <Dices className="w-8 h-8" />
              <div className="text-sm font-bold">Randomize</div>
            </button>
            <button
              onClick={() => { setSeedMode('increment'); setSaveStatus('saving'); db.settings.update(1, { seedMode: 'increment' }).then(() => setSaveStatus('saved')); }}
              className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                seedMode === 'increment' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-[#1e1f22] bg-[#1e1f22] text-gray-400 hover:border-gray-600'
              }`}
            >
              <PlusCircle className="w-8 h-8" />
              <div className="text-sm font-bold">Increment (+1)</div>
            </button>
          </div>
        </div>

        {/* Workflow Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2 flex items-center justify-between">
            <span>Workflow API JSON ({activeProfile?.name || 'Loading...'})</span>
          </label>
          <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded mb-2 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Replace your prompt text with <code>%PROMPT%</code>. Changes save to the active profile automatically.
            </p>
          </div>
          <textarea
            value={workflowJson}
            onChange={(e) => {
              setWorkflowJson(e.target.value);
              saveToDb(e.target.value);
            }}
            spellCheck={false}
            className="w-full bg-[#1e1f22] text-gray-300 font-mono text-xs border border-[#1e1f22] rounded py-2 px-3 h-80 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          onClick={() => saveToDb()}
          className="flex items-center justify-center w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveStatus === 'saved' ? 'All Settings Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
