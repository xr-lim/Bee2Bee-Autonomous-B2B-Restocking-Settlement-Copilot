from app.db.base import Base
from app.db.session import engine
from app.models.product import Product
from app.models.message import Message

def init_db():
    Base.metadata.create_all(bind=engine)