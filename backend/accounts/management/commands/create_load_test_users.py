import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

logging.disable(logging.DEBUG)


class Command(BaseCommand):
    help = "Create N load test users (load_user_000 … load_user_N-1) with password LoadTest@123"

    def add_arguments(self, parser):
        parser.add_argument("count", type=int, nargs="?", default=200)

    def handle(self, *args, **options):
        User = get_user_model()
        count = options["count"]
        created = 0
        for i in range(count):
            username = f"load_user_{i:03d}"
            if not User.objects.filter(username=username).exists():
                User.objects.create_user(
                    username=username,
                    email=f"{username}@loadtest.com",
                    password="LoadTest@123",  # nosec B106 — senha fixa intencional para dados de carga
                )
                created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {created} created, {count - created} already existed."
            )
        )
