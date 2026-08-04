from django.core.management.base import BaseCommand

from places.models import Category

CATEGORY_NAMES = (
    "Cafeteria",
    "Restaurante",
    "Lanchonete",
    "Livraria",
    "Shopping",
    "Parque",
    "Museu",
    "Evento de tecnologia",
    "Educação",
    "Evento gastronômico",
    "Evento geek",
    "Galeria",
    "Praça",
    "Praia",
    "Cachoeira",
    "Corredeira",
    "Montanha",
    "Trilha",
    "Teatro",
    "Biblioteca",
    "Outro",
)


class Command(BaseCommand):
    help = "Cria as categorias padrão de lugares sem duplicar as existentes."

    def handle(self, *args, **options):
        created = 0
        for name in CATEGORY_NAMES:
            _, was_created = Category.objects.get_or_create(name=name)
            created += was_created

        self.stdout.write(self.style.SUCCESS(f"{created} categorias criadas."))
