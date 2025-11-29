import Dexie, { Table } from 'dexie';
import { ChatMessage, FavoriteItem, Settings } from './types';

export class ComfyChatDB extends Dexie {
  messages!: Table<ChatMessage>;
  favorites!: Table<FavoriteItem>;
  settings!: Table<Settings>;

  constructor() {
    super('ComfyChatDB');
    this.version(1).stores({
      messages: '++id, timestamp',
      favorites: '++id, timestamp',
      settings: 'id' // 'id' (not auto-increment) so we can keep updating row 1
    });
  }
}

export const db = new ComfyChatDB();