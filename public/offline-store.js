// offline-store.js — Étape 2 du mode hors-ligne.
// Garde une copie locale (sur l'appareil, via IndexedDB) des factures, clients,
// produits et paiements déjà chargés, pour pouvoir les CONSULTER sans connexion.
// Étape 3 : on peut maintenant aussi CRÉER une facture ou CHANGER son statut hors
// connexion — ces actions sont mises dans une file d'attente locale, et envoyées
// automatiquement au serveur dès que la connexion revient.

const OFFLINE_DB_NAME = 'payloop-offline';
const OFFLINE_DB_VERSION = 2;
const OFFLINE_STORE_NAME = 'snapshot';
const OFFLINE_QUEUE_STORE_NAME = 'queue';

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
                request.result.createObjectStore(OFFLINE_STORE_NAME);
            }
            if (!request.result.objectStoreNames.contains(OFFLINE_QUEUE_STORE_NAME)) {
                request.result.createObjectStore(OFFLINE_QUEUE_STORE_NAME, { keyPath: 'queueId', autoIncrement: true });
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

// Étape 3 : distingue une vraie erreur réseau (serveur injoignable, donc on peut
// travailler hors-ligne) d'une erreur renvoyée par le serveur lui-même (auquel cas
// il a bien reçu la requête, et il faut afficher son message d'erreur normalement).
function isOfflineError(error) {
    return error instanceof TypeError;
}

// Ajoute une action (création de facture ou changement de statut) à la file d'attente,
// pour l'envoyer au serveur dès que la connexion reviendra.
async function queueOfflineAction(action) {
    try {
        const db = await openOfflineDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_QUEUE_STORE_NAME, 'readwrite');
            tx.objectStore(OFFLINE_QUEUE_STORE_NAME).add({ action, createdAt: new Date().toISOString() });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Impossible de mettre l'action en attente :", err);
    }
}

// Retourne la liste des actions en attente, dans l'ordre où elles ont été créées.
async function getOfflineQueue() {
    try {
        const db = await openOfflineDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_QUEUE_STORE_NAME, 'readonly');
            const req = tx.objectStore(OFFLINE_QUEUE_STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error('Impossible de lire la file des actions en attente :', err);
        return [];
    }
}

// Retire une action de la file une fois qu'elle a bien été envoyée au serveur.
async function removeOfflineQueueItem(queueId) {
    try {
        const db = await openOfflineDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_QUEUE_STORE_NAME, 'readwrite');
            tx.objectStore(OFFLINE_QUEUE_STORE_NAME).delete(queueId);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Impossible de retirer l'action de la file :", err);
    }
}

// Nombre d'actions en attente d'envoi — utilisé pour l'indicateur de connexion.
async function getOfflineQueueCount() {
    try {
        const db = await openOfflineDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_QUEUE_STORE_NAME, 'readonly');
            const req = tx.objectStore(OFFLINE_QUEUE_STORE_NAME).count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error('Impossible de compter les actions en attente :', err);
        return 0;
    }
}

// Retire toute action encore en attente qui concerne une facture créée hors-ligne
// (utilisé quand l'utilisateur supprime une facture avant qu'elle ait été envoyée au serveur).
async function removeQueuedActionsForTempId(tempId) {
    try {
        const queue = await getOfflineQueue();
        for (const item of queue) {
            if (item.action.tempId === tempId || item.action.invoiceId === tempId) {
                await removeOfflineQueueItem(item.queueId);
            }
        }
    } catch (err) {
        console.error("Impossible de nettoyer la file pour la facture supprimée :", err);
    }
}
