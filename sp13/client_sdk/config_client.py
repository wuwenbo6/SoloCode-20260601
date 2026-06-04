import requests
import json
import time
import threading
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
try:
    import websocket
except ImportError:
    websocket = None


class ConfigClient:
    def __init__(self, base_url: str = "http://localhost:8080/api/v1", timeout: int = 30, operator: str = ""):
        self.base_url = base_url
        self.timeout = timeout
        self.operator = operator
        self.session = requests.Session()
        if operator:
            self.session.headers["X-Operator"] = operator

    def create_config(self, key: str, value: Dict[str, Any], format: str = "json", encrypted: bool = False) -> Dict[str, Any]:
        url = f"{self.base_url}/configs"
        payload = {"key": key, "value": value, "format": format, "encrypted": encrypted}
        response = self.session.post(url, json=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def get_config(self, key: str, format: str = "json") -> Dict[str, Any]:
        url = f"{self.base_url}/configs/{key}"
        params = {"format": format}
        response = self.session.get(url, params=params, timeout=self.timeout)
        response.raise_for_status()
        if format == "yaml":
            return {"raw": response.text}
        return response.json()

    def update_config(self, key: str, value: Dict[str, Any], format: str = "json", encrypted: bool = False) -> Dict[str, Any]:
        url = f"{self.base_url}/configs/{key}"
        payload = {"value": value, "format": format, "encrypted": encrypted}
        response = self.session.put(url, json=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def delete_config(self, key: str) -> Dict[str, Any]:
        url = f"{self.base_url}/configs/{key}"
        response = self.session.delete(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def list_configs(self) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/configs"
        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def get_versions(self, key: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/configs/{key}/versions"
        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def rollback_config(self, key: str, version: int) -> Dict[str, Any]:
        url = f"{self.base_url}/configs/{key}/rollback"
        payload = {"version": version}
        response = self.session.post(url, json=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def query_audit_logs(self, key: str = "", action: str = "", operator: str = "",
                         from_time: str = "", to_time: str = "", limit: int = 50,
                         offset: int = 0) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/audit"
        params = {"limit": limit, "offset": offset}
        if key:
            params["key"] = key
        if action:
            params["action"] = action
        if operator:
            params["operator"] = operator
        if from_time:
            params["from"] = from_time
        if to_time:
            params["to"] = to_time
        response = self.session.get(url, params=params, timeout=self.timeout)
        response.raise_for_status()
        return response.json()


class ConfigWatcher:
    def __init__(
        self,
        base_url: str = "http://localhost:8080/api/v1",
        keys: Optional[List[str]] = None,
        on_change: Optional[Callable] = None,
        on_reconnect: Optional[Callable] = None,
        reconnect_interval: float = 2.0,
        ping_interval: float = 30.0,
    ):
        if websocket is None:
            raise ImportError("websocket-client is required: pip install websocket-client")

        self.base_url = base_url
        self.ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
        self.keys = keys or []
        self.on_change = on_change
        self.on_reconnect = on_reconnect
        self.reconnect_interval = reconnect_interval
        self.ping_interval = ping_interval

        self._ws: Optional[websocket.WebSocketApp] = None
        self._running = False
        self._configs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._subscribed_keys: set = set()

    def start(self):
        self._running = True
        self._connect_loop()

    def start_async(self) -> threading.Thread:
        t = threading.Thread(target=self.start, daemon=True)
        t.start()
        return t

    def stop(self):
        self._running = False
        if self._ws:
            self._ws.close()

    def subscribe(self, key: str):
        with self._lock:
            self._subscribed_keys.add(key)
            if key not in self.keys:
                self.keys.append(key)
        if self._ws:
            msg = json.dumps({"type": "subscribe", "key": key})
            try:
                self._ws.send(msg)
            except Exception:
                pass

    def unsubscribe(self, key: str):
        with self._lock:
            self._subscribed_keys.discard(key)
            if key in self.keys:
                self.keys.remove(key)
        if self._ws:
            msg = json.dumps({"type": "unsubscribe", "key": key})
            try:
                self._ws.send(msg)
            except Exception:
                pass

    def get_config(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._configs.get(key)

    def _connect_loop(self):
        while self._running:
            try:
                self._ws = websocket.WebSocketApp(
                    self.ws_url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                )
                self._ws.run_forever(ping_interval=self.ping_interval, ping_timeout=10)
            except Exception as e:
                print(f"WebSocket connection error: {e}")

            if self._running:
                print(f"Reconnecting in {self.reconnect_interval}s...")
                time.sleep(self.reconnect_interval)

    def _on_open(self, ws):
        print("WebSocket connected")
        for key in self.keys:
            msg = json.dumps({"type": "subscribe", "key": key})
            ws.send(msg)
        msg = json.dumps({"type": "sync"})
        ws.send(msg)

    def _on_message(self, ws, message):
        try:
            msg = json.loads(message)
        except json.JSONDecodeError:
            return

        msg_type = msg.get("type")

        if msg_type == "full_sync":
            items = msg.get("data", [])
            with self._lock:
                for item in items:
                    self._configs[item["key"]] = item
            if self.on_reconnect:
                self.on_reconnect(self._configs.copy())
            print(f"Full sync received: {len(items)} configs")

        elif msg_type in ("UPDATE", "DELETE"):
            event_data = msg.get("data", msg)
            key = msg.get("key", event_data.get("key"))
            if msg_type == "DELETE":
                with self._lock:
                    self._configs.pop(key, None)
            else:
                with self._lock:
                    self._configs[key] = event_data
            if self.on_change:
                self.on_change(msg_type, key, event_data)

        elif msg_type == "config":
            key = msg.get("key")
            data = msg.get("data", {})
            with self._lock:
                self._configs[key] = data
            if self.on_change:
                self.on_change("config", key, data)

    def _on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        print(f"WebSocket closed: {close_status_code} {close_msg}")


if __name__ == "__main__":
    client = ConfigClient(operator="admin")

    print("=== Creating normal config ===")
    config = client.create_config("app.settings", {
        "debug": True,
        "port": 8000,
        "database": {"host": "localhost", "port": 5432}
    })
    print(f"Created: {json.dumps(config, indent=2)}")

    print("\n=== Creating encrypted config ===")
    secret_config = client.create_config("db.credentials", {
        "username": "admin",
        "password": "s3cr3t_p@ssw0rd",
        "api_key": "ak-1234567890abcdef"
    }, encrypted=True)
    print(f"Created (encrypted): {json.dumps(secret_config, indent=2)}")
    print(f"  -> encrypted={secret_config.get('encrypted')}, value auto-decrypted: {secret_config.get('value')}")

    print("\n=== Getting encrypted config (auto-decrypted) ===")
    fetched = client.get_config("db.credentials")
    print(f"Got: {json.dumps(fetched, indent=2)}")
    print(f"  -> Password visible: {fetched.get('value', {}).get('password')}")

    print("\n=== Getting config (YAML format) ===")
    cfg_yaml = client.get_config("app.settings", format="yaml")
    print(cfg_yaml["raw"])

    print("\n=== Updating config ===")
    updated = client.update_config("app.settings", {
        "debug": False,
        "port": 9000,
        "database": {"host": "db-server", "port": 5432}
    })
    print(f"Updated: {json.dumps(updated, indent=2)}")

    print("\n=== Querying audit logs ===")
    logs = client.query_audit_logs(limit=10)
    print(f"Audit logs ({len(logs)} entries):")
    for log_entry in logs:
        ts = log_entry.get("timestamp", "")[:19]
        print(f"  [{ts}] {log_entry.get('operator')} {log_entry.get('action')} "
              f"key={log_entry.get('key')} v{log_entry.get('version')}")

    print("\n=== Querying audit logs for specific key ===")
    key_logs = client.query_audit_logs(key="app.settings")
    print(f"Logs for 'app.settings' ({len(key_logs)} entries):")
    for log_entry in key_logs:
        ts = log_entry.get("timestamp", "")[:19]
        print(f"  [{ts}] {log_entry.get('operator')} {log_entry.get('action')} v{log_entry.get('version')}")

    print("\n=== Querying audit logs by action ===")
    create_logs = client.query_audit_logs(action="CREATE")
    print(f"CREATE actions ({len(create_logs)} entries)")

    print("\n=== Rolling back ===")
    rolled = client.rollback_config("app.settings", 1)
    print(f"Rolled back: {json.dumps(rolled, indent=2)}")

    print("\n=== Final audit log check ===")
    all_logs = client.query_audit_logs(limit=20)
    print(f"Total audit entries: {len(all_logs)}")
    for log_entry in all_logs:
        ts = log_entry.get("timestamp", "")[:19]
        print(f"  [{ts}] {log_entry.get('operator'):>8} {log_entry.get('action'):<8} "
              f"key={log_entry.get('key')} v{log_entry.get('version')}")

    print("\n=== Cleanup ===")
    client.delete_config("app.settings")
    client.delete_config("db.credentials")
    print("Configs deleted")
