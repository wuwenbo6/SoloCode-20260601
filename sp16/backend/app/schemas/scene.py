from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class SceneActionBase(BaseModel):
    device_type: str = Field(..., pattern="^(ac|light)$")
    action_type: str = Field(..., pattern="^(ac_on|ac_off|ac_set_temp|light_on|light_off|light_set_brightness)$")
    action_value: Optional[float] = None


class SceneActionCreate(SceneActionBase):
    pass


class SceneActionUpdate(BaseModel):
    device_type: Optional[str] = Field(None, pattern="^(ac|light)$")
    action_type: Optional[str] = Field(None, pattern="^(ac_on|ac_off|ac_set_temp|light_on|light_off|light_set_brightness)$")
    action_value: Optional[float] = None


class SceneActionResponse(SceneActionBase):
    id: int
    scene_id: int

    class Config:
        from_attributes = True


class SceneBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: str = Field("HomeFilled", max_length=50)
    color: str = Field("#409EFF", max_length=20)
    enabled: bool = True


class SceneCreate(SceneBase):
    actions: List[SceneActionCreate] = Field(default_factory=list)


class SceneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    enabled: Optional[bool] = None
    actions: Optional[List[SceneActionCreate]] = None


class SceneResponse(SceneBase):
    id: int
    created_at: datetime
    actions: List[SceneActionResponse] = Field(default_factory=list)
    last_executed: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeviceGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    device_types: List[str] = Field(..., description="List of device types in this group, e.g. ['ac', 'light']")


class DeviceGroupCreate(DeviceGroupBase):
    pass


class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    device_types: Optional[List[str]] = None


class DeviceGroupResponse(DeviceGroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class GroupControl(BaseModel):
    group_id: int
    is_on: bool
    target_temperature: Optional[float] = Field(None, ge=16, le=30)
    brightness: Optional[int] = Field(None, ge=0, le=100)


class VoiceCommandRequest(BaseModel):
    text: str = Field(..., min_length=1)


class VoiceCommandResponse(BaseModel):
    success: bool
    message: str
    parsed_commands: List[dict] = Field(default_factory=list)
    executed: bool = False
