// offline-store.js — Étape 2 du mode hors-ligne.
// Garde une copie locale (sur l'appareil, via IndexedDB) des factures, clients,
// produits et paiements déjà chargés, pour pouvoir les CONSULTER sans connexion.
// Ne gère pas encore la création/modification hors-ligne — ça viendra à l'étape suivante.

const OFFLINE_DB_NAME = 'payloop-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE_NAME = 'snapshot';

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
                request.result.createObjectStore(OFFLINE_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Enregistre une copie des données actuelles. Appelée après chaque chargement réussi.
async function saveOfflineSnapshot(data) {
    try {
        const db = await openOfflineDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
            tx.objectStore(OFFLINE_STORE_NAME).put({
                clients: data.clients,
                products: data.products,
                invoices: data.invoices,
                payments: data.payments,
                migrationHistory: data.migrationHistory,
                savedAt: new Date().toISOString()
            }, 'latest');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Impossible d'enregistrer la copie hors-ligne :", err);
    }
}

// Relit la dernière copie enregistrée. Retourne null s'il n'y en a aucune (ou en cas d'erreur).
async function loadOfflineSnapshot() {
    try {
        const db = await openOfflineDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
            const req = tx.objectStore(OFFLINE_STORE_NAME).get('latest');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error('Impossible de lire la copie hors-ligne :', err);
        return null;
    }
}
