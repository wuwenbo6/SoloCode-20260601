from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.models.scene import Scene, SceneAction, DeviceGroup
from app.schemas.scene import SceneCreate, SceneUpdate, DeviceGroupCreate, DeviceGroupUpdate


def create_scene(db: Session, scene_in: SceneCreate) -> Scene:
    db_scene = Scene(
        name=scene_in.name,
        description=scene_in.description,
        icon=scene_in.icon,
        color=scene_in.color,
        enabled=scene_in.enabled,
    )
    for action_in in scene_in.actions:
        db_action = SceneAction(
            device_type=action_in.device_type,
            action_type=action_in.action_type,
            action_value=action_in.action_value,
        )
        db_scene.actions.append(db_action)

    db.add(db_scene)
    db.commit()
    db.refresh(db_scene)
    return db_scene


def get_scene(db: Session, scene_id: int) -> Optional[Scene]:
    return db.query(Scene).filter(Scene.id == scene_id).first()


def get_scene_by_name(db: Session, name: str) -> Optional[Scene]:
    return db.query(Scene).filter(Scene.name == name).first()


def get_scenes(db: Session, enabled_only: bool = False) -> List[Scene]:
    query = db.query(Scene)
    if enabled_only:
        query = query.filter(Scene.enabled == True)
    return query.all()


def update_scene(db: Session, scene_id: int, scene_in: SceneUpdate) -> Optional[Scene]:
    db_scene = get_scene(db, scene_id)
    if not db_scene:
        return None

    update_data = scene_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == 'actions' and value is not None:
            db_scene.actions.clear()
            for action_in in value:
                db_action = SceneAction(
                    device_type=action_in.device_type,
                    action_type=action_in.action_type,
                    action_value=action_in.action_value,
                )
                db_scene.actions.append(db_action)
        elif field != 'actions':
            setattr(db_scene, field, value)

    db.commit()
    db.refresh(db_scene)
    return db_scene


def delete_scene(db: Session, scene_id: int) -> bool:
    db_scene = get_scene(db, scene_id)
    if db_scene:
        db.delete(db_scene)
        db.commit()
        return True
    return False


def update_scene_last_executed(db: Session, scene_id: int) -> None:
    db_scene = get_scene(db, scene_id)
    if db_scene:
        db_scene.last_executed = datetime.utcnow()
        db.commit()


def create_device_group(db: Session, group_in: DeviceGroupCreate) -> DeviceGroup:
    db_group = DeviceGroup(
        name=group_in.name,
        description=group_in.description,
        device_types=group_in.device_types,
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_device_group(db: Session, group_id: int) -> Optional[DeviceGroup]:
    return db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()


def get_device_groups(db: Session) -> List[DeviceGroup]:
    return db.query(DeviceGroup).all()


def update_device_group(db: Session, group_id: int, group_in: DeviceGroupUpdate) -> Optional[DeviceGroup]:
    db_group = get_device_group(db, group_id)
    if not db_group:
        return None

    update_data = group_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_group, field, value)

    db.commit()
    db.refresh(db_group)
    return db_group


def delete_device_group(db: Session, group_id: int) -> bool:
    db_group = get_device_group(db, group_id)
    if db_group:
        db.delete(db_group)
        db.commit()
        return True
    return False
