from __future__ import annotations

from django.core.management.base import BaseCommand

from core.beat import sync_all_beat_tasks


class Command(BaseCommand):
    help = "Cria ou atualiza todos os periodic tasks do projeto."

    def handle(self, *args, **options):
        tasks = sync_all_beat_tasks()
        for task, created in tasks:
            action = "criado" if created else "atualizado"
            self.stdout.write(
                self.style.SUCCESS(f"Periodic task '{task.name}' {action} com sucesso.")
            )
