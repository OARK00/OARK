"""The "Test devices" product.

Every device belongs to a product: a product is the kind of thing, a device is
one real unit of it. To try a board quickly without designing a product
first, Add device offers "Test device", which puts the device into this
product, created for each company the first time it is needed.
"""
import uuid

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product import Product

TEST_PRODUCT_NAME = "Test devices"
TEST_PRODUCT_DESCRIPTION = "Devices added with Test device, for trying a board quickly. Move real units into their own product."


def get_or_create_test_product(db: Session, org_id: uuid.UUID) -> Product:
    def existing() -> Product | None:
        # Capitals ignored, like every product name: a company that already
        # named a product "test devices" gets that one.
        return (
            db.query(Product)
            .filter(Product.org_id == org_id, func.lower(Product.name) == TEST_PRODUCT_NAME.lower())
            .first()
        )

    found = existing()
    if found:
        return found

    product = Product(org_id=org_id, name=TEST_PRODUCT_NAME, category="other", description=TEST_PRODUCT_DESCRIPTION)
    # Inside a savepoint: if another request made it at the same moment, the
    # unique name index refuses this one without undoing the caller's work.
    try:
        with db.begin_nested():
            db.add(product)
            db.flush()
    except IntegrityError:
        found = existing()
        if found is None:
            raise
        return found
    return product
