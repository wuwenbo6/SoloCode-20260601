from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.crud.device import (
    get_temperature_history,
    get_latest_temperature,
    get_all_device_statuses,
    get_device_status,
)
from app.schemas.device import (
    TemperatureHistoryResponse,
    DeviceStatusResponse,
    ACControl,
    LightControl,
)
from app.mqtt.client import mqtt_client
from app.mqtt.subscriber import get_current_temperature
from app.core.config import settings

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("/temperature/current")
def get_current_temp():
    temp = get_current_temperature()
    if temp is None:
        return {"temperature": None, "status": "no_data"}
    return {"temperature": temp, "status": "ok"}


@router.get("/temperature/history", response_model=List[TemperatureHistoryResponse])
def get_temp_history(hours: int = 24, limit: int = 1000, db: Session = Depends(get_db)):
    return get_temperature_history(db, hours=hours, limit=limit)


@router.get("/status", response_model=List[DeviceStatusResponse])
def list_device_statuses(db: Session = Depends(get_db)):
    return get_all_device_statuses(db)


@router.get("/status/{device_type}", response_model=DeviceStatusResponse)
def get_single_device_status(device_type: str, db: Session = Depends(get_db)):
    device = get_device_status(db, device_type)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.post("/ac/control")
def control_ac(control: ACControl):
    try:
        payload = {"is_on": control.is_on}
        if control.target_temperature is not None:
            payload["target_temperature"] = control.target_temperature
        mqtt_client.publish(settings.MQTT_TOPIC_AC_CONTROL, payload)
        return {"status": "success", "message": "AC command sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/light/control")
def control_light(control: LightControl):
    try:
        payload = {"is_on": control.is_on}
        if control.brightness is not None:
            payload["brightness"] = control.brightness
        mqtt_client.publish(settings.MQTT_TOPIC_LIGHT_CONTROL, payload)
        return {"status": "success", "message": "Light command sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync")
def get_full_state_sync(db: Session = Depends(get_db)):
    temp = get_current_temperature()
    devices = get_all_device_statuses(db)
    return {
        "temperature": temp,
        "devices": [
            {
                "device_type": d.device_type,
                "is_on": d.is_on,
                "target_temperature": d.target_temperature,
                "brightness": d.brightness,
                "last_updated": d.last_updated.isoformat() if d.last_updated else None,
            }
            for d in devices
        ],
    }


@router.post("/request-status")
def request_device_status_from_broker():
    try:
        mqtt_client.request_device_status()
        return {"status": "success", "message": "Status request sent to devices"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
