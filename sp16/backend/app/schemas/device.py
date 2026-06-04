from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class TemperatureReading(BaseModel):
    temperature: float = Field(..., ge=-20, le=80)
    timestamp: Optional[datetime] = None


class TemperatureHistoryResponse(BaseModel):
    id: int
    temperature: float
    timestamp: datetime

    class Config:
        from_attributes = True


class ACControl(BaseModel):
    is_on: bool
    target_temperature: Optional[float] = Field(None, ge=16, le=30)


class LightControl(BaseModel):
    is_on: bool
    brightness: Optional[int] = Field(None, ge=0, le=100)


class DeviceStatusResponse(BaseModel):
    id: int
    device_type: str
    is_on: bool
    target_temperature: Optional[float] = None
    brightness: Optional[int] = None
    last_updated: datetime

    class Config:
        from_attributes = True
