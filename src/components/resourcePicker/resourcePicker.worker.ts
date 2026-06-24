/// <reference lib="webworker" />

import { filterAndSortResourceRecords } from './resourcePickerQuery';
import {
  type ResourcePickerWorkerDatasetMessage,
  type ResourcePickerWorkerErrorMessage,
  type ResourcePickerWorkerQueryMessage,
  type ResourcePickerWorkerRequest,
  type ResourcePickerWorkerResultMessage
} from './resourcePickerWorkerProtocol';
import type { ResourceRecord } from '../../lib/resourceDatabase';

const workerGlobal = self as DedicatedWorkerGlobalScope;
const resourceDatasets = new Map<string, ResourceRecord[]>();

function postError(message: ResourcePickerWorkerQueryMessage | ResourcePickerWorkerDatasetMessage, error: unknown): void {
  const response: ResourcePickerWorkerErrorMessage = {
    type: 'error',
    channelId: message.channelId,
    requestId: 'requestId' in message ? message.requestId : undefined,
    datasetKey: message.datasetKey,
    message: error instanceof Error ? error.message : String(error)
  };

  workerGlobal.postMessage(response);
}

function handleDatasetMessage(message: ResourcePickerWorkerDatasetMessage): void {
  resourceDatasets.set(message.datasetKey, message.records);
}

function handleQueryMessage(message: ResourcePickerWorkerQueryMessage): void {
  const records = resourceDatasets.get(message.datasetKey);
  if (!records) {
    postError(message, new Error(`找不到已缓存的数据库：${message.datasetKey}`));
    return;
  }

  const indices = filterAndSortResourceRecords(records, message.filters);
  const response: ResourcePickerWorkerResultMessage = {
    type: 'result',
    channelId: message.channelId,
    requestId: message.requestId,
    datasetKey: message.datasetKey,
    totalCount: indices.length,
    indices
  };

  workerGlobal.postMessage(response, [indices.buffer]);
}

workerGlobal.addEventListener('message', (event: MessageEvent<ResourcePickerWorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === 'dataset') {
      handleDatasetMessage(message);
    } else {
      handleQueryMessage(message);
    }
  } catch (error) {
    postError(message, error);
  }
});

export {};
