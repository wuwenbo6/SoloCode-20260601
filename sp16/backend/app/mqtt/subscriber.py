from datetime import datetime
from typing import Optional
import threading

from app.mqtt.client import mqtt_client
from app.core.database import SessionLocal
from app.crud.device import (
    create_temperature_history,
    update_or_create_device_status,
    get_all_device_statuses,
)
from app.schemas.device import TemperatureReading
from app.core.config import settings
from app.websocket.manager import broadcast_temperature_update, broadcast_device_update, broadcast_full_state

current_temperature: Optional[float] = None


def get_current_temperature() -> Optional[float]:
    return current_temperature


def _broadcast_temp(temp: float):
    try:
        broadcast_temperature_update(temp)
    except Exception as e:
        print(f"Error broadcasting temp: {e}")


def _broadcast_device(device_type: str, data: dict):
    try:
        broadcast_device_update(device_type, data)
    except Exception as e:
        print(f"Error broadcasting device update: {e}")


def _broadcast_full_state_sync():
    try:
        db = SessionLocal()
        try:
            devices = get_all_device_statuses(db)
            broadcast_full_state(current_temperature, devices)
            print("Broadcasted full state sync after MQTT reconnect")
        finally:
            db.close()
    except Exception as e:
        print(f"Error broadcasting full state: {e}")


def _on_mqtt_reconnect():
    mqtt_client.request_device_status()
    threading.Thread(target=_broadcast_full_state_sync, daemon=True).start()


def handle_mqtt_message(topic: str, payload: dict) -> None:
    global current_temperature

    if topic == settings.MQTT_TOPIC_STATUS_REQUEST:
        return

    db = SessionLocal()
    try:
        if topic == settings.MQTT_TOPIC_SENSOR:
            temperature = payload.get("temperature")
            if temperature is not None:
                current_temperature = float(temperature)
                timestamp = payload.get("timestamp")
                reading = TemperatureReading(
                    temperature=temperature,
                    timestamp=datetime.fromisoformat(timestamp) if timestamp else None
                )
                create_temperature_history(db, reading)
                threading.Thread(target=_broadcast_temp, args=(float(temperature),), daemon=True).start()

        elif topic == settings.MQTT_TOPIC_AC:
            is_on = payload.get("is_on", False)
            target_temp = payload.get("target_temperature")
            update_or_create_device_status(
                db, "ac", is_on, target_temperature=target_temp
            )
            threading.Thread(
                target=_broadcast_device,
                args=("ac", {"is_on": is_on, "target_temperature": target_temp}),
                daemon=True
            ).start()

        elif topic == settings.MQTT_TOPIC_LIGHT:
            is_on = payload.get("is_on", False)
            brightness = payload.get("brightness")
            update_or_create_device_status(
                db, "light", is_on, brightness=brightness
            )
            threading.Thread(
                target=_broadcast_device,
                args=("light", {"is_on": is_on, "brightness": brightness}),
                daemon=True
            ).start()

    except Exception as e:
        print(f"Error handling MQTT message: {e}")
    finally:
        db.close()


def init_subscriber() -> None:
    mqtt_client.set_message_callback(handle_mqtt_message)
    mqtt_client.add_reconnect_callback(_on_mqtt_reconnect)
    mqtt_client.connect()
    print("MQTT subscriber initialized")
