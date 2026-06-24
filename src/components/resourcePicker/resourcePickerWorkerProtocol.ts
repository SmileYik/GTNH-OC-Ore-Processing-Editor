import type { ResourceKind, ResourceLocale, ResourceRecord } from '../../lib/resourceDatabase';
import type { ResourceFilters } from './resourcePickerQuery';

export function getResourcePickerDatasetKey(kind: ResourceKind, locale: ResourceLocale): string {
  return `${kind}:${locale}`;
}

export interface ResourcePickerWorkerDatasetMessage {
  type: 'dataset';
  channelId: string;
  datasetKey: string;
  kind: ResourceKind;
  locale: ResourceLocale;
  records: ResourceRecord[];
}

export interface ResourcePickerWorkerQueryMessage {
  type: 'query';
  channelId: string;
  requestId: number;
  datasetKey: string;
  kind: ResourceKind;
  locale: ResourceLocale;
  filters: ResourceFilters;
}

export interface ResourcePickerWorkerResultMessage {
  type: 'result';
  channelId: string;
  requestId: number;
  datasetKey: string;
  totalCount: number;
  indices: Uint32Array;
}

export interface ResourcePickerWorkerErrorMessage {
  type: 'error';
  channelId: string;
  requestId?: number;
  datasetKey?: string;
  message: string;
}

export type ResourcePickerWorkerRequest = ResourcePickerWorkerDatasetMessage | ResourcePickerWorkerQueryMessage;
export type ResourcePickerWorkerResponse = ResourcePickerWorkerResultMessage | ResourcePickerWorkerErrorMessage;
