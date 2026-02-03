import { io, Socket } from 'socket.io-client';
import { WS_URL, WS_RECONNECT_DELAY, WS_MAX_RECONNECT_ATTEMPTS } from './constants';
import type { WSEvent, WSEventType } from '@/types';

type EventCallback = (data: WSEvent) => void;

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, Set<EventCallback>> = new Map();
  private globalSubscriptions: Set<EventCallback> = new Set();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: WS_RECONNECT_DELAY,
      reconnectionAttempts: WS_MAX_RECONNECT_ATTEMPTS,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      
      // Resubscribe to all active subscriptions
      this.subscriptions.forEach((_, matchId) => {
        this.socket?.emit('subscribe', { matchId });
      });
      
      if (this.globalSubscriptions.size > 0) {
        this.socket?.emit('subscribe_global');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Handle incoming events
    this.socket.on('event', (event: WSEvent) => {
      // Notify match-specific subscribers
      const matchCallbacks = this.subscriptions.get(event.matchId);
      if (matchCallbacks) {
        matchCallbacks.forEach(callback => callback(event));
      }

      // Notify global subscribers
      this.globalSubscriptions.forEach(callback => callback(event));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.globalSubscriptions.clear();
  }

  // Subscribe to a specific match
  subscribeToMatch(matchId: string, callback: EventCallback): () => void {
    if (!this.subscriptions.has(matchId)) {
      this.subscriptions.set(matchId, new Set());
      this.socket?.emit('subscribe', { matchId });
    }

    this.subscriptions.get(matchId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(matchId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(matchId);
          this.socket?.emit('unsubscribe', { matchId });
        }
      }
    };
  }

  // Subscribe to global events (all matches)
  subscribeGlobal(callback: EventCallback): () => void {
    if (this.globalSubscriptions.size === 0) {
      this.socket?.emit('subscribe_global');
    }

    this.globalSubscriptions.add(callback);

    return () => {
      this.globalSubscriptions.delete(callback);
      if (this.globalSubscriptions.size === 0) {
        this.socket?.emit('unsubscribe_global');
      }
    };
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Get socket instance (for advanced use)
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
export const socketClient = new SocketClient();

// React hook for WebSocket connection
export function useSocket() {
  return {
    connect: () => socketClient.connect(),
    disconnect: () => socketClient.disconnect(),
    subscribeToMatch: (matchId: string, callback: EventCallback) => 
      socketClient.subscribeToMatch(matchId, callback),
    subscribeGlobal: (callback: EventCallback) => 
      socketClient.subscribeGlobal(callback),
    isConnected: () => socketClient.isConnected(),
  };
}
