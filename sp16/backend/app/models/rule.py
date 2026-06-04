from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from datetime import datetime, timedelta

from app.core.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    enabled = Column(Boolean, default=True)
    cooling_minutes = Column(Integer, default=5, nullable=False)

    condition_type = Column(String(50), nullable=False)
    condition_operator = Column(String(10), nullable=True)
    condition_value = Column(Float, nullable=True)
    time_start = Column(String(20), nullable=True)
    time_end = Column(String(20), nullable=True)

    action_type = Column(String(50), nullable=False)
    action_value = Column(Float, nullable=True)

    last_triggered = Column(DateTime, nullable=True)
    last_action_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def is_in_cooling(self) -> bool:
        if not self.last_triggered:
            return False
        cooldown_until = self.last_triggered + timedelta(minutes=self.cooling_minutes)
        return datetime.utcnow() < cooldown_until
