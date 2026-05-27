from fastapi import APIRouter

from app.api.v1.endpoints import auth, resumes, applications, ai, profile, autofill, observations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(autofill.router, prefix="/autofill", tags=["autofill"])
api_router.include_router(observations.router, prefix="/observations", tags=["observations"])
