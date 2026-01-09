
import { ComfyWorkflow } from '../types';

export const PROMPT_PLACEHOLDER = "%PROMPT%";

/**
 * Parses the user-provided workflow JSON string.
 */
export const parseWorkflow = (jsonString: string): ComfyWorkflow | null => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Invalid JSON", e);
    return null;
  }
};

/**
 * 1. Injects the prompt into the workflow by replacing the placeholder.
 * 2. Handles seed logic (Random vs Increment).
 * Returns both the modified workflow and the seed that was applied.
 */
export const prepareWorkflow = (
  workflow: ComfyWorkflow, 
  prompt: string, 
  seedMode: 'random' | 'increment', 
  lastSeed: number
): { workflow: ComfyWorkflow, appliedSeed: number } => {
  const workflowString = JSON.stringify(workflow);
  // Simple string replacement for the prompt
  const injectedString = workflowString.replace(PROMPT_PLACEHOLDER, prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
  
  const newWorkflow = JSON.parse(injectedString);

  // Determine the new seed
  let appliedSeed = lastSeed;
  if (seedMode === 'random') {
    appliedSeed = Math.floor(Math.random() * 1000000000000000);
  } else {
    appliedSeed = (lastSeed || 0) + 1;
    // Safety for JS MAX_SAFE_INTEGER
    if (appliedSeed > 9007199254740991) appliedSeed = 0;
  }

  // Inject seed into all relevant fields
  Object.values(newWorkflow).forEach((node: any) => {
    if (node.inputs) {
      for (const key in node.inputs) {
        if (key === 'seed' || key === 'noise_seed') {
          node.inputs[key] = appliedSeed;
        }
      }
    }
  });

  return { workflow: newWorkflow, appliedSeed };
};

export const getBaseUrl = (host: string): string => {
  let url = host.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      url = `https://${url}`;
    } else {
      url = `http://${url}`;
    }
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const getImageUrl = (host: string, filename: string, subfolder: string, type: string) => {
  const baseUrl = getBaseUrl(host);
  const query = new URLSearchParams({ filename, subfolder, type });
  return `${baseUrl}/view?${query.toString()}`;
};
