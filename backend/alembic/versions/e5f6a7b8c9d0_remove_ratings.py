"""remove ratings (likes replace them)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-05 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ratings are dropped entirely — likes serve as the popularity signal.
    op.drop_index(op.f('ix_asset_ratings_user_id'), table_name='asset_ratings')
    op.drop_index(op.f('ix_asset_ratings_asset_id'), table_name='asset_ratings')
    op.drop_table('asset_ratings')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        'asset_ratings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            server_default=sa.text('now()'), nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            server_default=sa.text('now()'), nullable=False,
        ),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_id', 'user_id', name='uq_asset_rating'),
    )
    op.create_index(op.f('ix_asset_ratings_asset_id'), 'asset_ratings', ['asset_id'], unique=False)
    op.create_index(op.f('ix_asset_ratings_user_id'), 'asset_ratings', ['user_id'], unique=False)
