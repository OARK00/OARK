"""every device belongs to a product

Revision ID: c4e6a8b0d2f5
Revises: b2d4f6a8c0e3
Create Date: 2026-10-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c4e6a8b0d2f5'
down_revision: Union[str, None] = 'b2d4f6a8c0e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEST_PRODUCT_NAME = 'Test devices'
TEST_PRODUCT_DESCRIPTION = 'Devices added with Test device, for trying a board quickly. Move real units into their own product.'


def upgrade() -> None:
    # 1. A "Test devices" product for every company that has devices without
    #    a product (unless it already has one by that name, any capitals).
    op.execute(
        f"""
        INSERT INTO products (id, org_id, name, category, description, data_points)
        SELECT gen_random_uuid(), orphans.org_id, '{TEST_PRODUCT_NAME}', 'other', '{TEST_PRODUCT_DESCRIPTION}', '[]'::jsonb
        FROM (SELECT DISTINCT org_id FROM devices WHERE product_id IS NULL) AS orphans
        WHERE NOT EXISTS (
            SELECT 1 FROM products p
            WHERE p.org_id = orphans.org_id AND lower(p.name) = lower('{TEST_PRODUCT_NAME}')
        )
        """
    )
    # 2. Those devices move into it.
    op.execute(
        f"""
        UPDATE devices d SET product_id = p.id
        FROM products p
        WHERE d.product_id IS NULL AND p.org_id = d.org_id AND lower(p.name) = lower('{TEST_PRODUCT_NAME}')
        """
    )
    # 3. From now on the database itself refuses a device without a product,
    #    and a product cannot be deleted while it has devices.
    op.alter_column('devices', 'product_id', nullable=False)
    op.drop_constraint('fk_devices_product_id_products', 'devices', type_='foreignkey')
    op.create_foreign_key(
        'fk_devices_product_id_products', 'devices', 'products', ['product_id'], ['id'], ondelete='RESTRICT'
    )


def downgrade() -> None:
    op.drop_constraint('fk_devices_product_id_products', 'devices', type_='foreignkey')
    op.create_foreign_key(
        'fk_devices_product_id_products', 'devices', 'products', ['product_id'], ['id'], ondelete='SET NULL'
    )
    op.alter_column('devices', 'product_id', nullable=True)
