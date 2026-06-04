from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.crud.scene import (
    create_device_group,
    get_device_group,
    get_device_groups,
    update_device_group,
    delete_device_group,
)
from app.schemas.scene import DeviceGroupCreate, DeviceGroupUpdate, DeviceGroupResponse, GroupControl
from app.rules.scene_executor import execute_group_control

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("", response_model=DeviceGroupResponse)
def create_new_group(group_in: DeviceGroupCreate, db: Session = Depends(get_db)):
    return create_device_group(db, group_in)


@router.get("", response_model=List[DeviceGroupResponse])
def list_groups(db: Session = Depends(get_db)):
    return get_device_groups(db)


@router.get("/{group_id}", response_model=DeviceGroupResponse)
def get_single_group(group_id: int, db: Session = Depends(get_db)):
    group = get_device_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.put("/{group_id}", response_model=DeviceGroupResponse)
def update_existing_group(group_id: int, group_in: DeviceGroupUpdate, db: Session = Depends(get_db)):
    group = update_device_group(db, group_id, group_in)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.delete("/{group_id}")
def delete_existing_group(group_id: int, db: Session = Depends(get_db)):
    if not delete_device_group(db, group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "success", "message": "Group deleted"}


@router.post("/{group_id}/control")
def control_group_endpoint(group_id: int, control: GroupControl, db: Session = Depends(get_db)):
    group = get_device_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if control.group_id != group_id:
        raise HTTPException(status_code=400, detail="Group ID mismatch")

    return execute_group_control(
        group.device_types,
        control.is_on,
        target_temperature=control.target_temperature,
        brightness=control.brightness
    )


@router.post("/all/control")
def control_all_devices(control: GroupControl, db: Session = Depends(get_db)):
    all_device_types = ["ac", "light"]
    return execute_group_control(
        all_device_types,
        control.is_on,
        target_temperature=control.target_temperature,
        brightness=control.brightness
    )
