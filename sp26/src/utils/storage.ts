import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Asset, SyncQueueItem, InventoryRecord, LocationTrack } from '../../shared/types';

interface AssetDB extends DBSchema {
  assets: {
    key: string;
    value: Asset;
    indexes: { 'by-uid': string; 'by-status': string; 'by-category': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-type': string; 'by-createdAt': string; 'by-idempotencyKey': string };
  };
  inventoryRecords: {
    key: string;
    value: InventoryRecord;
    indexes: { 'by-assetUid': string; 'by-scannedAt': string };
  };
  locationTracks: {
    key: string;
    value: LocationTrack;
    indexes: { 'by-assetUid': string; 'by-trackedAt': string };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'asset-manager-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AssetDB> | null = null;

const initDB = async (): Promise<IDBPDatabase<AssetDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AssetDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('assets')) {
        const assetStore = db.createObjectStore('assets', { keyPath: 'uid' });
        assetStore.createIndex('by-uid', 'uid', { unique: true });
        assetStore.createIndex('by-status', 'status');
        assetStore.createIndex('by-category', 'category');
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-type', 'type');
        syncStore.createIndex('by-createdAt', 'createdAt');
        syncStore.createIndex('by-idempotencyKey', 'idempotencyKey', { unique: true });
      }

      if (!db.objectStoreNames.contains('inventoryRecords')) {
        const invStore = db.createObjectStore('inventoryRecords', { keyPath: '_id' });
        invStore.createIndex('by-assetUid', 'assetUid');
        invStore.createIndex('by-scannedAt', 'scannedAt');
      }

      if (!db.objectStoreNames.contains('locationTracks')) {
        const locStore = db.createObjectStore('locationTracks', { keyPath: '_id' });
        locStore.createIndex('by-assetUid', 'assetUid');
        locStore.createIndex('by-trackedAt', 'trackedAt');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });

  return dbInstance;
};

const getDB = async (): Promise<IDBPDatabase<AssetDB>> => {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
};

export const storage = {
  async closeDB() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  },

  async clearAll() {
    const db = await getDB();
    const tx = db.transaction(['assets', 'syncQueue', 'inventoryRecords', 'locationTracks', 'settings'], 'readwrite');
    await Promise.all([
      tx.objectStore('assets').clear(),
      tx.objectStore('syncQueue').clear(),
      tx.objectStore('inventoryRecords').clear(),
      tx.objectStore('locationTracks').clear(),
      tx.objectStore('settings').clear(),
    ]);
    await tx.done;
  },

  assets: {
    async getAll(): Promise<Asset[]> {
      const db = await getDB();
      return db.getAll('assets');
    },

    async getByUid(uid: string): Promise<Asset | undefined> {
      const db = await getDB();
      return db.get('assets', uid);
    },

    async put(asset: Asset): Promise<string> {
      const db = await getDB();
      return db.put('assets', asset);
    },

    async putMany(assets: Asset[]): Promise<string[]> {
      const db = await getDB();
      const tx = db.transaction('assets', 'readwrite');
      const promises = assets.map(asset => tx.store.put(asset));
      const results = await Promise.all(promises);
      await tx.done;
      return results;
    },

    async delete(uid: string): Promise<void> {
      const db = await getDB();
      await db.delete('assets', uid);
    },

    async clear(): Promise<void> {
      const db = await getDB();
      await db.clear('assets');
    },
  },

  syncQueue: {
    async getAll(): Promise<SyncQueueItem[]> {
      const db = await getDB();
      return db.getAllFromIndex('syncQueue', 'by-createdAt');
    },

    async getByType(type: SyncQueueItem['type']): Promise<SyncQueueItem[]> {
      const db = await getDB();
      return db.getAllFromIndex('syncQueue', 'by-type', type);
    },

    async getByIdempotencyKey(idempotencyKey: string): Promise<SyncQueueItem | undefined> {
      const db = await getDB();
      return db.getFromIndex('syncQueue', 'by-idempotencyKey', idempotencyKey);
    },

    async add(
      item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
    ): Promise<string> {
      const db = await getDB();
      
      if (item.idempotencyKey) {
        const existing = await db.getFromIndex(
          'syncQueue',
          'by-idempotencyKey',
          item.idempotencyKey
        );
        if (existing) {
          return existing.id;
        }
      }
      
      const queueItem: SyncQueueItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      return db.add('syncQueue', queueItem);
    },

    async put(item: SyncQueueItem): Promise<string> {
      const db = await getDB();
      return db.put('syncQueue', item);
    },

    async delete(id: string): Promise<void> {
      const db = await getDB();
      await db.delete('syncQueue', id);
    },

    async clear(): Promise<void> {
      const db = await getDB();
      await db.clear('syncQueue');
    },
  },

  inventoryRecords: {
    async getAll(): Promise<InventoryRecord[]> {
      const db = await getDB();
      return db.getAllFromIndex('inventoryRecords', 'by-scannedAt');
    },

    async getByAssetUid(assetUid: string): Promise<InventoryRecord[]> {
      const db = await getDB();
      return db.getAllFromIndex('inventoryRecords', 'by-assetUid', assetUid);
    },

    async put(record: InventoryRecord): Promise<string> {
      const db = await getDB();
      return db.put('inventoryRecords', record);
    },

    async putMany(records: InventoryRecord[]): Promise<string[]> {
      const db = await getDB();
      const tx = db.transaction('inventoryRecords', 'readwrite');
      const promises = records.map(record => tx.store.put(record));
      const results = await Promise.all(promises);
      await tx.done;
      return results;
    },

    async delete(id: string): Promise<void> {
      const db = await getDB();
      await db.delete('inventoryRecords', id);
    },

    async clear(): Promise<void> {
      const db = await getDB();
      await db.clear('inventoryRecords');
    },
  },

  locationTracks: {
    async getAll(): Promise<LocationTrack[]> {
      const db = await getDB();
      return db.getAllFromIndex('locationTracks', 'by-trackedAt');
    },

    async getByAssetUid(assetUid: string): Promise<LocationTrack[]> {
      const db = await getDB();
      return db.getAllFromIndex('locationTracks', 'by-assetUid', assetUid);
    },

    async put(track: LocationTrack): Promise<string> {
      const db = await getDB();
      return db.put('locationTracks', track);
    },

    async putMany(tracks: LocationTrack[]): Promise<string[]> {
      const db = await getDB();
      const tx = db.transaction('locationTracks', 'readwrite');
      const promises = tracks.map(track => tx.store.put(track));
      const results = await Promise.all(promises);
      await tx.done;
      return results;
    },

    async delete(id: string): Promise<void> {
      const db = await getDB();
      await db.delete('locationTracks', id);
    },

    async clear(): Promise<void> {
      const db = await getDB();
      await db.clear('locationTracks');
    },
  },

  settings: {
    async get<T>(key: string): Promise<T | undefined> {
      const db = await getDB();
      return db.get('settings', key) as Promise<T | undefined>;
    },

    async set(key: string, value: unknown): Promise<string> {
      const db = await getDB();
      return db.put('settings', value, key);
    },

    async delete(key: string): Promise<void> {
      const db = await getDB();
      await db.delete('settings', key);
    },
  },
};
