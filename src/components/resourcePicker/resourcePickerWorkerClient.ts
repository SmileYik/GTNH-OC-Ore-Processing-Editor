import { useEffect, useRef, useState } from 'react';
import type { ResourceKind, ResourceLocale, ResourceRecord } from '../../lib/resourceDatabase';
import { filterAndSortResourceRecords, type ResourceFilters } from './resourcePickerQuery';
import {
  getResourcePickerDatasetKey,
  type ResourcePickerWorkerDatasetMessage,
  type ResourcePickerWorkerQueryMessage,
  type ResourcePickerWorkerRequest,
  type ResourcePickerWorkerResponse
} from './resourcePickerWorkerProtocol';

export interface ResourcePickerWorkerState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  indices: Uint32Array;
  totalCount: number;
  error: string;
  datasetKey: string;
  isCurrentDatasetReady: boolean;
}

type ResourcePickerWorkerListener = (message: ResourcePickerWorkerResponse) => void;

let sharedWorker: Worker | null = null;
let workerUnavailable = false;
let nextChannelId = 0;

const workerListeners = new Map<string, Set<ResourcePickerWorkerListener>>();
const sentDatasetKeys = new Set<string>();

function createChannelId(): string {
  nextChannelId += 1;
  return `resource-picker-${nextChannelId}`;
}

function ensureSharedWorker(): Worker {
  if (workerUnavailable) {
    throw new Error('Resource picker worker is unavailable.');
  }

  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL('./resourcePicker.worker.ts', import.meta.url), {
        type: 'module'
      });
      sharedWorker.addEventListener('message', handleWorkerMessage);
      sharedWorker.addEventListener('error', handleWorkerError);
    } catch (error) {
      workerUnavailable = true;
      throw error;
    }
  }

  return sharedWorker;
}

function handleWorkerMessage(event: MessageEvent<ResourcePickerWorkerResponse>): void {
  const message = event.data;
  const listeners = workerListeners.get(message.channelId);
  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => listener(message));
}

function broadcastWorkerError(message: string): void {
  for (const [channelId, listeners] of workerListeners.entries()) {
    const errorMessage: ResourcePickerWorkerResponse = {
      type: 'error',
      channelId,
      message
    };

    listeners.forEach((listener) => listener(errorMessage));
  }
}

function handleWorkerError(event: ErrorEvent): void {
  workerUnavailable = true;
  const message = event.error instanceof Error ? event.error.message : event.message || 'Resource picker worker crashed';
  console.error('Resource picker worker crashed', event.error ?? event.message);
  broadcastWorkerError(message);
}

function subscribeToWorker(channelId: string, listener: ResourcePickerWorkerListener): () => void {
  let listeners = workerListeners.get(channelId);
  if (!listeners) {
    listeners = new Set<ResourcePickerWorkerListener>();
    workerListeners.set(channelId, listeners);
  }

  listeners.add(listener);

  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      workerListeners.delete(channelId);
    }
  };
}

function tryPostWorkerMessage(message: ResourcePickerWorkerRequest): boolean {
  try {
    ensureSharedWorker().postMessage(message);
    return true;
  } catch (error) {
    workerUnavailable = true;
    console.error('Failed to post resource picker worker message', error);
    return false;
  }
}

function createInitialState(datasetKey: string): ResourcePickerWorkerState {
  return {
    status: 'idle',
    indices: new Uint32Array(),
    totalCount: 0,
    error: '',
    datasetKey,
    isCurrentDatasetReady: false
  };
}

export function useResourcePickerWorkerQuery(
  kind: ResourceKind,
  locale: ResourceLocale,
  records: ResourceRecord[],
  filters: ResourceFilters
): ResourcePickerWorkerState {
  const [channelId] = useState(() => createChannelId());
  const requestIdRef = useRef(0);
  const currentDatasetKeyRef = useRef(getResourcePickerDatasetKey(kind, locale));
  const [state, setState] = useState<ResourcePickerWorkerState>(() => createInitialState(currentDatasetKeyRef.current));

  const datasetKey = getResourcePickerDatasetKey(kind, locale);

  useEffect(() => {
    currentDatasetKeyRef.current = datasetKey;
    setState((current) => ({
      ...current,
      status: 'loading',
      error: '',
      datasetKey,
      isCurrentDatasetReady: false
    }));
  }, [datasetKey]);

  useEffect(() => {
    return subscribeToWorker(channelId, (message) => {
      if (message.type === 'result') {
        if (message.datasetKey !== currentDatasetKeyRef.current) {
          return;
        }

        if (message.requestId !== requestIdRef.current) {
          return;
        }

        setState({
          status: 'ready',
          indices: message.indices,
          totalCount: message.totalCount,
          error: '',
          datasetKey: message.datasetKey,
          isCurrentDatasetReady: true
        });
        return;
      }

      if (message.datasetKey !== undefined && message.datasetKey !== currentDatasetKeyRef.current) {
        return;
      }

      if (message.requestId !== undefined && message.requestId !== requestIdRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        status: 'error',
        error: message.message,
        datasetKey: message.datasetKey ?? currentDatasetKeyRef.current,
        isCurrentDatasetReady: current.isCurrentDatasetReady
      }));
    });
  }, []);

  useEffect(() => {
    if (!records.length) {
      return;
    }

    const datasetMessage: ResourcePickerWorkerDatasetMessage = {
      type: 'dataset',
      channelId,
      datasetKey,
      kind,
      locale,
      records
    };

    if (!sentDatasetKeys.has(datasetKey)) {
      if (tryPostWorkerMessage(datasetMessage)) {
        sentDatasetKeys.add(datasetKey);
      } else {
        const fallbackIndices = filterAndSortResourceRecords(records, filters);
        setState({
          status: 'ready',
          indices: fallbackIndices,
          totalCount: fallbackIndices.length,
          error: '',
          datasetKey,
          isCurrentDatasetReady: true
        });
        return;
      }
    }
  }, [datasetKey, kind, locale, records]);

  useEffect(() => {
    if (!records.length) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState((current) => ({
      ...current,
      status: 'loading',
      error: '',
      datasetKey,
      isCurrentDatasetReady: current.datasetKey === datasetKey ? current.isCurrentDatasetReady : false
    }));

    const queryMessage: ResourcePickerWorkerQueryMessage = {
      type: 'query',
      channelId,
      requestId,
      datasetKey,
      kind,
      locale,
      filters
    };

    if (!tryPostWorkerMessage(queryMessage)) {
      const fallbackIndices = filterAndSortResourceRecords(records, filters);
      setState({
        status: 'ready',
        indices: fallbackIndices,
        totalCount: fallbackIndices.length,
        error: '',
        datasetKey,
        isCurrentDatasetReady: true
      });
    }
  }, [channelId, datasetKey, filters, kind, locale, records]);

  return state;
}
