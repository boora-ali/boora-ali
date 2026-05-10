from .serializers import VisitItemWriteSerializer, VisitWriteSerializer


class PlaceVisitParamsSerializer(VisitWriteSerializer):
    """Parametros da action POST /places/{id}/visits/."""


class VisitItemParamsSerializer(VisitItemWriteSerializer):
    """Parametros da action POST /visits/{id}/items/."""
