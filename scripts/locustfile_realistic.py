"""
Cenário realista — diário pessoal de lugares.

Perfil de uso real:
  - Usuário abre o app no celular, navega pelo histórico, fecha.
  - 90%+ leitura: lista, filtra, abre detalhe, vê visitas.
  - Escrita ocasional: novo lugar, nova visita, foto.
  - Sessões curtas (2–4 ações) com pausas longas entre elas.

Pré-requisito:
    docker exec -it bora-ali-backend-1 python manage.py create_load_test_users 100

Run:
    locust -f locustfile_realistic.py --host=http://localhost \
      --users 100 --spawn-rate 5 --run-time 15m --headless \
      --csv=load-tests/results/realistic-100
"""

import io
import itertools
import random
import threading

from locust import HttpUser, between, task
from locust.exception import StopUser
from PIL import Image


CATEGORIES = ["Café", "Restaurante", "Bar", "Padaria", "Sorveteria"]
STATUSES = ["want_to_visit", "visited", "favorite", "would_not_return"]
ITEM_TYPES = ["sweet", "savory", "drink", "coffee", "juice", "dessert", "other"]

_POOL_SIZE = 300
_counter_lock = threading.Lock()
_user_counter = itertools.count()


def _make_jpeg() -> bytes:
    img = Image.new("RGB", (1280, 960), color=(
        random.randint(80, 200),
        random.randint(80, 200),
        random.randint(80, 200),
    ))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()


class RealisticUser(HttpUser):
    """
    Usuário real de diário pessoal.

    Comportamento:
      - Na abertura do app: sempre lista os lugares (âncora da sessão).
      - Navegação: filtra por status, abre detalhe, vê visitas.
      - Criação esporádica de lugar novo ou visita.
      - Upload de foto é raro (saiu do restaurante e quis registrar).
      - wait_time longo simula leitura/digitação no celular.
    """

    # Pausa entre ações: 4–20s (leitura no celular, digitação, distração)
    wait_time = between(4, 20)

    def on_start(self):
        self._token = None
        self._refresh_token = None
        self._place_ids: list[str] = []
        self._visit_ids: list[str] = []

        with _counter_lock:
            idx = next(_user_counter) % _POOL_SIZE
        self.username = f"load_user_{idx:03d}"
        self.password = "LoadTest@123"

        self._login()
        if not self._token:
            raise StopUser()

        # Carrega lugares existentes do usuário (simula app abrindo com dados salvos)
        self._sync_places()

        # Se usuário novo sem dados, cria um lugar inicial
        if not self._place_ids:
            self._criar_place()

    def on_stop(self):
        pass

    # ------------------------------------------------------------------ #
    # LEITURA — ~88%                                                       #
    # ------------------------------------------------------------------ #

    @task(30)
    def abrir_lista_places(self):
        """Âncora da sessão: toda vez que o usuário abre o app."""
        resp = self._get("/api/places/")
        if resp and resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            # Atualiza cache local de IDs (simula estado do app)
            ids = [p["public_id"] for p in results if "public_id" in p]
            if ids:
                self._place_ids = list(set(self._place_ids + ids))

    @task(15)
    def filtrar_por_status(self):
        """Usuário toca num filtro de status."""
        status = random.choice(STATUSES)
        self._get(f"/api/places/?status={status}")

    @task(20)
    def ver_detalhe_place(self):
        """Usuário abre um lugar para ver detalhes."""
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        self._get(f"/api/places/{place_id}/")

    @task(18)
    def ver_visitas_do_place(self):
        """Usuário rola para ver o histórico de visitas de um lugar."""
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        resp = self._get(f"/api/places/{place_id}/visits/")
        if resp and resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            ids = [v["public_id"] for v in results if "public_id" in v]
            if ids:
                self._visit_ids = list(set(self._visit_ids + ids))

    @task(5)
    def ver_perfil(self):
        """Usuário abre a tela de conta."""
        self._get("/api/auth/me/")

    # ------------------------------------------------------------------ #
    # ESCRITA — ~9%                                                        #
    # ------------------------------------------------------------------ #

    @task(5)
    def registrar_visita(self):
        """Usuário acabou de sair de um lugar e registra a visita."""
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        resp = self._post(
            f"/api/places/{place_id}/visits/",
            json={
                "visited_at": "2024-06-15T14:00:00Z",
                "environment_rating": round(random.uniform(5, 10), 1),
                "service_rating": round(random.uniform(5, 10), 1),
                "overall_rating": round(random.uniform(5, 10), 1),
                "would_return": random.choice([True, False]),
                "general_notes": random.choice([
                    "Ótimo ambiente, voltaria.",
                    "Serviço um pouco lento.",
                    "Vale cada centavo.",
                    "",
                ]),
            },
        )
        if resp and resp.status_code == 201:
            visit_id = resp.json()["public_id"]
            self._visit_ids.append(visit_id)
            # 40% de chance de registrar um item consumido junto
            if random.random() < 0.40:
                self._post(
                    f"/api/visits/{visit_id}/items/",
                    json={
                        "name": random.choice(["Cappuccino", "Croissant", "Suco de laranja", "Prato do dia", "Brownie"]),
                        "type": random.choice(ITEM_TYPES),
                        "rating": round(random.uniform(6, 10), 1),
                        "price": round(random.uniform(8, 60), 2),
                        "would_order_again": random.choice([True, False]),
                        "notes": "",
                    },
                )

    @task(3)
    def adicionar_novo_lugar(self):
        """Usuário descobriu um lugar novo e quer salvar."""
        self._criar_place()

    # ------------------------------------------------------------------ #
    # UPLOAD — ~3%                                                         #
    # ------------------------------------------------------------------ #

    @task(3)
    def tirar_foto_do_lugar(self):
        """Usuário fotografou o lugar e quer salvar no app."""
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        jpeg_bytes = _make_jpeg()
        resp = self.client.patch(
            f"/api/places/{place_id}/",
            files={"cover_photo": ("photo.jpg", jpeg_bytes, "image/jpeg")},
            headers=self._headers(),
        )
        if resp.status_code == 401:
            if self._do_refresh():
                self.client.patch(
                    f"/api/places/{place_id}/",
                    files={"cover_photo": ("photo.jpg", jpeg_bytes, "image/jpeg")},
                    headers=self._headers(),
                )

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _sync_places(self):
        """Busca a primeira página de lugares do usuário para popular o cache local."""
        resp = self.client.get("/api/places/", headers=self._headers())
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            self._place_ids = [p["public_id"] for p in results if "public_id" in p]

    def _login(self):
        resp = self.client.post(
            "/api/auth/login/",
            json={"username": self.username, "password": self.password},
        )
        if resp.status_code == 200:
            data = resp.json()
            self._token = data["access"]
            self._refresh_token = data["refresh"]

    def _do_refresh(self) -> bool:
        if not self._refresh_token:
            return False
        resp = self.client.post(
            "/api/auth/refresh/",
            json={"refresh": self._refresh_token},
            name="/api/auth/refresh/",
        )
        if resp.status_code == 200:
            data = resp.json()
            self._token = data["access"]
            if "refresh" in data:
                self._refresh_token = data["refresh"]
            return True
        self._login()
        return self._token is not None

    def _headers(self):
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    def _get(self, url):
        resp = self.client.get(url, headers=self._headers())
        if resp.status_code == 401:
            if self._do_refresh():
                resp = self.client.get(url, headers=self._headers())
        return resp

    def _post(self, url, json):
        resp = self.client.post(url, json=json, headers=self._headers())
        if resp.status_code == 401:
            if self._do_refresh():
                resp = self.client.post(url, json=json, headers=self._headers())
        return resp

    def _criar_place(self):
        resp = self._post(
            "/api/places/",
            json={
                "name": random.choice([
                    "Café Central", "Bistrô do Parque", "Padaria Nova", "Bar do João",
                    "Sorveteria Gelada", "Restaurante Caseiro", "Cafeteria Moderna",
                ]) + f" {random.randint(1, 999)}",
                "category": random.choice(CATEGORIES),
                "address": random.choice([
                    "Av. Paulista, 1000", "Rua Oscar Freire, 500",
                    "Al. Santos, 200", "Rua Augusta, 300",
                ]),
                "status": random.choice(STATUSES),
                "notes": "",
            },
        )
        if resp and resp.status_code == 201:
            self._place_ids.append(resp.json()["public_id"])
