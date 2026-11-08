
from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from backend.database import Base


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(50), nullable=True)
    status = Column(String(50), default="Pending Review")
    analysis = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
