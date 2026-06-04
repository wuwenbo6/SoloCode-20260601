from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import List, Optional

from app.models.device import TemperatureHistory, DeviceStatus
from app.schemas.device import TemperatureReading


def create_temperature_history(db: Session, reading: TemperatureReading) -> TemperatureHistory:
    db_record = TemperatureHistory(
        temperature=reading.temperature,
        timestamp=reading.timestamp or datetime.utcnow()
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_temperature_history(db: Session, hours: int = 24, limit: int = 1000) -> List[TemperatureHistory]:
    since = datetime.utcnow() - timedelta(hours=hours)
    return (
        db.query(TemperatureHistory)
        .filter(TemperatureHistory.timestamp >= since)
        .order_by(TemperatureHistory.timestamp)
        .limit(limit)
        .all()
    )


def get_latest_temperature(db: Session) -> Optional[TemperatureHistory]:
    return (
        db.query(TemperatureHistory)
        .order_by(desc(TemperatureHistory.timestamp))
        .first()
    )


def get_device_status(db: Session, device_type: str) -> Optional[DeviceStatus]:
    return db.query(DeviceStatus).filter(DeviceStatus.device_type == device_type).first()


def get_all_device_statuses(db: Session) -> List[DeviceStatus]:
    return db.query(DeviceStatus).all()


def update_or_create_device_status(
    db: Session,
    device_type: str,
    is_on: bool,
    target_temperature: Optional[float] = None,
    brightness: Optional[int] = None
) -> DeviceStatus:
    device = get_device_status(db, device_type)
    if device:
        device.is_on = is_on
        if target_temperature is not None:
            device.target_temperature = target_temperature
        if brightness is not None:
            device.brightness = brightness
        device.last_updated = datetime.utcnow()
    else:
        device = DeviceStatus(
            device_type=device_type,
            is_on=is_on,
            target_temperature=target_temperature,
            brightness=brightness
        )
        db.add(device)
    db.commit()
    db.refresh(device)
    return device


def init_device_statuses(db: Session) -> None:
    for device_type in ["ac", "light"]:
        if not get_device_status(db, device_type):
            if device_type == "ac":
                update_or_create_device_status(db, device_type, False, target_temperature=24.0)
            else:
                update_or_create_device_status(db, device_type, False, brightness=50)
