export type RawPunch = { pin: string; punchedAt: Date; type: "IN" | "OUT" }

export interface DeviceAdapter {
  testConnection(): Promise<{ ok: boolean; message: string; users?: number }>
  /** All punches at or after `since` (null = as far back as the device allows). */
  fetchPunches(since: Date | null): Promise<RawPunch[]>
}

export type DeviceRow = { id: string; name: string; ip: string | null; port: number; mode: "MOCK" | "PULL" | "PUSH" | "QR"; locationId: string | null }
