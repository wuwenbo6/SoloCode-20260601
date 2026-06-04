from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.crud.scene import (
    create_scene,
    get_scene,
    get_scenes,
    get_scene_by_name,
    update_scene,
    delete_scene,
    update_scene_last_executed,
)
from app.schemas.scene import SceneCreate, SceneUpdate, SceneResponse
from app.rules.scene_executor import execute_scene

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


@router.post("", response_model=SceneResponse)
def create_new_scene(scene_in: SceneCreate, db: Session = Depends(get_db)):
    existing = get_scene_by_name(db, scene_in.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Scene with name '{scene_in.name}' already exists")
    return create_scene(db, scene_in)


@router.get("", response_model=List[SceneResponse])
def list_scenes(enabled_only: bool = False, db: Session = Depends(get_db)):
    return get_scenes(db, enabled_only=enabled_only)


@router.get("/{scene_id}", response_model=SceneResponse)
def get_single_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.put("/{scene_id}", response_model=SceneResponse)
def update_existing_scene(scene_id: int, scene_in: SceneUpdate, db: Session = Depends(get_db)):
    scene = update_scene(db, scene_id, scene_in)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.delete("/{scene_id}")
def delete_existing_scene(scene_id: int, db: Session = Depends(get_db)):
    if not delete_scene(db, scene_id):
        raise HTTPException(status_code=404, detail="Scene not found")
    return {"status": "success", "message": "Scene deleted"}


@router.post("/{scene_id}/execute")
def execute_scene_by_id(scene_id: int, db: Session = Depends(get_db)):
    scene = get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    result = execute_scene(scene)
    if result.get("success"):
        update_scene_last_executed(db, scene_id)

    return result


@router.post("/execute-by-name")
def execute_scene_by_name_endpoint(name: str, db: Session = Depends(get_db)):
    scene = get_scene_by_name(db, name)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{name}' not found")

    result = execute_scene(scene)
    if result.get("success"):
        update_scene_last_executed(db, scene.id)

    return result
