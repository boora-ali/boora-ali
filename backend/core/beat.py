from __future__ import annotations


def sync_all_beat_tasks(apps=None):
    from accounts.beat import (
        ensure_account_purge_schedule,
        ensure_token_cleanup_schedule,
    )
    from places.beat import ensure_media_compression_schedule

    synced = [
        ensure_media_compression_schedule(apps),
        ensure_token_cleanup_schedule(apps),
        ensure_account_purge_schedule(apps),
    ]
    return synced
