import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, AlertCircle, Wifi, CheckCircle, XCircle, Key } from 'lucide-react';
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
  const settings = useLiveQuery(() => db.settings.toArray());
  const [apiHost, setApiHost] = useState('127.0.0.1:8188');
  const [authToken, setAuthToken] = useState('');
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (settings && settings.length > 0) {
      setApiHost(settings[0].apiHost);
      setWorkflow(settings[0].workflowJson);
      setAuthToken(settings[0].authToken || '');
    }
  }, [settings]);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    
    // Use the helper to determine correct protocol (http vs https)
    const fetchUrl = getBaseUrl(apiHost);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = {};
      if (authToken.trim()) {
        headers['Authorization'] = `Bearer ${authToken.trim()}`;
      }

      const res = await fetch(`${fetchUrl}/system_stats`, { 
        signal: controller.signal,
        headers
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Connected successfully!');
      } else {
        throw new Error(`Status: ${res.status} ${res.statusText}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      console.error(e);
      
      if (e.name === 'AbortError') {
        setTestMessage('Connection timed out. Check IP/Port.');
      } else if (e.message.includes('Failed to fetch')) {
        setTestMessage('Network Error. Likely CORS or Mixed Content (HTTP vs HTTPS).');
      } else {
        setTestMessage(`Error: ${e.message}`);
      }
    }
  };

  const handleSave = async () => {
    try {
      // Validate JSON
      JSON.parse(workflow);
      
      // We store the raw input, but clean trailing slashes
      let cleanHost = apiHost.trim();
      if (cleanHost.endsWith('/')) cleanHost = cleanHost.slice(0, -1);
      setApiHost(cleanHost);

      await db.settings.clear();
      await db.settings.add({
        apiHost: cleanHost,
        workflowJson: workflow,
        authToken: authToken.trim()
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Invalid JSON format in workflow.");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      
      <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md mb-6 space-y-6">
        {/* Host Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2">
            ComfyUI API Host URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiHost}
              onChange={(e) => setApiHost(e.target.value)}
              className="flex-1 bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600"
              placeholder="e.g. 127.0.0.1:8188 or https://xxxx.vast.ai"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            If using Vast.ai/Ngrok, make sure to include <code>https://</code>
          </p>
        </div>

        {/* Auth Token Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Vast.ai API Token (Bearer Token)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              className="flex-1 bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500 placeholder-gray-600"
              placeholder="(Optional) Paste your Open Button Token here"
            />
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {testStatus === 'testing' ? (
                <Wifi className="w-4 h-4 animate-pulse" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              Test
            </button>
          </div>

          {/* Connection Status Message */}
          {testStatus !== 'idle' && (
            <div className={`mt-2 text-sm flex items-center gap-2 ${
              testStatus === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {testStatus === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{testMessage}</span>
            </div>
          )}
        </div>

        {/* Workflow Configuration */}
        <div>
          <label className="block text-gray-300 text-sm font-bold mb-2">
            Workflow API JSON
          </label>
          <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded mb-2 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Export your workflow in <strong>API Format</strong> (Enable Dev Mode in ComfyUI settings). 
              Replace your positive prompt text with <code>%PROMPT%</code>. 
            </p>
          </div>
          <textarea
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="w-full bg-[#1e1f22] text-gray-300 font-mono text-xs border border-[#1e1f22] rounded py-2 px-3 h-80 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={handleSave}
          className="flex items-center justify-center w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved Successfully!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};