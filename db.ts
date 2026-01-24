import Dexie, { Table } from 'dexie';
import { ChatMessage, FavoriteItem, Settings } from './types';

export class ComfyChatDB extends Dexie {
  messages!: Table<ChatMessage, number>;
  favorites!: Table<FavoriteItem, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('ComfyChatDB');
    (this as any).version(1).stores({
      messages: '++id, timestamp',
      favorites: '++id, timestamp',
      settings: 'id' // 'id' (not auto-increment) so we can keep updating row 1
    });
  }
}

export const db = new ComfyChatDB();