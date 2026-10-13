"""A product's saved firmware code. The risks: one company reading or
changing another's code, a device secret ending up stored, and a huge upload."""
from app.modules.firmware.sketch import MAX_SKETCH_BYTES, SECRET_PLACEHOLDER

CODE = 'const char* DEVICE_ID = "abc";\nvoid setup() {}\nvoid loop() {}\n'


def create_product(client, headers, name="Cold room"):
    response = client.post("/products", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def sketch_url(product_id):
    return f"/products/{product_id}/sketch"


def test_a_product_starts_with_no_saved_code(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = client.get(sketch_url(product), headers=headers)

    assert response.status_code == 200
    assert response.json() == {"code": None, "updated_at": None}


def test_saved_code_comes_back_exactly(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    saved = client.put(sketch_url(product), json={"code": CODE}, headers=headers)
    read = client.get(sketch_url(product), headers=headers).json()

    assert saved.status_code == 200
    assert read["code"] == CODE
    assert read["updated_at"] is not None


def test_saving_again_replaces_the_code(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)
    client.put(sketch_url(product), json={"code": CODE}, headers=headers)

    client.put(sketch_url(product), json={"code": "// second version\n"}, headers=headers)

    assert client.get(sketch_url(product), headers=headers).json()["code"] == "// second version\n"


def test_each_product_keeps_its_own_code(client, account):
    headers = account()["headers"]
    first = create_product(client, headers, "Cold room")
    second = create_product(client, headers, "Boiler")

    client.put(sketch_url(first), json={"code": CODE}, headers=headers)

    assert client.get(sketch_url(second), headers=headers).json()["code"] is None


def test_reset_goes_back_to_no_saved_code(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)
    client.put(sketch_url(product), json={"code": CODE}, headers=headers)

    reset = client.delete(sketch_url(product), headers=headers)

    assert reset.status_code == 204
    assert client.get(sketch_url(product), headers=headers).json()["code"] is None
    # Resetting twice is not an error.
    assert client.delete(sketch_url(product), headers=headers).status_code == 204


def test_a_pasted_device_secret_is_never_stored(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)
    code = 'const char* DEVICE_ID     = "abc";\nconst char* DEVICE_SECRET = "s3cr3t-Value_123";\n'

    client.put(sketch_url(product), json={"code": code}, headers=headers)
    stored = client.get(sketch_url(product), headers=headers).json()["code"]

    assert "s3cr3t-Value_123" not in stored
    assert f'DEVICE_SECRET = "{SECRET_PLACEHOLDER}"' in stored
    # Only the secret is touched: the device ID line is kept as written.
    assert 'DEVICE_ID     = "abc"' in stored


def test_another_company_cannot_read_change_or_reset_it(client, account):
    owner = account(org_name="Factory A")["headers"]
    stranger = account(org_name="Factory B")["headers"]
    product = create_product(client, owner)
    client.put(sketch_url(product), json={"code": CODE}, headers=owner)

    assert client.get(sketch_url(product), headers=stranger).status_code == 404
    assert client.put(sketch_url(product), json={"code": "// taken over"}, headers=stranger).status_code == 404
    assert client.delete(sketch_url(product), headers=stranger).status_code == 404
    # And the owner's code is untouched.
    assert client.get(sketch_url(product), headers=owner).json()["code"] == CODE


def test_nobody_reads_it_without_logging_in(client, account):
    product = create_product(client, account()["headers"])
    client.cookies.clear()

    assert client.get(sketch_url(product)).status_code == 401
    assert client.put(sketch_url(product), json={"code": CODE}).status_code == 401


def test_code_at_the_size_limit_is_accepted(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = client.put(sketch_url(product), json={"code": "a" * MAX_SKETCH_BYTES}, headers=headers)

    assert response.status_code == 200


def test_code_one_byte_over_the_limit_is_refused(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = client.put(sketch_url(product), json={"code": "a" * (MAX_SKETCH_BYTES + 1)}, headers=headers)

    assert response.status_code == 422
    assert client.get(sketch_url(product), headers=headers).json()["code"] is None


def test_the_limit_counts_bytes_not_letters(client, account):
    """A Marathi or Hindi letter takes 3 bytes: fewer letters fit."""
    headers = account()["headers"]
    product = create_product(client, headers)
    letters = MAX_SKETCH_BYTES // 3 + 1   # under the limit as letters, over it as bytes

    response = client.put(sketch_url(product), json={"code": "म" * letters}, headers=headers)

    assert response.status_code == 422


def test_empty_code_is_refused(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    for empty in ("", "   \n\t  "):
        assert client.put(sketch_url(product), json={"code": empty}, headers=headers).status_code == 422


def test_deleting_the_product_removes_its_code(client, account, db_session):
    from app.models.sketch import ProductSketch

    headers = account()["headers"]
    product = create_product(client, headers)
    client.put(sketch_url(product), json={"code": CODE}, headers=headers)

    assert client.delete(f"/products/{product}", headers=headers).status_code == 204

    db_session.expire_all()
    assert db_session.query(ProductSketch).count() == 0
