from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    device_types = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    scene_actions = relationship("SceneAction", back_populates="group")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    icon = Column(String(50), default="HomeFilled")
    color = Column(String(20), default="#409EFF")
    enabled = Column(Boolean, default=True)
    last_executed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    actions = relationship("SceneAction", back_populates="scene", cascade="all, delete-orphan")


class SceneAction(Base):
    __tablename__ = "scene_actions"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True)

    device_type = Column(String(50), nullable=False)
    action_type = Column(String(50), nullable=False)
    action_value = Column(Float, nullable=True)

    scene = relationship("Scene", back_populates="actions")
    group = relationship("DeviceGroup", back_populates="scene_actions")
