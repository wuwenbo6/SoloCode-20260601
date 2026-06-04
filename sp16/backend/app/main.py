from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
import time

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.crud.device import init_device_statuses
from app.crud.scene import create_scene, get_scene_by_name
from app.mqtt.subscriber import init_subscriber
from app.rules.engine import evaluate_and_execute_rules
from app.routers import devices, rules, scenes, groups, voice
from app.schemas.scene import SceneCreate, SceneActionCreate
from app.websocket.manager import manager

Base.metadata.create_all(bind=engine)

time.sleep(5)
db = SessionLocal()
try:
    init_device_statuses(db)

    default_scenes = [
        SceneCreate(
            name="离家模式",
            description="关闭所有设备，节约能源",
            icon="Switch",
            color="#F56C6C",
            actions=[
                SceneActionCreate(device_type="ac", action_type="ac_off"),
                SceneActionCreate(device_type="light", action_type="light_off"),
            ]
        ),
        SceneCreate(
            name="回家模式",
            description="开启空调和灯光，欢迎回家",
            icon="HomeFilled",
            color="#67C23A",
            actions=[
                SceneActionCreate(device_type="ac", action_type="ac_set_temp", action_value=24),
                SceneActionCreate(device_type="light", action_type="light_set_brightness", action_value=75),
            ]
        ),
        SceneCreate(
            name="睡眠模式",
            description="关闭灯光，调高空调温度",
            icon="Moon",
            color="#909399",
            actions=[
                SceneActionCreate(device_type="ac", action_type="ac_set_temp", action_value=26),
                SceneActionCreate(device_type="light", action_type="light_off"),
            ]
        ),
        SceneCreate(
            name="观影模式",
            description="调暗灯光，开启空调",
            icon="VideoCamera",
            color="#9B59B6",
            actions=[
                SceneActionCreate(device_type="ac", action_type="ac_set_temp", action_value=25),
                SceneActionCreate(device_type="light", action_type="light_set_brightness", action_value=20),
            ]
        ),
        SceneCreate(
            name="阅读模式",
            description="调亮灯光，适宜温度",
            icon="Reading",
            color="#E6A23C",
            actions=[
                SceneActionCreate(device_type="ac", action_type="ac_set_temp", action_value=24),
                SceneActionCreate(device_type="light", action_type="light_set_brightness", action_value=85),
            ]
        ),
    ]

    for scene_data in default_scenes:
        if not get_scene_by_name(db, scene_data.name):
            create_scene(db, scene_data)
            print(f"Created default scene: {scene_data.name}")
finally:
    db.close()

init_subscriber()

scheduler = BackgroundScheduler()
scheduler.add_job(evaluate_and_execute_rules, "interval", minutes=1)
scheduler.start()

app = FastAPI(title="IoT Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(rules.router)
app.include_router(scenes.router)
app.include_router(groups.router)
app.include_router(voice.router)


@app.get("/")
def root():
    return {"status": "running", "service": "IoT Dashboard API"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await manager.send_current_state(websocket)
        while True:
            data = await websocket.receive_text()
            print(f"Received WS: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()
