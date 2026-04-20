from fastapi import APIRouter
from app.api.v1.routes_products import router as product_router

api_router = APIRouter()

api_router.include_router(product_router)
@api_router.get("/health")
def health_check():
    return {"status": "ok"}