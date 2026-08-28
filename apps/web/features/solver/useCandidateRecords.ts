"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  candidateStorageKey,
  mergeCandidateRecord,
  parseCandidateRecords,
  type CandidateRecord,
} from "./candidate-record";

const serverRecords: CandidateRecord[] = [];
const cache = new Map<
  string,
  { raw: string | null; records: CandidateRecord[] }
>();
const eventName = "mozy-candidates-changed";

function readRecords(key: string) {
  const raw = window.localStorage.getItem(key);
  const cached = cache.get(key);
  if (cached?.raw === raw) return cached.records;
  const records = parseCandidateRecords(raw);
  cache.set(key, { raw, records });
  return records;
}

export function useCandidateRecords(
  configVersion: string,
  reservationId: string,
  solver: string,
  enabled = true,
) {
  const key = candidateStorageKey(configVersion, reservationId, solver);
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!enabled) return () => undefined;
      const localListener = (event: Event) => {
        if ((event as CustomEvent<string>).detail === key) notify();
      };
      const storageListener = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      window.addEventListener(eventName, localListener);
      window.addEventListener("storage", storageListener);
      return () => {
        window.removeEventListener(eventName, localListener);
        window.removeEventListener("storage", storageListener);
      };
    },
    [enabled, key],
  );
  const getSnapshot = useCallback(
    () => (enabled ? readRecords(key) : serverRecords),
    [enabled, key],
  );
  const records = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverRecords,
  );
  const upsert = useCallback(
    (record: CandidateRecord) => {
      if (!enabled) return;
      const next = mergeCandidateRecord(readRecords(key), record);
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      cache.set(key, { raw, records: next });
      window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
    },
    [enabled, key],
  );
  return {
    records,
    upsert,
    current: [...records]
      .reverse()
      .find((record) => record.localState !== "replaced"),
  };
}
