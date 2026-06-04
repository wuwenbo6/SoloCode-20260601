from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class RuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    enabled: bool = True
    cooling_minutes: int = Field(5, ge=0, le=60)

    condition_type: str = Field(..., pattern="^(temperature|time)$")
    condition_operator: Optional[str] = Field(None, pattern="^(>|>=|<|<=|==|!=)$")
    condition_value: Optional[float] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None

    action_type: str = Field(..., pattern="^(ac_on|ac_off|ac_set_temp|light_on|light_off|light_set_brightness)$")
    action_value: Optional[float] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    enabled: Optional[bool] = None
    cooling_minutes: Optional[int] = Field(None, ge=0, le=60)

    condition_type: Optional[str] = Field(None, pattern="^(temperature|time)$")
    condition_operator: Optional[str] = Field(None, pattern="^(>|>=|<|<=|==|!=)$")
    condition_value: Optional[float] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None

    action_type: Optional[str] = Field(None, pattern="^(ac_on|ac_off|ac_set_temp|light_on|light_off|light_set_brightness)$")
    action_value: Optional[float] = None


class RuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    enabled: bool
    cooling_minutes: int

    condition_type: str
    condition_operator: Optional[str]
    condition_value: Optional[float]
    time_start: Optional[str]
    time_end: Optional[str]

    action_type: str
    action_value: Optional[float]

    last_triggered: Optional[datetime]
    last_action_hash: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
