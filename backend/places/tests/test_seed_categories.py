import pytest
from django.core.management import call_command

from places.models import Category

pytestmark = pytest.mark.django_db


def test_seed_categories_creates_the_default_list_once():
    call_command("seed_categories")
    call_command("seed_categories")

    assert Category.objects.count() == 21
    assert set(Category.objects.values_list("name", flat=True)) == {
        "Biblioteca",
        "Cachoeira",
        "Cafeteria",
        "Corredeira",
        "Educação",
        "Evento de tecnologia",
        "Evento gastronômico",
        "Evento geek",
        "Galeria",
        "Lanchonete",
        "Livraria",
        "Montanha",
        "Museu",
        "Outro",
        "Parque",
        "Praça",
        "Praia",
        "Restaurante",
        "Shopping",
        "Teatro",
        "Trilha",
    }
