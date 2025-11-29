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
 * 2. Randomizes seeds (looking for keys named 'seed' or 'noise_seed').
 */
export const prepareWorkflow = (workflow: ComfyWorkflow, prompt: string): ComfyWorkflow => {
  const workflowString = JSON.stringify(workflow);
  // Simple string replacement for the prompt
  const injectedString = workflowString.replace(PROMPT_PLACEHOLDER, prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
  
  const newWorkflow = JSON.parse(injectedString);

  // Randomize seeds
  Object.values(newWorkflow).forEach((node: any) => {
    if (node.inputs) {
      for (const key in node.inputs) {
        if (key === 'seed' || key === 'noise_seed') {
          node.inputs[key] = Math.floor(Math.random() * 1000000000000000);
        }
      }
    }
  });

  return newWorkflow;
};

export const getBaseUrl = (host: string): string => {
  let url = host.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // If we are on HTTPS, default to HTTPS for the API to avoid Mixed Content
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