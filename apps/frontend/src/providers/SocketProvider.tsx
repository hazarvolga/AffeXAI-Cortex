'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    lastEvent: any | null;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    lastEvent: null,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
    children: ReactNode;
    tenantId?: string;
    userId?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children, tenantId = 'default', userId = 'admin' }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<any | null>(null);

    useEffect(() => {
        // Initialize Socket
        const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
            transports: ['websocket'],
            autoConnect: true,
        });

        socketInstance.on('connect', () => {
            console.log('🔌 Socket Connected:', socketInstance.id);
            setIsConnected(true);

            // Join Tenant Room
            socketInstance.emit('join', { tenantId, userId });
        });

        socketInstance.on('disconnect', () => {
            console.log('🔌 Socket Disconnected');
            setIsConnected(false);
        });

        socketInstance.on('notification', (payload) => {
            console.log('🔔 Notification Received:', payload);
            setLastEvent(payload);
        });

        // Specific event for insights (if we separate them)
        socketInstance.on('insight.generated', (payload) => {
            console.log('🧠 Insight Received:', payload);
            setLastEvent({ type: 'neural-insight', ...payload });
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [tenantId, userId]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, lastEvent }}>
            {children}
        </SocketContext.Provider>
    );
};
