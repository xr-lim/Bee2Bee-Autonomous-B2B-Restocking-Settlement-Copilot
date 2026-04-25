from fastapi import APIRouter
from app.api.v1.routes_ai import router as ai_router
from app.api.v1.routes_products import router as product_router
from app.api.v1.routes_negotiation import router as negotiation_router

api_router = APIRouter()

api_router.include_router(product_router)
api_router.include_router(ai_router)
api_router.include_router(negotiation_router)
@api_router.get("/health")
def health_check():
    return {"status": "ok"}
