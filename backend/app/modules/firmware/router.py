"""A product's saved firmware code.

Oark generates starter code from a product's data points. This keeps the
version someone edited, so it is still there the next time the page opens.
Nothing here compiles or runs the code: it is stored and returned as text.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sketch import ProductSketch
from app.models.user import User
from app.modules.firmware.schemas import SketchResponse, SketchUpdate
from app.modules.products.router import get_org_product

router = APIRouter(prefix="/products/{product_id}/sketch", tags=["firmware"])


@router.get("", response_model=SketchResponse)
def get_sketch(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = get_org_product(db, product_id, current_user)
    sketch = db.get(ProductSketch, product.id)
    if sketch is None:
        return SketchResponse(code=None, updated_at=None)
    return SketchResponse(code=sketch.code, updated_at=sketch.updated_at)


@router.put("", response_model=SketchResponse)
def save_sketch(
    product_id: uuid.UUID,
    payload: SketchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_org_product(db, product_id, current_user)
    sketch = db.get(ProductSketch, product.id)
    if sketch is None:
        sketch = ProductSketch(product_id=product.id, org_id=product.org_id, code=payload.code)
        db.add(sketch)
    else:
        sketch.code = payload.code
    db.commit()
    db.refresh(sketch)
    return SketchResponse(code=sketch.code, updated_at=sketch.updated_at)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def reset_sketch(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Back to the generated code."""
    product = get_org_product(db, product_id, current_user)
    sketch = db.get(ProductSketch, product.id)
    if sketch is not None:
        db.delete(sketch)
        db.commit()
