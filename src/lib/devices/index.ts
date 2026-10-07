import { MockAdapter } from "./mock"
import { ZkAdapter } from "./zk"
import type { DeviceAdapter, DeviceRow } from "./types"

/** QR devices receive punches when people scan; there is nothing to pull. */
class QrAdapter implements DeviceAdapter {
  async testConnection() {
    return { ok: true, message: "dev.qr.ok" }
  }
  async fetchPunches() {
    return []
  }
}

export function adapterFor(device: DeviceRow): DeviceAdapter {
  if (device.mode === "QR") return new QrAdapter()
  return device.mode === "PULL" ? new ZkAdapter(device) : new MockAdapter(device)
}
