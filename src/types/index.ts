export * from './agent';
export * from './project';
export * from './workflow';

export interface SystemStatus {
  version: string;
  activeAgents: number;
  databaseConnected: boolean;
  uptimeSeconds: number;
}

export interface DatabaseStatus {
  connected: boolean;
  poolSize?: number;
  idleConnections?: number;
}
