import Dexie from 'https://unpkg.com/dexie@3.2.2/dist/dexie.js';

export const localDB = new Dexie('BunkerSyncDB');
localDB.version(1).stores({
  tasks: '++id,courseId,description,type,status,timestamp',
  courses: 'id,name,maps'
});