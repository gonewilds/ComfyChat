import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Copy, Trash2 } from 'lucide-react';

export const Gallery: React.FC = () => {
  const favorites = useLiveQuery(() => db.favorites.orderBy('timestamp').reverse().toArray());

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  const handleDelete = async (id?: number) => {
    if (id) await db.favorites.delete(id);
  };

  if (!favorites || favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p>No favorites yet.</p>
        <p className="text-sm">Star an image in the chat to save it here.</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto bg-[#313338]">
      <h2 className="text-2xl font-bold text-white mb-6">Gallery</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {favorites.map((fav) => (
          <div key={fav.id} className="bg-[#2b2d31] rounded-lg overflow-hidden shadow-lg group">
            <div className="aspect-square w-full relative">
              <img 
                src={URL.createObjectURL(fav.imageBlob)} 
                alt={fav.prompt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <button
                  onClick={() => handleDelete(fav.id)}
                  className="p-2 bg-red-500/80 rounded hover:bg-red-600 text-white"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-gray-300 line-clamp-2 flex-grow" title={fav.prompt}>
                  {fav.prompt}
                </p>
                <button
                  onClick={() => handleCopyPrompt(fav.prompt)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Copy Prompt"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(fav.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
