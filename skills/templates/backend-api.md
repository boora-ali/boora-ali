# API: Serializers, ViewSets, Rotas

## ViewSet padrão

```python
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated

class PlaceViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        return Place.objects.filter(user=self.request.user).select_related(...)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PlaceWriteSerializer
        return PlaceReadSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
```

## Serializers Read + Write

```python
class PlaceReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = ["public_id", "name", "cover_photo", ...]

class PlaceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = ["name", "cover_photo", ...]

    def validate_cover_photo(self, value):
        # validar tipo/tamanho se necessário
        return value

    def create(self, validated_data):
        cover_photo = validated_data.pop("cover_photo", None)
        instance = super().create(validated_data)
        if cover_photo:
            ImageService.save(instance, cover_photo, category="places/covers")
        return instance
```

## Registro de rotas (config/urls.py)

```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"places", PlaceViewSet, basename="place")
# ViewSet aninhado: visits dentro de place
router.register(r"places/(?P<place_public_id>[^/.]+)/visits", VisitViewSet, basename="visit")
```

## ViewSet aninhado — lookup do pai

```python
class VisitViewSet(ModelViewSet):
    def get_queryset(self):
        return Visit.objects.filter(
            place__public_id=self.kwargs["place_public_id"],
            place__user=self.request.user,
        )

    def perform_create(self, serializer):
        place = get_object_or_404(Place, public_id=self.kwargs["place_public_id"], user=self.request.user)
        serializer.save(place=place)
```

## Exceções — tabela rápida

| Situação | Exceção |
|---------|---------|
| Ação não permitida (lógica de negócio) | `ActionFailedException` |
| Sem permissão de acesso | `PermissionNotAllowedException` |
| Objeto referenciado em uso | `ForeignKeyException` |
| Senha incorreta | `InvalidPasswordException` |
| Credenciais inválidas | `InvalidCredentialsException` |
| Token JWT inválido/expirado | `InvalidTokenException` |
| Sessão expirada | `SessionExpiredException` |
| Sessão invalidada (novo login) | `SessionInvalidatedException` |
| Usuário não encontrado | `UserNotFoundException` |
| Recurso não encontrado | `NoRecordFoundException` |
