"""
Fase 1 — Descoberta de Limite.

Pré-requisito:
    docker exec -it bora-ali-backend-1 python manage.py create_load_test_users 200

Run:
    locust -f locustfile.py --host=http://localhost
    # Open http://localhost:8089
"""

import io
import itertools
import random

from locust import HttpUser, LoadTestShape, between, task
from PIL import Image


CATEGORIES = ["Café", "Restaurante", "Bar", "Padaria", "Sorveteria"]
STATUSES = ["want_to_visit", "visited", "favorite", "would_not_return"]
ITEM_TYPES = ["sweet", "savory", "drink", "coffee", "juice", "dessert", "other"]

_POOL_SIZE = 200
_user_counter = itertools.count()  # each VU gets a unique slot, no session conflicts


def _make_jpeg(width: int = 800, height: int = 600) -> bytes:
    img = Image.new("RGB", (width, height), color=(
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(0, 255),
    ))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


class StepLoadShape(LoadTestShape):
    step_users = 10
    step_duration = 10
    max_users = 200
    max_duration = 30 * 60

    _error_above_since: float | None = None
    _error_threshold = 0.05
    _error_sustained = 60

    def tick(self):
        run_time = self.get_run_time()
        if run_time > self.max_duration:
            return None

        stats = self.runner.stats.total
        total = stats.num_requests
        failures = stats.num_failures
        error_rate = failures / total if total > 0 else 0.0

        if error_rate > self._error_threshold:
            if self._error_above_since is None:
                self._error_above_since = run_time
            elif run_time - self._error_above_since >= self._error_sustained:
                return None
        else:
            self._error_above_since = None

        step = int(run_time / self.step_duration)
        users = min(1 + step * self.step_users, self.max_users)
        return users, self.step_users


class BoraAliUser(HttpUser):
    wait_time = between(1, 4)

    def on_start(self):
        self._token = None
        self._refresh_token = None
        self._place_ids: list[str] = []
        self._visit_ids: list[str] = []

        idx = next(_user_counter) % _POOL_SIZE
        self.username = f"load_user_{idx:03d}"
        self.password = "LoadTest@123"

        self._login()

        for _ in range(3):
            self._criar_place()

    def on_stop(self):
        for place_id in list(self._place_ids):
            self.client.delete(f"/api/places/{place_id}/", headers=self._headers())

    # ------------------------------------------------------------------ #
    # Tasks                                                                #
    # ------------------------------------------------------------------ #

    @task(5)
    def listar_places(self):
        self._get("/api/places/")

    @task(3)
    def listar_places_com_filtro(self):
        status = random.choice(STATUSES)
        self._get(f"/api/places/?status={status}")

    @task(2)
    def detalhe_place(self):
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        self._get(f"/api/places/{place_id}/")

    @task(2)
    def listar_visitas(self):
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        self._get(f"/api/places/{place_id}/visits/")

    @task(1)
    def criar_place(self):
        self._criar_place()

    @task(1)
    def criar_visita(self):
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
                "general_notes": "Visita via teste de carga.",
            },
        )
        if resp and resp.status_code == 201:
            self._visit_ids.append(resp.json()["public_id"])

    @task(1)
    def criar_item_visita(self):
        if not self._visit_ids:
            return
        visit_id = random.choice(self._visit_ids)
        self._post(
            f"/api/visits/{visit_id}/items/",
            json={
                "name": f"Item {random.randint(1, 100)}",
                "type": random.choice(ITEM_TYPES),
                "rating": round(random.uniform(5, 10), 1),
                "price": round(random.uniform(5, 50), 2),
                "would_order_again": random.choice([True, False]),
                "notes": "",
            },
        )

    @task(1)
    def upload_foto_place(self):
        if not self._place_ids:
            return
        place_id = random.choice(self._place_ids)
        jpeg_bytes = _make_jpeg()
        self.client.patch(
            f"/api/places/{place_id}/",
            files={"cover_photo": ("photo.jpg", jpeg_bytes, "image/jpeg")},
            headers=self._headers(),
        )

    @task(1)
    def refresh_token(self):
        if not self._refresh_token:
            return
        resp = self.client.post(
            "/api/auth/refresh/",
            json={"refresh": self._refresh_token},
        )
        if resp.status_code == 200:
            data = resp.json()
            self._token = data.get("access", self._token)
            self._refresh_token = data.get("refresh", self._refresh_token)

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _login(self):
        resp = self.client.post(
            "/api/auth/login/",
            json={"username": self.username, "password": self.password},
        )
        if resp.status_code == 200:
            data = resp.json()
            self._token = data["access"]
            self._refresh_token = data["refresh"]

    def _headers(self):
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    def _get(self, url):
        return self.client.get(url, headers=self._headers())

    def _post(self, url, json):
        return self.client.post(url, json=json, headers=self._headers())

    def _criar_place(self):
        resp = self._post(
            "/api/places/",
            json={
                "name": f"Place {random.randint(1, 9999)}",
                "category": random.choice(CATEGORIES),
                "address": "Rua de Teste, 123",
                "status": random.choice(STATUSES),
                "notes": "",
            },
        )
        if resp and resp.status_code == 201:
            self._place_ids.append(resp.json()["public_id"])
