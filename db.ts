import Dexie, { Table } from 'dexie';
import { ChatMessage, FavoriteItem, Settings, WorkflowProfile } from './types';

export class ComfyChatDB extends Dexie {
  messages!: Table<ChatMessage, number>;
  favorites!: Table<FavoriteItem, number>;
  settings!: Table<Settings, number>;
  profiles!: Table<WorkflowProfile, number>;

  constructor() {
    super('ComfyChatDB');
    this.version(1).stores({
      messages: '++id, timestamp',
      favorites: '++id, timestamp',
      settings: 'id'
    });

    this.version(2).stores({
      profiles: '++id, name',
      settings: 'id, activeProfileId'
    }).upgrade(async (tx) => {
      const oldSettings = await tx.table('settings').get(1);
      if (oldSettings && oldSettings.workflowJson) {
        const defaultProfileId = await tx.table('profiles').add({
          name: 'Default Profile',
          workflowJson: oldSettings.workflowJson,
          seedMode: oldSettings.seedMode || 'random',
          lastSeed: oldSettings.lastSeed || 0
        });
        
        await tx.table('settings').update(1, {
          activeProfileId: defaultProfileId
        });
      }
    });
  }
}

export const db = new ComfyChatDB();