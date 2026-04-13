import { useState, useCallback, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minuto de bloqueo
const BACKOFF_BASE_MS = 1_000; // delay inicial entre intentos

/**
 * Hook de rate limiting para proteger formularios de login.
 * Bloquea despues de MAX_ATTEMPTS intentos fallidos durante LOCKOUT_MS.
 * Aplica backoff exponencial entre intentos.
 */
export function useRateLimit() {
    const [attempts, setAttempts] = useState(0);
    const [lockedUntil, setLockedUntil] = useState(null);
    const lastAttemptRef = useRef(0);

    const isLocked = lockedUntil && Date.now() < lockedUntil;

    const remainingSeconds = isLocked
        ? Math.ceil((lockedUntil - Date.now()) / 1000)
        : 0;

    const checkLimit = useCallback(() => {
        if (isLocked) return false;

        const now = Date.now();
        const minDelay = BACKOFF_BASE_MS * Math.pow(2, Math.min(attempts, 4));
        if (now - lastAttemptRef.current < minDelay && attempts > 0) {
            return false;
        }

        lastAttemptRef.current = now;
        return true;
    }, [attempts, isLocked]);

    const recordFailure = useCallback(() => {
        setAttempts(prev => {
            const next = prev + 1;
            if (next >= MAX_ATTEMPTS) {
                setLockedUntil(Date.now() + LOCKOUT_MS);
                return 0; // reset counter after lockout
            }
            return next;
        });
    }, []);

    const recordSuccess = useCallback(() => {
        setAttempts(0);
        setLockedUntil(null);
    }, []);

    return {
        isLocked,
        remainingSeconds,
        attempts,
        maxAttempts: MAX_ATTEMPTS,
        checkLimit,
        recordFailure,
        recordSuccess,
    };
}
