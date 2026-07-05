"""asset is_public

Revision ID: a1b2c3d4e5f6
Revises: ff5779a44f45
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ff5779a44f45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'assets',
        sa.Column(
            'is_public', sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.create_index(op.f('ix_assets_is_public'), 'assets', ['is_public'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_assets_is_public'), table_name='assets')
    op.drop_column('assets', 'is_public')
