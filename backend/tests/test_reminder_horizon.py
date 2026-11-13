"""Exercise horizon validation and filtering through the authenticated endpoint."""
from datetime import date, timedelta

import pytest

from app.items.models import Item, ItemFieldValue
from app.reminders.models import CustomReminder


def register(client, email):
    response = client.post('/api/auth/register', json={
        'email': email, 'password': 'synthetic-test-password', 'full_name': 'Pilot Test',
    })
    assert response.status_code == 201
    data = response.json()
    return data['user'], {'Authorization': f"Bearer {data['token']}"}


def seed(db, user, offset, archived=False):
    item = Item(org_id=user['active_org_id'], created_by=user['id'],
                category='ids', subcategory='passport', name=f'Encrypted item {offset}',
                is_archived=archived)
    db.add(item)
    db.flush()
    due = date.today() + timedelta(days=offset)
    db.add(ItemFieldValue(item_id=item.id, field_key='expiration_date',
                          field_value=due.isoformat(), field_type='date'))
    db.add(CustomReminder(item_id=item.id, org_id=item.org_id, created_by=user['id'],
                          title=f'Custom {offset}', remind_date=due))
    db.commit()
    return item.id


@pytest.mark.parametrize('horizon', [1, 30, 90, 365])
def test_horizon_inclusive_and_keeps_overdue(client, db, horizon):
    user, headers = register(client, 'range@example.test')
    offsets = [-400, -1, 0, 1, 30, 31, 90, 91, 365, 366]
    ids = {offset: seed(db, user, offset) for offset in offsets}
    seed(db, user, -2, archived=True)
    response = client.get(f'/api/reminders?days_ahead={horizon}', headers=headers)
    assert response.status_code == 200
    reminders = response.json()
    assert len(reminders) == 2 * sum(offset <= horizon for offset in offsets)
    assert {r['item_id'] for r in reminders} == {ids[o] for o in offsets if o <= horizon}
    assert [r['days_until'] for r in reminders] == sorted(r['days_until'] for r in reminders)
    assert all(r['is_overdue'] == (r['days_until'] < 0) for r in reminders)


def test_default_and_organization_isolation(client, db):
    user, headers = register(client, 'one@example.test')
    other, other_headers = register(client, 'two@example.test')
    own_id = seed(db, user, 90)
    seed(db, user, 91)
    other_id = seed(db, other, -1)
    response = client.get('/api/reminders', headers=headers)
    assert response.status_code == 200
    assert {r['item_id'] for r in response.json()} == {own_id}
    assert response.json() == client.get('/api/reminders?days_ahead=90', headers=headers).json()
    assert {r['item_id'] for r in client.get('/api/reminders?days_ahead=365', headers=other_headers).json()} == {other_id}
    assert other_id not in {r['item_id'] for r in client.get('/api/reminders?days_ahead=365', headers=headers).json()}


@pytest.mark.parametrize('value', ['0', '-1', '366', '1.5', 'abc', ''])
def test_invalid_horizon(client, value):
    _, headers = register(client, 'bounds@example.test')
    response = client.get(f'/api/reminders?days_ahead={value}', headers=headers)
    assert response.status_code == 422
    assert response.json()['detail'][0]['loc'] == ['query', 'days_ahead']


def test_reminders_require_authentication(client):
    assert client.get('/api/reminders?days_ahead=365').status_code == 401
