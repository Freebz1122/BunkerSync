const db = new Dexie('BunkerSyncDB');
db.version(1).stores({
  courses: 'id, name, maps',
  bunkers: 'id, courseId, holeNumber, lat, lng',
  tasks: 'id, courseId, bunkerId, description, type, status, timestamp'
});

export { db };