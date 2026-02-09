from pydantic import BaseModel


# --- Coverage Rows ---

class CoverageRowIn(BaseModel):
    service_key: str
    service_label: str
    sort_order: int = 0
    in_copay: str | None = None
    in_coinsurance: str | None = None
    in_deductible_applies: str | None = None
    in_notes: str | None = None
    out_copay: str | None = None
    out_coinsurance: str | None = None
    out_deductible_applies: str | None = None
    out_notes: str | None = None
    coverage_limit: str | None = None
    deductible: str | None = None
    notes: str | None = None


class CoverageRowOut(BaseModel):
    id: str
    item_id: str
    service_key: str
    service_label: str
    sort_order: int
    in_copay: str | None
    in_coinsurance: str | None
    in_deductible_applies: str | None
    in_notes: str | None
    out_copay: str | None
    out_coinsurance: str | None
    out_deductible_applies: str | None
    out_notes: str | None
    coverage_limit: str | None
    deductible: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class CoverageRowsBulk(BaseModel):
    item_id: str
    rows: list[CoverageRowIn]


# --- Plan Limits ---

class PlanLimitIn(BaseModel):
    limit_key: str
    limit_label: str
    limit_value: str | None = None
    sort_order: int = 0


class PlanLimitOut(BaseModel):
    id: str
    item_id: str
    limit_key: str
    limit_label: str
    limit_value: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class PlanLimitsBulk(BaseModel):
    item_id: str
    limits: list[PlanLimitIn]


# --- In-Network Providers ---

class InNetworkProviderCreate(BaseModel):
    item_id: str
    provider_name: str
    specialty: str | None = None
    phone: str | None = None
    address: str | None = None
    network_tier: str | None = None
    notes: str | None = None


class InNetworkProviderOut(BaseModel):
    id: str
    item_id: str
    provider_name: str
    specialty: str | None
    phone: str | None
    address: str | None
    network_tier: str | None
    notes: str | None

    model_config = {"from_attributes": True}
