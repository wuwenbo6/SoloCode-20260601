from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from datetime import datetime

from app.core.database import Base


class TemperatureHistory(Base):
    __tablename__ = "temperature_history"

    id = Column(Integer, primary_key=True, index=True)
    temperature = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class DeviceStatus(Base):
    __tablename__ = "device_status"

    id = Column(Integer, primary_key=True, index=True)
    device_type = Column(String(50), nullable=False, unique=True)
    is_on = Column(Boolean, default=False)
    target_temperature = Column(Float, nullable=True)
    brightness = Column(Integer, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
