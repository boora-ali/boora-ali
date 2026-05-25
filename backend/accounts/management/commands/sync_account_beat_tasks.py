from __future__ import annotations

from django.core.management.base import BaseCommand

from core.beat import sync_all_beat_tasks


class Command(BaseCommand):
    help = "Compatibilidade: sincroniza os periodic tasks do projeto."

    def handle(self, *args, **options):
        tasks = sync_all_beat_tasks()
        self.stdout.write(
            self.style.SUCCESS(
                f"{len(tasks)} periodic task(s) sincronizada(s) com sucesso."
            )
        )
