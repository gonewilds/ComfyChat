import Dexie, { Table } from 'dexie';
import { ChatMessage, FavoriteItem, Settings } from './types';

const db = new Dexie('ComfyChatDB') as Dexie & {
  messages: Table<ChatMessage>;
  favorites: Table<FavoriteItem>;
  settings: Table<Settings>;
};

db.version(1).stores({
  messages: '++id, timestamp',
  favorites: '++id, timestamp',
  settings: '++id' // We only really need one row here
});

export { db };