from __future__ import annotations

from places.maps import extract_coords


def test_extract_coords_from_google_maps_data_path():
    url = (
        "https://www.google.com/maps/place/Rua+10+de+Julho,+567+-+Centro/"
        "data=!4m7!3m6!1s0x926c057cd25431bd:0x3aff37a78b5de38e"
        "!8m2!3d-3.1296743!4d-60.022475!16s%2Fg%2F11c4yn05rz"
    )

    assert extract_coords(url) == (-3.1296743, -60.022475)
