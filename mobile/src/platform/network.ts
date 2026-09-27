// Online/offline for Android and iOS. Saving needs a connection (HANDOFF.md §2.3), so the
// app greys out save buttons while this says offline. The web version is network.web.ts.

import * as Network from "expo-network";

export function watchOnline(onChange: (online: boolean) => void): () => void {
  const read = (s: Network.NetworkState) => s.isConnected !== false && s.isInternetReachable !== false;
  Network.getNetworkStateAsync().then((s) => onChange(read(s))).catch(() => {});
  const sub = Network.addNetworkStateListener((s) => onChange(read(s)));
  return () => sub.remove();
}
