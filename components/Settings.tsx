import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, AlertCircle } from 'lucide-react';

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
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && settings.length > 0) {
      setApiHost(settings[0].apiHost);
      setWorkflow(settings[0].workflowJson);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      // Validate JSON
      JSON.parse(workflow);
      
      await db.settings.clear();
      await db.settings.add({
        apiHost,
        workflowJson: workflow
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
      
      <div className="bg-[#2b2d31] p-6 rounded-lg shadow-md mb-6">
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2">
            ComfyUI API Host
          </label>
          <input
            type="text"
            value={apiHost}
            onChange={(e) => setApiHost(e.target.value)}
            className="w-full bg-[#1e1f22] text-white border border-[#1e1f22] rounded py-2 px-3 focus:outline-none focus:border-indigo-500"
            placeholder="e.g. 127.0.0.1:8188"
          />
          <p className="text-xs text-gray-400 mt-1">
            Ensure your ComfyUI is launched with <code>--listen</code> and CORS enabled if accessed remotely.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2">
            Workflow API JSON
          </label>
          <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded mb-2 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200">
              Export your workflow in <strong>API Format</strong> (Enable Dev Mode in ComfyUI settings). 
              Replace your positive prompt text with <code>%PROMPT%</code>. 
              The app will automatically randomize <code>seed</code> inputs.
            </p>
          </div>
          <textarea
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="w-full bg-[#1e1f22] text-gray-300 font-mono text-xs border border-[#1e1f22] rounded py-2 px-3 h-96 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={handleSave}
          className="flex items-center justify-center w-full md:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-6 rounded transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
