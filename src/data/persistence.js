/**
 * IndexedDB persistence for imported dashboard datasets.
 */

const DB_NAME = 'hubspot_dashboard_storage';
const DB_VERSION = 1;
const STORE_NAME = 'dashboard_state';
const SNAPSHOT_KEY = 'latest_import_snapshot';

function canUseIndexedDB() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!canUseIndexedDB()) {
            reject(new Error('IndexedDB not supported'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
}

async function runStoreRequest(mode, operation) {
    const db = await openDatabase();

    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const store = tx.objectStore(STORE_NAME);
            const request = operation(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB operation failed'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        });
    } finally {
        db.close();
    }
}

export async function saveDataSnapshot(snapshot) {
    if (!canUseIndexedDB()) return false;
    await runStoreRequest('readwrite', (store) => {
        return store.put({
            ...snapshot,
            savedAt: Date.now()
        }, SNAPSHOT_KEY);
    });
    return true;
}

export async function loadDataSnapshot() {
    if (!canUseIndexedDB()) return null;
    const value = await runStoreRequest('readonly', (store) => store.get(SNAPSHOT_KEY));
    return value && typeof value === 'object' ? value : null;
}

export async function clearDataSnapshot() {
    if (!canUseIndexedDB()) return false;
    await runStoreRequest('readwrite', (store) => store.delete(SNAPSHOT_KEY));
    return true;
}

