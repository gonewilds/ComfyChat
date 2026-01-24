
import Dexie, { Table } from 'dexie';
import { ChatMessage, FavoriteItem, Settings, WorkflowProfile } from './types';

export class ComfyChatDB extends Dexie {
  messages!: Table<ChatMessage, number>;
  favorites!: Table<FavoriteItem, number>;
  settings!: Table<Settings, number>;
  workflowProfiles!: Table<WorkflowProfile, number>;

  constructor() {
    super('ComfyChatDB');
    (this as any).version(1).stores({
      messages: '++id, timestamp',
      favorites: '++id, timestamp',
      settings: 'id',
      workflowProfiles: '++id, name'
    });
  }
}

export const db = new ComfyChatDB();
