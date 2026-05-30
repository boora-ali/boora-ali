from __future__ import annotations

from places.maps import extract_coords


def test_extract_coords_from_google_maps_data_path():
    url = (
        "https://www.google.com/maps/place/Rua+10+de+Julho,+567+-+Centro/"
        "data=!4m7!3m6!1s0x926c057cd25431bd:0x3aff37a78b5de38e"
        "!8m2!3d-3.1296743!4d-60.022475!16s%2Fg%2F11c4yn05rz"
    )

    assert extract_coords(url) == (-3.1296743, -60.022475)


def test_extract_coords_prefers_place_pin_over_viewport():
    # URL has both @viewport and !3d/!4d place pin — must return pin, not viewport
    url = (
        "https://www.google.com/maps/place/Salgado+do+Mineiro/"
        "@-3.1196,-60.0194,17z/"
        "data=!3m1!4b1!4m6!3m5!1s0x926bf6db3e31bd:0xabc"
        "!8m2!3d-3.1190!4d-60.0217"
    )

    assert extract_coords(url) == (-3.1190, -60.0217)
