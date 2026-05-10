from places.models import Place, Visit, VisitItem


def _index_fields(model):
    return {tuple(index.fields) for index in model._meta.indexes}


def test_place_meta_indexes_cover_common_list_filters():
    indexes = _index_fields(Place)
    assert ("user", "status") in indexes
    assert ("user", "category") in indexes


def test_visit_meta_indexes_cover_common_list_filters():
    indexes = _index_fields(Visit)
    assert ("place", "visited_at") in indexes
    assert ("place", "overall_rating") in indexes


def test_visit_item_meta_indexes_cover_common_list_filters():
    indexes = _index_fields(VisitItem)
    assert ("visit", "type") in indexes
    assert ("visit", "rating") in indexes
