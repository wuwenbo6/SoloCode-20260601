import paho.mqtt.client as mqtt
import json
import time
from typing import Callable, Optional, List

from app.core.config import settings


class MQTTClient:
    def __init__(self):
        self.client = mqtt.Client()
        self.connected = False
        self.on_message_callback: Optional[Callable] = None
        self.on_reconnect_callbacks: List[Callable] = []
        self._subscribed_topics: List[str] = []

    def connect(self) -> None:
        max_retries = 10
        retry_delay = 3

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        for attempt in range(max_retries):
            try:
                self.client.connect(settings.MQTT_HOST, settings.MQTT_PORT, 60)
                self.client.loop_start()
                time.sleep(2)
                if self.connected:
                    print(f"Connected to MQTT broker at {settings.MQTT_HOST}:{settings.MQTT_PORT}")
                    return
            except Exception as e:
                print(f"MQTT connection attempt {attempt + 1} failed: {e}")
                time.sleep(retry_delay)

        raise Exception(f"Failed to connect to MQTT broker after {max_retries} attempts")

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            topics = [
                settings.MQTT_TOPIC_SENSOR,
                settings.MQTT_TOPIC_AC,
                settings.MQTT_TOPIC_LIGHT,
            ]
            for topic in topics:
                client.subscribe(topic)
                self._subscribed_topics.append(topic)
                print(f"Subscribed to {topic}")

            is_reconnect = flags is not None
            if is_reconnect:
                print("MQTT reconnected, triggering reconnect callbacks")
                for cb in self.on_reconnect_callbacks:
                    try:
                        cb()
                    except Exception as e:
                        print(f"Reconnect callback error: {e}")
        else:
            print(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, rc):
        self.connected = False
        if rc != 0:
            print(f"MQTT unexpected disconnect (rc={rc}), will auto-reconnect")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            if self.on_message_callback:
                self.on_message_callback(msg.topic, payload)
        except json.JSONDecodeError:
            print(f"Invalid JSON on topic {msg.topic}: {msg.payload}")
        except Exception as e:
            print(f"Error processing MQTT message: {e}")

    def set_message_callback(self, callback: Callable) -> None:
        self.on_message_callback = callback

    def add_reconnect_callback(self, callback: Callable) -> None:
        self.on_reconnect_callbacks.append(callback)

    def publish(self, topic: str, payload: dict) -> None:
        if not self.connected:
            raise Exception("MQTT client not connected")
        self.client.publish(topic, json.dumps(payload))

    def request_device_status(self) -> None:
        if self.connected:
            self.client.publish(
                settings.MQTT_TOPIC_STATUS_REQUEST,
                json.dumps({"request": "all", "timestamp": time.time()})
            )
            print("Requested device status from all devices")

    def disconnect(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()
        self.connected = False


mqtt_client = MQTTClient()
