import os

import django
from django.db import connection

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

from erp_app.sub_models import (  # noqa: E402
    CDCTeamExpense,
    ExpenseItem,
    ExpenseSession,
    ExpenseStatusOption,
    ProjectCostingItemInfo,
    Project,
)

models_to_ensure = [ExpenseItem, ExpenseSession, ExpenseStatusOption, Project, CDCTeamExpense]
existing_tables = set(connection.introspection.table_names())

with connection.schema_editor() as editor:
    for model in models_to_ensure:
        table = model._meta.db_table
        if table not in existing_tables:
            print("[CREATE TABLE]", table)
            editor.create_model(model)
            existing_tables.add(table)

    project_table = Project._meta.db_table
    project_columns = {
        c.name for c in connection.introspection.get_table_description(connection.cursor(), project_table)
    }
    required_project_fields = [
        "proposal_date",
        "updated_by",
        "project_owner",
        "order_value_omr",
        "expected_customer_need_date",
        "created_at",
        "updated_at",
        "status",
    ]

    for field_name in required_project_fields:
        field = Project._meta.get_field(field_name)
        column = field.column
        if column not in project_columns:
            print("[ADD COLUMN]", f"{project_table}.{column}")
            editor.add_field(Project, field)
            project_columns.add(column)

print("Schema repair check complete.")

project_costing_item_table = ProjectCostingItemInfo._meta.db_table
project_costing_item_columns = {
    c.name for c in connection.introspection.get_table_description(connection.cursor(), project_costing_item_table)
}
required_project_costing_item_fields = [
    "requested_by",
    "requested_on",
    "rejection_comment",
]

with connection.schema_editor() as editor:
    for field_name in required_project_costing_item_fields:
        field = ProjectCostingItemInfo._meta.get_field(field_name)
        column = field.column
        if column not in project_costing_item_columns:
            print("[ADD COLUMN]", f"{project_costing_item_table}.{column}")
            editor.add_field(ProjectCostingItemInfo, field)
            project_costing_item_columns.add(column)

print("Project costing item schema repair check complete.")

