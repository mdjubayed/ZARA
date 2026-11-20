export type ZaraStatus =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking';

export type SidebarTab =
  | 'chat'
  | 'memory'
  | 'skills'
  | 'history'
  | 'settings';

export interface Message {
  id: string;
  role: 'user' | 'zara';
  content: string;
  timestamp: Date;
}