/**
 * PulseCheck v2.0 — API client
 * Centralises all fetch calls and shared types.
 */

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
