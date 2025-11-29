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
  // We handle potential JSON escaping issues by being careful or simple replacement
  // Ideally, user puts "%PROMPT%" in their CLIP Text Encode node.
  const injectedString = workflowString.replace(PROMPT_PLACEHOLDER, prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
  
  const newWorkflow = JSON.parse(injectedString);

  // Randomize seeds
  Object.values(newWorkflow).forEach((node: any) => {
    if (node.inputs) {
      for (const key in node.inputs) {
        if (key === 'seed' || key === 'noise_seed') {
          // ComfyUI uses long integers. Javascript max safe integer might be small, 
          // but usually enough. 
          node.inputs[key] = Math.floor(Math.random() * 1000000000000000);
        }
      }
    }
  });

  return newWorkflow;
};

export const getImageUrl = (host: string, filename: string, subfolder: string, type: string) => {
  const protocol = host.startsWith('http') ? '' : 'http://';
  return `${protocol}${host}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
};
