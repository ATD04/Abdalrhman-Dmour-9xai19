"""
Workflow Service — Authentication APIs
"""
from fastapi import APIRouter, HTTPException, Depends
from passlib.context import CryptContext
from models.schemas import UserRegisterRequest, LoginRequest, UserResponse
from storage.database import Database

router = APIRouter(prefix="/auth", tags=["auth"])
db = Database()

# Password hashing context — switching to argon2 for security & byte-limit resilience
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

@router.post("/register", response_model=UserResponse)
async def register_user(req: UserRegisterRequest):
    try:
        # Check if user already exists
        existing = db.get_user_by_email(req.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Hash the password
        hashed = get_password_hash(req.password)
        
        # Save to database
        user = db.create_user(
            email=req.email,
            password_hash=hashed,
            full_name=req.full_name,
            role=req.role
        )
        
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user (DB returned None)")
            
        # Convert UUID to string for the response
        res = dict(user)
        res["user_id"] = str(res["user_id"])
        res["created_at"] = res["created_at"].isoformat() if hasattr(res["created_at"], "isoformat") else str(res["created_at"])
        
        return UserResponse(**res)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"CRITICAL AUTH ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=UserResponse)
async def login(req: LoginRequest):
    user = db.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Basic session indicator (in a real app, you'd return a JWT here)
    user["user_id"] = str(user["user_id"])
    user["created_at"] = user["created_at"].isoformat() if hasattr(user["created_at"], "isoformat") else str(user["created_at"])

    return UserResponse(**user)
