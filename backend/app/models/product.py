from sqlalchemy import Column, String, Integer
from app.db.base import Base
import uuid

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    current_stock = Column(Integer, nullable=False)
    reorder_point = Column(Integer, nullable=False)