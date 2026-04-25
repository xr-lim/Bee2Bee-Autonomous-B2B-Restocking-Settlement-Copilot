from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

connect_args = {}
database_url = (DATABASE_URL or "").lower()
if database_url.startswith("postgres"):
    # Keep long-running AI tool transactions from being killed too early.
    connect_args = {"options": "-c statement_timeout=60000"}

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
