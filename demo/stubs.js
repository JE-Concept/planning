/** De resterende Firebase-modules die de demobuild niet nodig heeft. */
export const initializeApp = () => ({ __demo: true })
export const getStorage = () => ({ __demo: true })
export const connectStorageEmulator = () => {}
export const getFunctions = () => ({ __demo: true })
export const httpsCallable = () => async () => ({ data: { ok: true, role: 'owner' } })
