// Shared helpers for displaying ESP32-CAM capture times and connection
// status. Both live purely on `isoTime` (a UTC ISO-8601 string set by the
// server at capture time), never on the server's own local clock, so the
// displayed time and "online/offline" status are correct regardless of
// which timezone the server happens to run in.

export interface CameraFrameLike {
  isoTime?: string;
  timestamp?: string;
}

// The firmware captures + uploads a new frame every 60 seconds. Allow some
// slack for network jitter / a slow upload before calling the camera
// "offline" rather than flagging every normal delay as a disconnect.
export const CAMERA_STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Renders a capture's time in the viewer's own local timezone. Falls back
 * to the server-formatted `timestamp` string only for old records that
 * predate `isoTime` being stored.
 */
export function formatCaptureTime(frame: CameraFrameLike | null | undefined): string {
  if (frame?.isoTime) {
    const parsed = new Date(frame.isoTime);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  return frame?.timestamp || '—';
}

/** True when the given frame was captured recently enough to call the camera "online". */
export function isCameraOnline(frame: CameraFrameLike | null | undefined): boolean {
  if (!frame?.isoTime) return false;
  const capturedAt = new Date(frame.isoTime).getTime();
  if (isNaN(capturedAt)) return false;
  return Date.now() - capturedAt < CAMERA_STALE_THRESHOLD_MS;
}

/** Human-readable "how long ago" string for the last capture, e.g. "2m ago". */
export function timeSinceCapture(frame: CameraFrameLike | null | undefined): string {
  if (!frame?.isoTime) return 'unknown';
  const capturedAt = new Date(frame.isoTime).getTime();
  if (isNaN(capturedAt)) return 'unknown';
  const deltaSec = Math.max(0, Math.round((Date.now() - capturedAt) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  return `${deltaHr}h ago`;
}
