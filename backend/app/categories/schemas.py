from pydantic import BaseModel


class FieldDefinition(BaseModel):
    key: str
    label: str
    type: str
    required: bool
    options: list[dict[str, str]] | None = None


class FieldGroup(BaseModel):
    label: str
    fields: list[FieldDefinition]


class SubcategoryInfo(BaseModel):
    key: str
    label: str
    icon: str
    fields: list[FieldDefinition]
    field_groups: list[FieldGroup] | None = None
    file_slots: list[str]
    recommended: bool
    item_count: int = 0
    coverage_definition: dict | None = None


class CategoryResponse(BaseModel):
    slug: str
    label: str
    icon: str
    subcategories: list[SubcategoryInfo]


class CategoryListItem(BaseModel):
    slug: str
    label: str
    icon: str
    subcategory_count: int
    total_items: int = 0
