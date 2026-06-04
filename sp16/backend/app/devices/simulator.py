import paho.mqtt.client as mqtt
import json
import random
import time
import threading
from datetime import datetime

from app.core.config import settings


class TemperatureSensor:
    def __init__(self, mqtt_host: str = "mosquitto", mqtt_port: int = 1883):
        self.client = mqtt.Client()
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.running = False
        self.current_temperature = 25.0

    def connect(self):
        max_retries = 10
        for attempt in range(max_retries):
            try:
                self.client.connect(self.mqtt_host, self.mqtt_port, 60)
                self.client.on_message = self._on_message
                self.client.subscribe(settings.MQTT_TOPIC_STATUS_REQUEST)
                self.client.loop_start()
                print("Temperature sensor connected to MQTT")
                return
            except Exception as e:
                print(f"Sensor MQTT connection attempt {attempt + 1} failed: {e}")
                time.sleep(3)
        raise Exception("Failed to connect sensor to MQTT")

    def _on_message(self, client, userdata, msg):
        if msg.topic == settings.MQTT_TOPIC_STATUS_REQUEST:
            print("Sensor received status request, publishing current state")
            self.publish()

    def generate_temperature(self) -> float:
        change = random.uniform(-1.5, 1.5)
        new_temp = self.current_temperature + change
        new_temp = max(20.0, min(40.0, new_temp))
        self.current_temperature = round(new_temp, 2)
        return self.current_temperature

    def publish(self):
        temp = self.generate_temperature()
        payload = {
            "temperature": temp,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.client.publish(settings.MQTT_TOPIC_SENSOR, json.dumps(payload))
        print(f"Published temperature: {temp}°C")

    def start(self):
        self.connect()
        self.running = True
        while self.running:
            self.publish()
            time.sleep(5)

    def stop(self):
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()


class AirConditioner:
    def __init__(self, mqtt_host: str = "mosquitto", mqtt_port: int = 1883):
        self.client = mqtt.Client()
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.is_on = False
        self.target_temperature = 24.0
        self.running = False

    def connect(self):
        max_retries = 10
        for attempt in range(max_retries):
            try:
                self.client.connect(self.mqtt_host, self.mqtt_port, 60)
                self.client.on_message = self._on_message
                self.client.subscribe(settings.MQTT_TOPIC_AC_CONTROL)
                self.client.subscribe(settings.MQTT_TOPIC_STATUS_REQUEST)
                self.client.loop_start()
                print("Air conditioner connected to MQTT")
                return
            except Exception as e:
                print(f"AC MQTT connection attempt {attempt + 1} failed: {e}")
                time.sleep(3)
        raise Exception("Failed to connect AC to MQTT")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())

            if msg.topic == settings.MQTT_TOPIC_STATUS_REQUEST:
                print("AC received status request, publishing current state")
                self.publish_status()
                return

            print(f"AC received command: {payload}")
            if "is_on" in payload:
                self.is_on = payload["is_on"]
            if "target_temperature" in payload:
                self.target_temperature = payload["target_temperature"]
            self.publish_status()
        except Exception as e:
            print(f"Error processing AC message: {e}")

    def publish_status(self):
        payload = {
            "is_on": self.is_on,
            "target_temperature": self.target_temperature,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.client.publish(settings.MQTT_TOPIC_AC, json.dumps(payload))
        print(f"Published AC status: on={self.is_on}, target={self.target_temperature}°C")

    def start(self):
        self.connect()
        self.running = True
        self.publish_status()
        while self.running:
            self.publish_status()
            time.sleep(10)

    def stop(self):
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()


class Light:
    def __init__(self, mqtt_host: str = "mosquitto", mqtt_port: int = 1883):
        self.client = mqtt.Client()
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.is_on = False
        self.brightness = 50
        self.running = False

    def connect(self):
        max_retries = 10
        for attempt in range(max_retries):
            try:
                self.client.connect(self.mqtt_host, self.mqtt_port, 60)
                self.client.on_message = self._on_message
                self.client.subscribe(settings.MQTT_TOPIC_LIGHT_CONTROL)
                self.client.subscribe(settings.MQTT_TOPIC_STATUS_REQUEST)
                self.client.loop_start()
                print("Light connected to MQTT")
                return
            except Exception as e:
                print(f"Light MQTT connection attempt {attempt + 1} failed: {e}")
                time.sleep(3)
        raise Exception("Failed to connect Light to MQTT")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())

            if msg.topic == settings.MQTT_TOPIC_STATUS_REQUEST:
                print("Light received status request, publishing current state")
                self.publish_status()
                return

            print(f"Light received command: {payload}")
            if "is_on" in payload:
                self.is_on = payload["is_on"]
            if "brightness" in payload:
                self.brightness = payload["brightness"]
            self.publish_status()
        except Exception as e:
            print(f"Error processing Light message: {e}")

    def publish_status(self):
        payload = {
            "is_on": self.is_on,
            "brightness": self.brightness,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.client.publish(settings.MQTT_TOPIC_LIGHT, json.dumps(payload))
        print(f"Published Light status: on={self.is_on}, brightness={self.brightness}%")

    def start(self):
        self.connect()
        self.running = True
        self.publish_status()
        while self.running:
            self.publish_status()
            time.sleep(10)

    def stop(self):
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()


def run_all_simulators():
    import os
    mqtt_host = os.environ.get("MQTT_HOST", "mosquitto")
    mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))

    sensor = TemperatureSensor(mqtt_host, mqtt_port)
    ac = AirConditioner(mqtt_host, mqtt_port)
    light = Light(mqtt_host, mqtt_port)

    sensor_thread = threading.Thread(target=sensor.start)
    ac_thread = threading.Thread(target=ac.start)
    light_thread = threading.Thread(target=light.start)

    sensor_thread.daemon = True
    ac_thread.daemon = True
    light_thread.daemon = True

    sensor_thread.start()
    ac_thread.start()
    light_thread.start()

    print("All device simulators started")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping simulators...")
        sensor.stop()
        ac.stop()
        light.stop()


if __name__ == "__main__":
    run_all_simulators()
