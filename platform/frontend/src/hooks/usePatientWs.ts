import { useEffect, useRef, useCallback } from 'react'
import type { WsMessage } from '../types'

/**
 * React hook that connects to the patient WebSocket and invokes
 * the callback whenever a real-time message arrives.
 */
export function usePatientWs(
  patientId: number | null,
  onMessage: (msg: WsMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  const connect = useCallback(() => {
    if (!patientId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/patient/${patientId}`,
    )

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data)
        cbRef.current(data)
      } catch {
        // ignore non-JSON frames
      }
    }

    ws.onclose = () => {
      // Reconnect after 3 s unless we intentionally closed
      if (wsRef.current === ws) {
        setTimeout(connect, 3000)
      }
    }

    wsRef.current = ws
  }, [patientId])

  useEffect(() => {
    connect()
    return () => {
      const ws = wsRef.current
      wsRef.current = null
      ws?.close()
    }
  }, [connect])

  return wsRef
}
