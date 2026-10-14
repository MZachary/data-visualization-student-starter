import { useEffect, useState } from 'react';
import { decodeDataset, type Dataset, type Entry, type Loaded, type Manifest } from './data';

const base = `${import.meta.env.BASE_URL}data/week-08/`;
const cache = new Map<string, Promise<unknown>>();
async function read<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const pending = fetch(base + file)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load saved data (HTTP ${response.status}).`);
        return response.json();
      })
      .catch((error: unknown) => {
        cache.delete(file);
        throw error;
      });
    cache.set(file, pending);
  }
  return cache.get(file)! as Promise<T>;
}
export function useManifest(retry: number) {
  const [state, setState] = useState<{ value?: Manifest; error?: string; attempt?: number }>({});
  useEffect(() => {
    let current = true;
    read<Manifest>('manifest.json')
      .then((value) => {
        if (value.schemaVersion !== 1 || !Array.isArray(value.datasets) || !value.datasets.length) {
          cache.delete('manifest.json');
          throw new Error('No region/month datasets are available.');
        }
        if (current) setState({ value, attempt: retry });
      })
      .catch((error: Error) => {
        if (current) setState({ error: error.message, attempt: retry });
      });
    return () => {
      current = false;
    };
  }, [retry]);
  return state.attempt === retry ? state : {};
}
export function usePair(left: Entry, right: Entry, retry: number) {
  const key = `${left.file}|${right.file}|${retry}`;
  const [state, setState] = useState<{ key: string; value?: Loaded[]; error?: string }>({
    key: '',
  });
  useEffect(() => {
    let current = true;
    Promise.all(
      [left, right].map(async (entry) => {
        const data = await read<Dataset>(entry.file);
        try {
          return decodeDataset(data, entry);
        } catch (error) {
          cache.delete(entry.file);
          throw error;
        }
      }),
    )
      .then((value) => {
        if (current) setState({ key, value });
      })
      .catch((error: Error) => {
        if (current) setState({ key, error: error.message });
      });
    // Shared requests may still complete and populate the cache. Outdated results
    // never replace a newer selection, including StrictMode's effect replays.
    return () => {
      current = false;
    };
  }, [left, right, key]);
  return state.key === key ? state : { key };
}
