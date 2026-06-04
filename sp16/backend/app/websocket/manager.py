import json
from fastapi import WebSocket
from typing import List

from app.crud.device import get_all_device_statuses
from app.core.database import SessionLocal


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending WS message: {e}")

    async def send_current_state(self, websocket: WebSocket):
        from app.mqtt.subscriber import get_current_temperature
        db = SessionLocal()
        try:
            temp = get_current_temperature()
            devices = get_all_device_statuses(db)
            state = _build_full_state_message(temp, devices)
            await websocket.send_text(json.dumps(state))
        finally:
            db.close()


def _build_full_state_message(temperature, devices) -> dict:
    return {
        "type": "full_state_sync",
        "data": {
            "temperature": temperature,
            "devices": [
                {
                    "device_type": d.device_type,
                    "is_on": d.is_on,
                    "target_temperature": d.target_temperature,
                    "brightness": d.brightness,
                }
                for d in devices
            ],
        },
    }


manager = ConnectionManager()


def _do_broadcast(message: dict):
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(manager.broadcast(message))
    finally:
        loop.close()


def broadcast_device_update(device_type: str, data: dict):
    message = {
        "type": "device_update",
        "data": {
            "device_type": device_type,
            **data,
        },
    }
    _do_broadcast(message)


def broadcast_temperature_update(temperature: float):
    message = {
        "type": "temperature_update",
        "data": {
            "temperature": temperature,
        },
    }
    _do_broadcast(message)


def broadcast_full_state(temperature, devices):
    message = _build_full_state_message(temperature, devices)
    _do_broadcast(message)
